export type GiftPool = "good" | "bad";

export type ChainSession = {
  startParticipantId: string;
  currentParticipantId: string;
  completedDrawerIds: string[];
  complete: boolean;
};

export type RandomIndex = (length: number) => number;

export function chooseProviderId(
  participantIds: string[],
  session: ChainSession,
  randomIndex: RandomIndex,
): string {
  if (session.complete) {
    throw new Error("CHAIN_COMPLETE");
  }

  const completed = new Set(session.completedDrawerIds);
  const isFinalDrawer = completed.size === participantIds.length - 1;

  if (isFinalDrawer) {
    return session.startParticipantId;
  }

  const candidates = participantIds.filter(
    (id) =>
      id !== session.currentParticipantId &&
      id !== session.startParticipantId &&
      !completed.has(id),
  );

  if (candidates.length === 0) {
    throw new Error("NO_LEGAL_PROVIDER");
  }

  return candidates[randomIndex(candidates.length)]!;
}

export function advanceChain(
  participantIds: string[],
  session: ChainSession,
  providerId: string,
): ChainSession {
  if (providerId === session.currentParticipantId) {
    throw new Error("SELF_DRAW");
  }

  const completedDrawerIds = [
    ...session.completedDrawerIds,
    session.currentParticipantId,
  ];
  const complete = completedDrawerIds.length === participantIds.length;

  if (complete && providerId !== session.startParticipantId) {
    throw new Error("CHAIN_MUST_CLOSE_AT_START");
  }

  return {
    ...session,
    currentParticipantId: providerId,
    completedDrawerIds,
    complete,
  };
}
