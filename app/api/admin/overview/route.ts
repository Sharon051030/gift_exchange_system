import { type NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/authorization";
import { getAdminOverview } from "@/lib/event-repository";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await authorize(request.headers, ["admin", "host"]);
  if (!access.ok)
    return NextResponse.json(
      { message: access.message },
      { status: access.status },
    );
  const limited = await enforceRateLimit("admin-read", access.principal.id);
  if (!limited.success)
    return NextResponse.json(
      { message: limited.message },
      { status: limited.status },
    );
  try {
    return NextResponse.json(
      { ...(await getAdminOverview()), viewerRole: access.principal.role },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { message: "活動資料庫尚未完成初始化。" },
      { status: 503 },
    );
  }
}
