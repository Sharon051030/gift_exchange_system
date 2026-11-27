export const OPENING_TIMELINE = {
  minimumLoadingSeconds: 0.9,
  flight: { start: 0, end: 3.65 },
  gather: { start: 0, end: 0.85 },
  background: { start: 0.72, end: 2.6 },
  dissolve: { start: 3.35, end: 4.15 },
  garland: { start: 3.58, end: 6.3 },
  tree: { start: 3.86, end: 6.16 },
  gifts: { start: 6.12, end: 7.4 },
  interface: { start: 6.3, end: 7.5 },
  total: 7.5,
} as const;

export type OpeningFrame = {
  flight: number;
  gather: number;
  dissolve: number;
  garland: number;
  tree: number;
  gifts: number;
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
    gather: progress(OPENING_TIMELINE.gather),
    dissolve: progress(OPENING_TIMELINE.dissolve),
    garland: progress(OPENING_TIMELINE.garland),
    tree: progress(OPENING_TIMELINE.tree),
    gifts: progress(OPENING_TIMELINE.gifts),
    interface: progress(OPENING_TIMELINE.interface),
    background: progress(OPENING_TIMELINE.background),
    complete: elapsed >= OPENING_TIMELINE.total,
  };
}
