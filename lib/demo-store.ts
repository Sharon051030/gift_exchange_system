import { randomInt } from "node:crypto";
import {
  advanceChain,
  chooseProviderId,
  type ChainSession,
  type GiftPool,
  type RandomIndex,
} from "./draw-engine";

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

type IdempotencyRecord = {
  fingerprint: string;
  result: DrawResult;
};

type PoolState = {
  chain: ChainSession;
  opened: Map<number, DrawResult>;
  idempotency: Map<string, IdempotencyRecord>;
};

export type DemoStore = {
  participants: Participant[];
  pools: Record<GiftPool, PoolState>;
  paused: boolean;
};

const familyNames = [
  "林",
  "陳",
  "張",
  "李",
  "王",
  "吳",
  "劉",
  "黃",
  "蔡",
  "楊",
];
const givenNames = ["安安", "小冬", "沐晴", "子樂", "品妍"];
const messages = [
  "願你的聖誕節，有好吃的蛋糕，也有剛剛好的驚喜。",
  "把今年的辛苦留在雪裡，把明年的好運帶回家。",
  "願每一盞燈都替你照亮一件值得期待的小事。",
  "祝你拆到喜歡的禮物，也遇見願意分享的人。",
  "聖誕快樂，願你的冬天溫暖，日子一直閃閃發亮。",
];

export function createParticipants(): Participant[] {
  return Array.from({ length: 50 }, (_, index) => {
    const familyName = familyNames[index % familyNames.length]!;
    const givenName = givenNames[Math.floor(index / familyNames.length)]!;
    const name = `${familyName}${givenName}`;
    return {
      id: `p-${String(index + 1).padStart(2, "0")}`,
      name,
      initials: `${familyName}${givenName.slice(0, 1)}`,
      avatarTone: index % 6,
      message: messages[index % messages.length]!,
    };
  });
}

function createPool(
  participants: Participant[],
  startIndex: number,
): PoolState {
  const startParticipantId = participants[startIndex]!.id;
  return {
    chain: {
      startParticipantId,
      currentParticipantId: startParticipantId,
      completedDrawerIds: [],
      complete: false,
    },
    opened: new Map(),
    idempotency: new Map(),
  };
}

export function createInitialStore(): DemoStore {
  const participants = createParticipants();
  return {
    participants,
    pools: {
      good: createPool(participants, 0),
      bad: createPool(participants, 17),
    },
    paused: false,
  };
}

const globalStore = globalThis as typeof globalThis & {
  christmasGiftStore?: DemoStore;
};

export const demoStore =
  globalStore.christmasGiftStore ??
  (globalStore.christmasGiftStore = createInitialStore());

export function executeDraw(
  store: DemoStore,
  input: { pool: GiftPool; slotNumber: number; idempotencyKey: string },
  randomIndex: RandomIndex = (length) => randomInt(length),
): DrawResult {
  const { pool, slotNumber, idempotencyKey } = input;
  const poolState = store.pools[pool];
  const fingerprint = `${pool}:${slotNumber}`;
  const previous = poolState.idempotency.get(idempotencyKey);

  if (previous) {
    if (previous.fingerprint !== fingerprint) {
      throw new Error("IDEMPOTENCY_KEY_REUSED");
    }
    return previous.result;
  }
  if (store.paused) throw new Error("EVENT_PAUSED");
  if (poolState.chain.complete) throw new Error("CHAIN_COMPLETE");
  if (!Number.isInteger(slotNumber) || slotNumber < 1 || slotNumber > 50) {
    throw new Error("INVALID_SLOT");
  }
  if (poolState.opened.has(slotNumber)) throw new Error("SLOT_ALREADY_OPENED");

  const participantIds = store.participants.map(
    (participant) => participant.id,
  );
  const providerId = chooseProviderId(
    participantIds,
    poolState.chain,
    randomIndex,
  );
  const drawer = store.participants.find(
    (participant) => participant.id === poolState.chain.currentParticipantId,
  )!;
  const provider = store.participants.find(
    (participant) => participant.id === providerId,
  )!;
  const result: DrawResult = {
    id: `${pool}-${String(poolState.opened.size + 1).padStart(2, "0")}`,
    pool,
    sequence: poolState.opened.size + 1,
    slotNumber,
    drawer,
    provider,
    createdAt: new Date().toISOString(),
  };

  poolState.chain = advanceChain(participantIds, poolState.chain, providerId);
  poolState.opened.set(slotNumber, result);
  poolState.idempotency.set(idempotencyKey, { fingerprint, result });
  return result;
}

export function publicState(store: DemoStore, pool: GiftPool) {
  const poolState = store.pools[pool];
  const currentDrawer = store.participants.find(
    (participant) => participant.id === poolState.chain.currentParticipantId,
  )!;
  return {
    eventName: "Christmas Mystery Gift",
    pool,
    paused: store.paused,
    total: store.participants.length,
    openedCount: poolState.opened.size,
    remaining: store.participants.length - poolState.opened.size,
    complete: poolState.chain.complete,
    currentDrawer,
    opened: Array.from(poolState.opened.values()),
  };
}

export function adminOverview(store: DemoStore) {
  const poolSummaries = (Object.keys(store.pools) as GiftPool[]).reduce(
    (summaries, pool) => {
      const poolState = store.pools[pool];
      const state = publicState(store, pool);
      summaries[pool] = {
        ...state,
        completedDrawerIds: poolState.chain.completedDrawerIds,
        startParticipantId: poolState.chain.startParticipantId,
      };
      return summaries;
    },
    {} as Record<
      GiftPool,
      ReturnType<typeof publicState> & {
        completedDrawerIds: string[];
        startParticipantId: string;
      }
    >,
  );

  const participants = store.participants.map((participant) => {
    const statusFor = (pool: GiftPool) => {
      const poolState = store.pools[pool];
      if (poolState.chain.complete) return "已完成";
      if (poolState.chain.completedDrawerIds.includes(participant.id)) {
        return "已完成";
      }
      if (poolState.chain.currentParticipantId === participant.id) {
        return "目前接棒";
      }
      return "待抽";
    };
    const giftFor = (pool: GiftPool) =>
      Array.from(store.pools[pool].opened.values()).some(
        (draw) => draw.provider.id === participant.id,
      )
        ? "已分配"
        : "已到場";

    return {
      ...participant,
      attendance: "已到場",
      goodDrawStatus: statusFor("good"),
      badDrawStatus: statusFor("bad"),
      goodGiftStatus: giftFor("good"),
      badGiftStatus: giftFor("bad"),
    };
  });

  const gifts = (Object.keys(store.pools) as GiftPool[]).flatMap((pool) =>
    store.participants.map((participant, index) => {
      const assignment = Array.from(store.pools[pool].opened.values()).find(
        (draw) => draw.provider.id === participant.id,
      );
      return {
        id: `${pool}-gift-${String(index + 1).padStart(2, "0")}`,
        pool,
        inventoryNumber: `${pool === "good" ? "G" : "B"}-${String(index + 1).padStart(3, "0")}`,
        provider: participant,
        inventoryStatus: "已到場",
        assignmentStatus: assignment ? "已分配" : "待分配",
        slotNumber: assignment?.slotNumber ?? null,
        drawerName: assignment?.drawer.name ?? null,
      };
    }),
  );

  const auditLogs = (Object.keys(store.pools) as GiftPool[])
    .flatMap((pool) =>
      Array.from(store.pools[pool].opened.values()).map((draw) => ({
        id: `audit-${draw.id}`,
        createdAt: draw.createdAt,
        actor: "抽獎服務",
        action: "建立有效抽獎",
        target: `${pool === "good" ? "好禮物" : "壞禮物"} #${String(draw.slotNumber).padStart(2, "0")}`,
        detail: `${draw.drawer.name} → ${draw.provider.name}`,
        outcome: "成功",
      })),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    event: {
      name: "Christmas Mystery Gift",
      status: store.paused ? "已暫停" : "進行中",
      rulesVersion: "v2.0",
      participantCount: store.participants.length,
      updatedAt: new Date().toISOString(),
    },
    paused: store.paused,
    pools: poolSummaries,
    participants,
    gifts,
    auditLogs,
    health: {
      blockingIssues: [],
      warnings: [],
      connection: "正常",
      pendingCorrections: 0,
      absentParticipants: 0,
      missingGifts: 0,
    },
  };
}
