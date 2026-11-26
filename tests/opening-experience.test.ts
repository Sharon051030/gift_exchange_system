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

  it("starts gathering from zero and hands off to the tree and then gifts", () => {
    expect(getOpeningFrame(0).gather).toBe(0);
    expect(getOpeningFrame(0).flight).toBe(0);
    const handoff = getOpeningFrame(OPENING_TIMELINE.flight.end);
    expect(handoff.dissolve).toBeGreaterThan(0);
    expect(handoff.garland).toBeGreaterThan(0);
    expect(handoff.tree).toBe(0);
    expect(getOpeningFrame(OPENING_TIMELINE.gifts.start - 0.01).gifts).toBe(0);
    const overlap = getOpeningFrame(OPENING_TIMELINE.interface.start + 0.2);
    expect(overlap.tree).toBe(1);
    expect(overlap.gifts).toBeGreaterThan(0);
    expect(overlap.gifts).toBeLessThan(1);
    expect(overlap.interface).toBeGreaterThan(0);
    expect(overlap.complete).toBe(false);
    expect(getOpeningFrame(OPENING_TIMELINE.total).complete).toBe(true);
  });
});
