import { type NextRequest, NextResponse } from "next/server";
import { adminOverview, demoStore } from "@/lib/demo-store";
import { attachSessionCookie, getOrCreateSession } from "@/lib/security";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const session = getOrCreateSession(request);
  const response = NextResponse.json(
    { ...adminOverview(demoStore), csrfToken: session.csrfToken },
    { headers: { "Cache-Control": "no-store" } },
  );
  if (session.isNew) attachSessionCookie(response, session.id);
  return response;
}
