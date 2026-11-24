import { type NextRequest, NextResponse } from "next/server";
import { demoStore } from "@/lib/demo-store";
import { checkRateLimit, verifyMutationRequest } from "@/lib/security";

export async function POST(request: NextRequest) {
  const auth = verifyMutationRequest(request);
  if (!auth.ok)
    return NextResponse.json(
      { message: auth.message },
      { status: auth.status },
    );
  if (!checkRateLimit(`pause:${auth.sessionId}`, 10)) {
    return NextResponse.json(
      { message: "操作太頻繁，請稍候再試。" },
      { status: 429 },
    );
  }
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
  demoStore.paused = body.paused;
  return NextResponse.json({ paused: demoStore.paused });
}
