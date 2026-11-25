import { type NextRequest, NextResponse } from "next/server";
import { authorize, verifySameOrigin } from "@/lib/authorization";
import { resetEvent } from "@/lib/event-repository";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json(
      { message: "請求來源無法驗證。" },
      { status: 403 },
    );
  }
  const access = await authorize(request.headers, ["admin"]);
  if (!access.ok) {
    return NextResponse.json(
      { message: access.message },
      { status: access.status },
    );
  }
  const limited = await enforceRateLimit("reset", access.principal.id);
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

  const body: unknown = await request.json().catch(() => null);
  const confirmation =
    body && typeof body === "object" && "confirmation" in body
      ? body.confirmation
      : null;
  if (typeof confirmation !== "string" || confirmation.length > 120) {
    return NextResponse.json(
      { message: "請輸入完整活動名稱確認重置。" },
      { status: 400 },
    );
  }

  try {
    const result = await resetEvent(confirmation, access.principal);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (code === "RESET_CONFIRMATION_MISMATCH") {
      return NextResponse.json(
        { message: "活動名稱不相符，未執行重置。" },
        { status: 400 },
      );
    }
    if (code === "EVENT_NOT_CONFIGURED") {
      return NextResponse.json(
        { message: "活動資料庫尚未完成初始化。" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { message: "重置失敗，活動資料未變更。" },
      { status: 500 },
    );
  }
}
