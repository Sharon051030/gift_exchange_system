import { type NextRequest, NextResponse } from "next/server";
import { demoStore, executeDraw, publicState } from "@/lib/demo-store";
import type { GiftPool } from "@/lib/draw-engine";
import { checkRateLimit, verifyMutationRequest } from "@/lib/security";

const errorMap: Record<string, { status: number; message: string }> = {
  EVENT_PAUSED: { status: 409, message: "活動目前暫停，恢復後再繼續。" },
  CHAIN_COMPLETE: { status: 409, message: "這個獎池已完成接棒循環。" },
  INVALID_SLOT: { status: 400, message: "格子編號不正確。" },
  SLOT_ALREADY_OPENED: { status: 409, message: "這一格已經揭曉，請選其他格。" },
  IDEMPOTENCY_KEY_REUSED: { status: 409, message: "請求代碼與原操作不一致。" },
  NO_LEGAL_PROVIDER: { status: 409, message: "目前沒有可完成接棒的合法結果。" },
};

export async function POST(request: NextRequest) {
  const auth = verifyMutationRequest(request);
  if (!auth.ok)
    return NextResponse.json(
      { message: auth.message },
      { status: auth.status },
    );
  if (!checkRateLimit(`draw:${auth.sessionId}`)) {
    return NextResponse.json(
      { message: "抽獎請求太頻繁，請稍候再試。" },
      { status: 429 },
    );
  }

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
  if (
    (pool !== "good" && pool !== "bad") ||
    typeof slotNumber !== "number" ||
    typeof idempotencyKey !== "string" ||
    idempotencyKey.length < 16 ||
    idempotencyKey.length > 100
  ) {
    return NextResponse.json({ message: "抽獎欄位不完整。" }, { status: 400 });
  }

  try {
    const result = executeDraw(demoStore, {
      pool: pool as GiftPool,
      slotNumber,
      idempotencyKey,
    });
    return NextResponse.json(
      { result, state: publicState(demoStore, pool as GiftPool) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const mapped = errorMap[code] ?? {
      status: 500,
      message: "目前無法確認驚喜，請保留此格並重試。",
    };
    return NextResponse.json(
      { message: mapped.message },
      { status: mapped.status },
    );
  }
}
