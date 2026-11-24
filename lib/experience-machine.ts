import type { DrawResult } from "./demo-store";

export type InteractionPhase =
  | "ready"
  | "hit-1"
  | "hit-2"
  | "draw-pending"
  | "breaking"
  | "reveal"
  | "closing";

export type InteractionState = {
  phase: InteractionPhase;
  slotNumber: number | null;
  draw: DrawResult | null;
};

export type InteractionAction =
  | { type: "SELECT"; slotNumber: number }
  | { type: "HIT_AGAIN" }
  | { type: "REQUEST_DRAW" }
  | { type: "DRAW_CONFIRMED"; draw: DrawResult }
  | { type: "SHOW_REVEAL" }
  | { type: "REPLAY"; draw: DrawResult }
  | { type: "CLOSE" }
  | { type: "FAIL" }
  | { type: "RESET" };

export const INITIAL_INTERACTION: InteractionState = {
  phase: "ready",
  slotNumber: null,
  draw: null,
};

export function interactionReducer(
  state: InteractionState,
  action: InteractionAction,
): InteractionState {
  switch (action.type) {
    case "SELECT":
      return { phase: "hit-1", slotNumber: action.slotNumber, draw: null };
    case "HIT_AGAIN":
      return state.phase === "hit-1" ? { ...state, phase: "hit-2" } : state;
    case "REQUEST_DRAW":
      return state.phase === "hit-2"
        ? { ...state, phase: "draw-pending" }
        : state;
    case "DRAW_CONFIRMED":
      return {
        phase: "breaking",
        slotNumber: action.draw.slotNumber,
        draw: action.draw,
      };
    case "SHOW_REVEAL":
      return state.phase === "breaking" ? { ...state, phase: "reveal" } : state;
    case "REPLAY":
      return {
        phase: "reveal",
        slotNumber: action.draw.slotNumber,
        draw: action.draw,
      };
    case "CLOSE":
      return state.draw ? { ...state, phase: "closing" } : state;
    case "FAIL":
      return state.slotNumber
        ? { phase: "hit-2", slotNumber: state.slotNumber, draw: null }
        : INITIAL_INTERACTION;
    case "RESET":
      return INITIAL_INTERACTION;
  }
}

export function tapCountFor(phase: InteractionPhase) {
  if (phase === "hit-1") return 1;
  if (phase === "hit-2" || phase === "draw-pending") return 2;
  return 0;
}
