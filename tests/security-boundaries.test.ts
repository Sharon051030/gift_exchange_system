import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { verifySameOrigin } from "../lib/authorization";
import { enforceRateLimit } from "../lib/rate-limit";
import { proxy } from "../proxy";

describe("security boundaries", () => {
  it("rejects a cross-site mutation origin", () => {
    const request = new Request("https://gift.example/api/draws", {
      method: "POST",
      headers: {
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site",
      },
    });
    expect(verifySameOrigin(request)).toBe(false);
  });

  it("accepts a same-origin mutation origin", () => {
    const request = new Request("https://gift.example/api/draws", {
      method: "POST",
      headers: {
        origin: "https://gift.example",
        "sec-fetch-site": "same-origin",
      },
    });
    expect(verifySameOrigin(request)).toBe(true);
  });

  it("fails closed when distributed rate limiting is not configured", async () => {
    const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
    const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const result = await enforceRateLimit("draw", "test-user");
    expect(result.success).toBe(false);
    expect(result.status).toBe(503);
    if (previousUrl) process.env.UPSTASH_REDIS_REST_URL = previousUrl;
    else delete process.env.UPSTASH_REDIS_REST_URL;
    if (previousToken) process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;
    else delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("redirects an unauthenticated admin request to login", () => {
    const response = proxy(new NextRequest("https://gift.example/admin"));
    expect(response.headers.get("location")).toBe(
      "https://gift.example/login?next=%2Fadmin",
    );
  });
});
