export const OPENING_TIMELINE = {
  minimumLoadingSeconds: 0.9,
  flight: { start: 0, end: 3.1 },
  background: { start: 0.95, end: 4.5 },
  dissolve: { start: 2.65, end: 3.55 },
  garland: { start: 2.95, end: 5.6 },
  tableau: { start: 3.55, end: 5.65 },
  interface: { start: 4.6, end: 5.8 },
  total: 5.8,
} as const;

export type OpeningFrame = {
  flight: number;
  dissolve: number;
  garland: number;
  tableau: number;
  interface: number;
  background: number;
  complete: boolean;
};

export function segmentProgress(
  elapsed: number,
  segment: { start: number; end: number },
) {
  if (segment.end <= segment.start) return elapsed >= segment.end ? 1 : 0;
  return Math.min(
    1,
    Math.max(0, (elapsed - segment.start) / (segment.end - segment.start)),
  );
}

export function getOpeningFrame(elapsed: number): OpeningFrame {
  const progress = (segment: { start: number; end: number }) =>
    segmentProgress(elapsed, segment);
  return {
    flight: progress(OPENING_TIMELINE.flight),
    dissolve: progress(OPENING_TIMELINE.dissolve),
    garland: progress(OPENING_TIMELINE.garland),
    tableau: progress(OPENING_TIMELINE.tableau),
    interface: progress(OPENING_TIMELINE.interface),
    background: progress(OPENING_TIMELINE.background),
    complete: elapsed >= OPENING_TIMELINE.total,
  };
}
