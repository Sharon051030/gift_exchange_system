import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type LimitScope = "draw" | "pause" | "reset" | "admin-read" | "export";

const globalLimits = globalThis as typeof globalThis & {
  giftExchangeLimits?: Record<LimitScope, Ratelimit>;
};

function createLimits() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const redis = new Redis({ url, token });
  return {
    draw: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(15, "1 m"),
      prefix: "gift-exchange:draw",
    }),
    pause: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      prefix: "gift-exchange:pause",
    }),
    reset: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "10 m"),
      prefix: "gift-exchange:reset",
    }),
    "admin-read": new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(90, "1 m"),
      prefix: "gift-exchange:admin-read",
    }),
    export: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "10 m"),
      prefix: "gift-exchange:export",
    }),
  } satisfies Record<LimitScope, Ratelimit>;
}

export async function enforceRateLimit(scope: LimitScope, identity: string) {
  const limits = globalLimits.giftExchangeLimits ?? createLimits();
  if (!limits) {
    return {
      success: false as const,
      status: 503,
      message: "集中式限流服務尚未設定，敏感操作已安全停用。",
    };
  }
  globalLimits.giftExchangeLimits = limits;
  const result = await limits[scope].limit(identity);
  if (!result.success) {
    return {
      success: false as const,
      status: 429,
      message: "操作太頻繁，請稍候再試。",
      retryAfter: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
    };
  }
  return { success: true as const };
}
