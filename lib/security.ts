import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

type Session = { csrfToken: string; expiresAt: number };
const SESSION_COOKIE = "christmas_demo_session";
const SESSION_TTL_MS = 60 * 60 * 1000;

const globalSecurity = globalThis as typeof globalThis & {
  christmasSessions?: Map<string, Session>;
  christmasRateLimits?: Map<string, { count: number; resetAt: number }>;
};

const sessions =
  globalSecurity.christmasSessions ??
  (globalSecurity.christmasSessions = new Map());
const rateLimits =
  globalSecurity.christmasRateLimits ??
  (globalSecurity.christmasRateLimits = new Map());

export function getOrCreateSession(request: NextRequest) {
  const now = Date.now();
  const existingId = request.cookies.get(SESSION_COOKIE)?.value;
  const existing = existingId ? sessions.get(existingId) : undefined;
  if (existing && existing.expiresAt > now) {
    return { id: existingId!, ...existing, isNew: false };
  }

  const id = randomUUID();
  const session = { csrfToken: randomUUID(), expiresAt: now + SESSION_TTL_MS };
  sessions.set(id, session);
  return { id, ...session, isNew: true };
}

export function attachSessionCookie(response: NextResponse, sessionId: string) {
  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function verifyMutationRequest(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
  const session = sessionId ? sessions.get(sessionId) : undefined;
  const csrfToken = request.headers.get("x-csrf-token");
  if (
    !sessionId ||
    !session ||
    session.expiresAt <= Date.now() ||
    csrfToken !== session.csrfToken
  ) {
    return {
      ok: false as const,
      status: 401,
      message: "工作階段已過期，請重新整理。",
    };
  }
  return { ok: true as const, sessionId };
}

export function checkRateLimit(key: string, limit = 15) {
  const now = Date.now();
  const current = rateLimits.get(key);
  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}
