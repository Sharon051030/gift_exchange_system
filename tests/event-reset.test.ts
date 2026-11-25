import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("../lib/db", () => ({
  db: { query: vi.fn() },
  withTransaction: async (operation: (client: unknown) => Promise<unknown>) =>
    operation(database),
}));

import { resetEvent } from "../lib/event-repository";

describe("activity reset", () => {
  beforeEach(() => database.query.mockReset());

  it("does not mutate anything when the typed activity name is wrong", async () => {
    database.query.mockResolvedValueOnce({
      rows: [
        { name: "Christmas Mystery Gift" },
        { name: "Christmas Mystery Gift" },
      ],
    });

    await expect(
      resetEvent("wrong name", { id: "admin-1", name: "Admin" }),
    ).rejects.toThrow("RESET_CONFIRMATION_MISMATCH");
    expect(database.query).toHaveBeenCalledTimes(1);
  });

  it("clears the current round, restores both pools, and appends an audit log", async () => {
    database.query
      .mockResolvedValueOnce({
        rows: [
          { name: "Christmas Mystery Gift" },
          { name: "Christmas Mystery Gift" },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ id: "draw-1" }, { id: "draw-2" }],
        rowCount: 2,
      })
      .mockResolvedValue({ rows: [], rowCount: 1 });

    await expect(
      resetEvent("Christmas Mystery Gift", {
        id: "admin-1",
        name: "Admin",
      }),
    ).resolves.toEqual({
      eventName: "Christmas Mystery Gift",
      clearedDraws: 2,
    });

    const statements = database.query.mock.calls.map(([sql]) => String(sql));
    expect(statements.some((sql) => sql.includes("DELETE FROM draws"))).toBe(
      true,
    );
    expect(
      statements.some(
        (sql) =>
          sql.includes("UPDATE pool_states") &&
          sql.includes("current_participant_id = start_participant_id"),
      ),
    ).toBe(true);
    expect(
      statements.some((sql) => sql.includes("INSERT INTO audit_logs")),
    ).toBe(true);
  });
});
