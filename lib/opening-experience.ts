export const OPENING_TIMELINE = {
  minimumLoadingSeconds: 0.9,
  handoff: { start: 0, end: 0.3 },
  expansion: { start: 0.3, end: 2.5 },
  backgroundStart: 1.47,
  backgroundEnd: 2.5,
  returnFlight: { start: 2.5, end: 3.7 },
  dissolve: { start: 3.7, end: 4.2 },
  tree: { start: 4.2, end: 6.2 },
  gifts: { start: 5.8, end: 6.7 },
  interface: { start: 6.1, end: 7 },
  total: 7,
} as const;

export type OpeningFrame = {
  expansion: number;
  returnFlight: number;
  dissolve: number;
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
  const safeElapsed = Math.max(0, elapsed);
  return {
    expansion: segmentProgress(safeElapsed, OPENING_TIMELINE.expansion),
    returnFlight: segmentProgress(safeElapsed, OPENING_TIMELINE.returnFlight),
    dissolve: segmentProgress(safeElapsed, OPENING_TIMELINE.dissolve),
    tree: segmentProgress(safeElapsed, OPENING_TIMELINE.tree),
    gifts: segmentProgress(safeElapsed, OPENING_TIMELINE.gifts),
    interface: segmentProgress(safeElapsed, OPENING_TIMELINE.interface),
    background: segmentProgress(safeElapsed, {
      start: OPENING_TIMELINE.backgroundStart,
      end: OPENING_TIMELINE.backgroundEnd,
    }),
    complete: safeElapsed >= OPENING_TIMELINE.total,
  };
}
