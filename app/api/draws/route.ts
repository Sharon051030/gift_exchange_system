import { type NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { getPrincipal, verifySameOrigin } from "@/lib/authorization";
import { executePersistentDraw, getPublicState } from "@/lib/event-repository";
import { enforceRateLimit } from "@/lib/rate-limit";

const errorMap: Record<string, { status: number; message: string }> = {
  EVENT_PAUSED: { status: 409, message: "活動目前暫停，恢復後再繼續。" },
  CHAIN_COMPLETE: { status: 409, message: "這個獎池已完成接棒循環。" },
  INVALID_SLOT: { status: 400, message: "格子編號不正確。" },
  SLOT_ALREADY_OPENED: { status: 409, message: "這一格已經揭曉，請選其他格。" },
  IDEMPOTENCY_KEY_REUSED: { status: 409, message: "請求代碼與原操作不一致。" },
  NO_LEGAL_PROVIDER: { status: 409, message: "目前沒有可完成接棒的合法結果。" },
  STALE_TURN: { status: 409, message: "接棒已更新，請重新選擇禮物。" },
};

export async function POST(request: NextRequest) {
  if (!verifySameOrigin(request))
    return NextResponse.json(
      { message: "請求來源無法驗證。" },
      { status: 403 },
    );
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { message: "抽獎資料格式不正確。" },
      { status: 400 },
    );
  }
  const pool = "pool" in body ? body.pool : null;
  const slotNumber = "slotNumber" in body ? body.slotNumber : null;
  const idempotencyKey = "idempotencyKey" in body ? body.idempotencyKey : null;
  const expectedVersion =
    "expectedVersion" in body ? body.expectedVersion : null;
  if (
    (pool !== "good" && pool !== "bad") ||
    typeof slotNumber !== "number" ||
    !Number.isInteger(slotNumber) ||
    slotNumber < 1 ||
    slotNumber > 50 ||
    typeof expectedVersion !== "string" ||
    !/^\d{1,19}$/.test(expectedVersion) ||
    typeof idempotencyKey !== "string" ||
    idempotencyKey.length < 16 ||
    idempotencyKey.length > 100
  ) {
    return NextResponse.json({ message: "抽獎欄位不完整。" }, { status: 400 });
  }

  try {
    // The quota follows the shared event, even when visitors have no account or cookie.
    const limited = await enforceRateLimit("draw", "public-event");
    if (!limited.success) {
      return NextResponse.json(
        { message: limited.message },
        {
          status: limited.status,
          headers: limited.retryAfter
            ? { "Retry-After": String(limited.retryAfter) }
            : undefined,
        },
      );
    }
    const principal = getSessionCookie(request)
      ? await getPrincipal(request.headers)
      : null;
    const result = await executePersistentDraw(
      {
        pool,
        slotNumber,
        idempotencyKey,
        expectedVersion,
      },
      principal ?? { id: "public-guest", name: "公開抽獎訪客" },
    );
    return NextResponse.json(
      { result, state: await getPublicState(pool) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const mapped =
      errorMap[code] ??
      (code === "EVENT_NOT_CONFIGURED"
        ? {
            status: 503,
            message: "活動資料庫尚未完成初始化。",
          }
        : {
            status: 500,
            message: "目前無法確認驚喜，請保留此格並重試。",
          });
    return NextResponse.json(
      { message: mapped.message, ...(mapped.status === 409 ? { code } : {}) },
      { status: mapped.status },
    );
  }
}
