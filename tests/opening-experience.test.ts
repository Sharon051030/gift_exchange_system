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

  it("starts the background wipe after the second horizontal crossing", () => {
    expect(
      getOpeningFrame(OPENING_TIMELINE.backgroundStart - 0.01).background,
    ).toBe(0);
    expect(
      getOpeningFrame(OPENING_TIMELINE.backgroundStart + 0.2).background,
    ).toBeGreaterThan(0);
    expect(getOpeningFrame(OPENING_TIMELINE.expansion.end).background).toBe(1);
  });

  it("overlaps the tree, gifts, and interface without completing early", () => {
    const overlap = getOpeningFrame(6.15);
    expect(overlap.tree).toBeGreaterThan(0);
    expect(overlap.gifts).toBeGreaterThan(0);
    expect(overlap.interface).toBeGreaterThan(0);
    expect(overlap.complete).toBe(false);
    expect(getOpeningFrame(OPENING_TIMELINE.total).complete).toBe(true);
  });
});
