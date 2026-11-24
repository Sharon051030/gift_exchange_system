import { type NextRequest, NextResponse } from "next/server";
import { demoStore, publicState } from "@/lib/demo-store";
import { attachSessionCookie, getOrCreateSession } from "@/lib/security";
import type { GiftPool } from "@/lib/draw-engine";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const poolParam = request.nextUrl.searchParams.get("pool");
  const pool: GiftPool = poolParam === "bad" ? "bad" : "good";
  const session = getOrCreateSession(request);
  const response = NextResponse.json(
    { ...publicState(demoStore, pool), csrfToken: session.csrfToken },
    { headers: { "Cache-Control": "no-store" } },
  );
  if (session.isNew) attachSessionCookie(response, session.id);
  return response;
}
