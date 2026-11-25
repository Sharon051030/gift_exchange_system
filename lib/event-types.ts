import type { GiftPool } from "./draw-engine";

export type Participant = {
  id: string;
  name: string;
  initials: string;
  avatarTone: number;
  message: string;
};

export type DrawResult = {
  id: string;
  pool: GiftPool;
  sequence: number;
  slotNumber: number;
  drawer: Participant;
  provider: Participant;
  createdAt: string;
};
