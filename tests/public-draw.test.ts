import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "../app/api/draws/route";

const { draw, limit, principal, state } = vi.hoisted(() => ({
  draw: vi.fn(),
  limit: vi.fn(),
  principal: vi.fn(),
  state: vi.fn(),
}));

vi.mock("../lib/authorization", () => ({
  getPrincipal: principal,
  verifySameOrigin: (request: Request) =>
    request.headers.get("origin") === new URL(request.url).origin,
}));
vi.mock("../lib/event-repository", () => ({
  executePersistentDraw: draw,
  getPublicState: state,
}));
vi.mock("../lib/rate-limit", () => ({ enforceRateLimit: limit }));

const input = {
  pool: "good",
  slotNumber: 1,
  expectedVersion: "17",
  idempotencyKey: "public-test-0123456789",
};

function request(origin = "http://localhost:3000", body: object = input) {
  return new NextRequest("http://localhost:3000/api/draws", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  limit.mockResolvedValue({ success: true });
  draw.mockResolvedValue({ id: "draw-1" });
  state.mockResolvedValue({ version: "18" });
});

it("allows a cookie-free draw with a shared quota and an anonymous audit actor", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(principal).not.toHaveBeenCalled();
  expect(limit).toHaveBeenCalledWith("draw", "public-event");
  expect(draw).toHaveBeenCalledWith(input, {
    id: "public-guest",
    name: "公開抽獎訪客",
  });
  expect(await response.json()).toEqual({
    result: { id: "draw-1" },
    state: { version: "18" },
  });
});

it("rejects missing versions and cross-origin requests before drawing", async () => {
  expect(
    (await POST(request(undefined, { ...input, expectedVersion: null })))
      .status,
  ).toBe(400);
  expect((await POST(request("https://other.example"))).status).toBe(403);
  expect(draw).not.toHaveBeenCalled();
});

it("reports a stale round so the stage can refresh the current drawer", async () => {
  draw.mockRejectedValue(new Error("STALE_TURN"));
  const response = await POST(request());
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: "STALE_TURN" });
});
