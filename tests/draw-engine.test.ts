import { describe, expect, it } from "vitest";
import {
  advanceChain,
  chooseProviderId,
  type ChainSession,
} from "../lib/draw-engine";
import {
  adminOverview,
  createInitialStore,
  executeDraw,
} from "../lib/demo-store";
import {
  INITIAL_INTERACTION,
  interactionReducer,
} from "../lib/experience-machine";

describe("strict baton chain", () => {
  it("prevents an early closed loop for three participants", () => {
    const ids = ["a", "b", "c"];
    let chain: ChainSession = {
      startParticipantId: "a",
      currentParticipantId: "a",
      completedDrawerIds: [],
      complete: false,
    };
    const first = chooseProviderId(ids, chain, () => 0);
    expect(first).toBe("b");
    chain = advanceChain(ids, chain, first);
    const second = chooseProviderId(ids, chain, () => 0);
    expect(second).toBe("c");
    chain = advanceChain(ids, chain, second);
    expect(chooseProviderId(ids, chain, () => 0)).toBe("a");
  });

  it("uses every participant once and closes at the start for fifty participants", () => {
    const store = createInitialStore();
    const providers = new Set<string>();
    for (let slot = 1; slot <= 50; slot += 1) {
      const result = executeDraw(
        store,
        {
          pool: "good",
          slotNumber: slot,
          idempotencyKey: `key-${slot}-1234567890`,
        },
        () => 0,
      );
      providers.add(result.provider.id);
    }
    expect(providers.size).toBe(50);
    expect(store.pools.good.chain.complete).toBe(true);
    expect(store.pools.good.chain.currentParticipantId).toBe(
      store.pools.good.chain.startParticipantId,
    );
  });

  it("returns the same result when an idempotency key is retried", () => {
    const store = createInitialStore();
    const request = {
      pool: "bad" as const,
      slotNumber: 7,
      idempotencyKey: "same-key-1234567890",
    };
    const first = executeDraw(store, request, () => 0);
    const retry = executeDraw(store, request, () => 3);
    expect(retry).toEqual(first);
    expect(store.pools.bad.opened.size).toBe(1);
  });

  it("rejects reuse of an idempotency key for another slot", () => {
    const store = createInitialStore();
    executeDraw(
      store,
      { pool: "good", slotNumber: 1, idempotencyKey: "same-key-1234567890" },
      () => 0,
    );
    expect(() =>
      executeDraw(
        store,
        { pool: "good", slotNumber: 2, idempotencyKey: "same-key-1234567890" },
        () => 0,
      ),
    ).toThrow("IDEMPOTENCY_KEY_REUSED");
  });

  it("keeps admin inventory, chain progress, and audit records in sync", () => {
    const store = createInitialStore();
    executeDraw(
      store,
      {
        pool: "good",
        slotNumber: 12,
        idempotencyKey: "admin-sync-1234567890",
      },
      () => 0,
    );
    const overview = adminOverview(store);
    expect(overview.pools.good.openedCount).toBe(1);
    expect(
      overview.gifts.filter(
        (gift) => gift.pool === "good" && gift.assignmentStatus === "已分配",
      ),
    ).toHaveLength(1);
    expect(overview.auditLogs).toHaveLength(1);
    expect(overview.auditLogs[0]?.target).toContain("#12");
  });
});

describe("visual interaction state machine", () => {
  it("does not enter breaking until a server result is confirmed", () => {
    const selected = interactionReducer(INITIAL_INTERACTION, {
      type: "SELECT",
      slotNumber: 8,
    });
    const cracked = interactionReducer(selected, { type: "HIT_AGAIN" });
    const pending = interactionReducer(cracked, { type: "REQUEST_DRAW" });

    expect(selected.phase).toBe("hit-1");
    expect(cracked.phase).toBe("hit-2");
    expect(pending.phase).toBe("draw-pending");
    expect(pending.draw).toBeNull();

    const store = createInitialStore();
    const draw = executeDraw(
      store,
      {
        pool: "good",
        slotNumber: 8,
        idempotencyKey: "visual-machine-1234567890",
      },
      () => 0,
    );
    const breaking = interactionReducer(pending, {
      type: "DRAW_CONFIRMED",
      draw,
    });
    expect(breaking.phase).toBe("breaking");
    expect(breaking.draw?.id).toBe(draw.id);
  });

  it("returns a failed draw to the second crack for safe retry", () => {
    const pending = interactionReducer(
      {
        phase: "hit-2",
        slotNumber: 14,
        draw: null,
      },
      { type: "REQUEST_DRAW" },
    );
    const retryable = interactionReducer(pending, { type: "FAIL" });
    expect(retryable).toEqual({
      phase: "hit-2",
      slotNumber: 14,
      draw: null,
    });
  });
});
