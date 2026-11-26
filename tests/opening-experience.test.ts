import { describe, expect, it } from "vitest";
import {
  getOpeningFrame,
  OPENING_TIMELINE,
  segmentProgress,
} from "../lib/opening-experience";

describe("opening experience timeline", () => {
  it("clamps segment progress", () => {
    const segment = { start: 2, end: 4 };
    expect(segmentProgress(1, segment)).toBe(0);
    expect(segmentProgress(3, segment)).toBe(0.5);
    expect(segmentProgress(5, segment)).toBe(1);
  });

  it("keeps the downward wash in progress through the flight and dissolve", () => {
    const { background, flight } = OPENING_TIMELINE;
    expect(getOpeningFrame(background.start - 0.01).background).toBe(0);
    expect(getOpeningFrame(flight.end).background).toBeGreaterThan(0);
    expect(getOpeningFrame(flight.end).background).toBeLessThan(1);
    expect(getOpeningFrame(background.end).background).toBe(1);
  });

  it("hands off candy to light before revealing the stationary tableau and copy", () => {
    const handoff = getOpeningFrame(OPENING_TIMELINE.flight.end);
    expect(handoff.dissolve).toBeGreaterThan(0);
    expect(handoff.garland).toBeGreaterThan(0);
    expect(handoff.tableau).toBe(0);
    const overlap = getOpeningFrame(OPENING_TIMELINE.interface.start + 0.2);
    expect(overlap.tableau).toBeGreaterThan(0);
    expect(overlap.tableau).toBeLessThan(1);
    expect(overlap.interface).toBeGreaterThan(0);
    expect(overlap.complete).toBe(false);
    expect(getOpeningFrame(OPENING_TIMELINE.total).complete).toBe(true);
  });
});
