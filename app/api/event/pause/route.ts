import { type NextRequest, NextResponse } from "next/server";
import { authorize, verifySameOrigin } from "@/lib/authorization";
import { setEventPaused } from "@/lib/event-repository";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  if (!verifySameOrigin(request))
    return NextResponse.json(
      { message: "請求來源無法驗證。" },
      { status: 403 },
    );
  const access = await authorize(request.headers, ["admin", "host"]);
  if (!access.ok)
    return NextResponse.json(
      { message: access.message },
      { status: access.status },
    );
  const limited = await enforceRateLimit("pause", access.principal.id);
  if (!limited.success)
    return NextResponse.json(
      { message: limited.message },
      {
        status: limited.status,
        headers: limited.retryAfter
          ? { "Retry-After": String(limited.retryAfter) }
          : undefined,
      },
    );
  const body: unknown = await request.json().catch(() => null);
  if (
    !body ||
    typeof body !== "object" ||
    !("paused" in body) ||
    typeof body.paused !== "boolean"
  ) {
    return NextResponse.json(
      { message: "暫停狀態格式不正確。" },
      { status: 400 },
    );
  }
  try {
    const paused = await setEventPaused(body.paused, access.principal);
    return NextResponse.json({ paused });
  } catch {
    return NextResponse.json(
      { message: "活動資料庫尚未完成初始化。" },
      { status: 503 },
    );
  }
}
