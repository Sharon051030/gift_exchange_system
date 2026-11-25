import { auth } from "./auth";

export const APP_ROLES = ["admin", "host", "viewer"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export type Principal = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
};

function normalizeRole(role: unknown): AppRole {
  return APP_ROLES.includes(role as AppRole) ? (role as AppRole) : "viewer";
}

export async function getPrincipal(
  headers: Headers,
): Promise<Principal | null> {
  const session = await auth.api.getSession({ headers }).catch(() => null);
  if (!session?.user) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: normalizeRole(
      (session.user as typeof session.user & { role?: unknown }).role,
    ),
  };
}

export async function authorize(headers: Headers, allowed: readonly AppRole[]) {
  const principal = await getPrincipal(headers);
  if (!principal) {
    return { ok: false as const, status: 401, message: "請先登入管理帳號。" };
  }
  if (!allowed.includes(principal.role)) {
    return {
      ok: false as const,
      status: 403,
      message: "你的角色沒有執行此操作的權限。",
    };
  }
  return { ok: true as const, principal };
}

export function verifySameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site") {
    return false;
  }
  if (!origin) return process.env.NODE_ENV !== "production";
  return origin === new URL(request.url).origin;
}
