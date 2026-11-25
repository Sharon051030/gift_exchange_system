import { type NextRequest, NextResponse } from "next/server";
import { getPrincipal } from "@/lib/authorization";
import { getPublicState } from "@/lib/event-repository";
import type { GiftPool } from "@/lib/draw-engine";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const poolParam = request.nextUrl.searchParams.get("pool");
  const pool: GiftPool = poolParam === "bad" ? "bad" : "good";
  try {
    const [state, principal] = await Promise.all([
      getPublicState(pool),
      getPrincipal(request.headers),
    ]);
    return NextResponse.json(
      {
        ...state,
        canControl: principal?.role === "admin" || principal?.role === "host",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { message: "活動資料庫尚未完成初始化。" },
      { status: 503 },
    );
  }
}
