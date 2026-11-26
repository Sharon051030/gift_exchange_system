import { randomInt, randomUUID } from "node:crypto";
import type { Pool, PoolClient, QueryResultRow } from "pg";
import { db, withTransaction } from "./db";
import {
  advanceChain,
  chooseProviderId,
  type ChainSession,
  type GiftPool,
  type RandomIndex,
} from "./draw-engine";
import type { DrawResult, Participant } from "./event-types";

export const DEFAULT_EVENT_ID = "christmas-mystery-gift";

type ParticipantRow = QueryResultRow & {
  id: string;
  name: string;
  initials: string;
  avatar_tone: number;
  message: string;
};

type DrawRow = QueryResultRow & {
  id: string;
  pool: GiftPool;
  sequence: number;
  slot_number: number;
  created_at: Date;
  drawer_id: string;
  drawer_name: string;
  drawer_initials: string;
  drawer_avatar_tone: number;
  drawer_message: string;
  provider_id: string;
  provider_name: string;
  provider_initials: string;
  provider_avatar_tone: number;
  provider_message: string;
  idempotency_key?: string;
  fingerprint?: string;
};

function participantFromRow(row: ParticipantRow): Participant {
  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    avatarTone: row.avatar_tone,
    message: row.message,
  };
}

function drawFromRow(row: DrawRow): DrawResult {
  return {
    id: row.id,
    pool: row.pool,
    sequence: row.sequence,
    slotNumber: row.slot_number,
    drawer: {
      id: row.drawer_id,
      name: row.drawer_name,
      initials: row.drawer_initials,
      avatarTone: row.drawer_avatar_tone,
      message: row.drawer_message,
    },
    provider: {
      id: row.provider_id,
      name: row.provider_name,
      initials: row.provider_initials,
      avatarTone: row.provider_avatar_tone,
      message: row.provider_message,
    },
    createdAt: row.created_at.toISOString(),
  };
}

const drawSelect = `
  SELECT d.id, d.pool, d.sequence, d.slot_number, d.created_at,
    d.idempotency_key, d.fingerprint,
    drawer.id AS drawer_id, drawer.name AS drawer_name,
    drawer.initials AS drawer_initials, drawer.avatar_tone AS drawer_avatar_tone,
    drawer.message AS drawer_message,
    provider.id AS provider_id, provider.name AS provider_name,
    provider.initials AS provider_initials, provider.avatar_tone AS provider_avatar_tone,
    provider.message AS provider_message
  FROM draws d
  JOIN participants drawer ON drawer.id = d.drawer_id
  JOIN participants provider ON provider.id = d.provider_id`;

async function loadParticipants(client: Pool | PoolClient = db) {
  const result = await client.query<ParticipantRow>(
    `SELECT id, name, initials, avatar_tone, message
     FROM participants WHERE event_id = $1 ORDER BY sort_order`,
    [DEFAULT_EVENT_ID],
  );
  return result.rows.map(participantFromRow);
}

async function loadDraws(pool: GiftPool, client = db) {
  const result = await client.query<DrawRow>(
    `${drawSelect} WHERE d.event_id = $1 AND d.pool = $2 ORDER BY d.sequence`,
    [DEFAULT_EVENT_ID, pool],
  );
  return result.rows.map(drawFromRow);
}

export async function getPublicState(pool: GiftPool) {
  const [eventResult, poolResult, participants, opened] = await Promise.all([
    db.query<{ name: string; paused: boolean }>(
      "SELECT name, paused FROM events WHERE id = $1",
      [DEFAULT_EVENT_ID],
    ),
    db.query<{
      start_participant_id: string;
      current_participant_id: string;
      complete: boolean;
      version: string;
    }>(
      `SELECT start_participant_id, current_participant_id, complete, version::text AS version
       FROM pool_states WHERE event_id = $1 AND pool = $2`,
      [DEFAULT_EVENT_ID, pool],
    ),
    loadParticipants(),
    loadDraws(pool),
  ]);
  const event = eventResult.rows[0];
  const poolState = poolResult.rows[0];
  if (!event || !poolState || participants.length === 0) {
    throw new Error("EVENT_NOT_CONFIGURED");
  }
  const currentDrawer = participants.find(
    (participant) => participant.id === poolState.current_participant_id,
  );
  if (!currentDrawer) throw new Error("EVENT_DATA_INVALID");
  return {
    eventName: event.name,
    pool,
    paused: event.paused,
    total: participants.length,
    openedCount: opened.length,
    remaining: participants.length - opened.length,
    complete: poolState.complete,
    version: poolState.version,
    currentDrawer,
    opened,
  };
}

export async function executePersistentDraw(
  input: {
    pool: GiftPool;
    slotNumber: number;
    idempotencyKey: string;
    expectedVersion: string;
  },
  actor: { id: string; name: string },
  randomIndex: RandomIndex = (length) => randomInt(length),
) {
  return withTransaction(async (client) => {
    const stateResult = await client.query<{
      paused: boolean;
      start_participant_id: string;
      current_participant_id: string;
      complete: boolean;
      version: string;
    }>(
      `SELECT e.paused, ps.start_participant_id, ps.current_participant_id, ps.complete, ps.version::text AS version
       FROM pool_states ps JOIN events e ON e.id = ps.event_id
       WHERE ps.event_id = $1 AND ps.pool = $2
       FOR UPDATE OF e, ps`,
      [DEFAULT_EVENT_ID, input.pool],
    );
    const state = stateResult.rows[0];
    if (!state) throw new Error("EVENT_NOT_CONFIGURED");

    const existing = await client.query<DrawRow>(
      `${drawSelect} WHERE d.event_id = $1 AND d.pool = $2 AND d.idempotency_key = $3`,
      [DEFAULT_EVENT_ID, input.pool, input.idempotencyKey],
    );
    if (existing.rows[0]) {
      if (
        existing.rows[0].fingerprint !== `${input.pool}:${input.slotNumber}`
      ) {
        throw new Error("IDEMPOTENCY_KEY_REUSED");
      }
      return drawFromRow(existing.rows[0]);
    }

    if (state.paused) throw new Error("EVENT_PAUSED");
    if (state.complete) throw new Error("CHAIN_COMPLETE");
    if (state.version !== input.expectedVersion) throw new Error("STALE_TURN");
    if (
      !Number.isInteger(input.slotNumber) ||
      input.slotNumber < 1 ||
      input.slotNumber > 50
    ) {
      throw new Error("INVALID_SLOT");
    }

    const participants = await loadParticipants(client);
    const openedResult = await client.query<{
      drawer_id: string;
      provider_id: string;
      slot_number: number;
    }>(
      `SELECT drawer_id, provider_id, slot_number FROM draws
       WHERE event_id = $1 AND pool = $2 ORDER BY sequence`,
      [DEFAULT_EVENT_ID, input.pool],
    );
    if (openedResult.rows.some((row) => row.slot_number === input.slotNumber)) {
      throw new Error("SLOT_ALREADY_OPENED");
    }
    const participantIds = participants.map((participant) => participant.id);
    const chain: ChainSession = {
      startParticipantId: state.start_participant_id,
      currentParticipantId: state.current_participant_id,
      completedDrawerIds: openedResult.rows.map((row) => row.drawer_id),
      complete: state.complete,
    };
    const providerId = chooseProviderId(participantIds, chain, randomIndex);
    const drawer = participants.find(
      (p) => p.id === chain.currentParticipantId,
    );
    const provider = participants.find((p) => p.id === providerId);
    if (!drawer || !provider) throw new Error("EVENT_DATA_INVALID");
    const nextChain = advanceChain(participantIds, chain, providerId);
    const sequence = openedResult.rows.length + 1;
    const id = `${input.pool}-${String(sequence).padStart(2, "0")}-${randomUUID().slice(0, 8)}`;
    const inserted = await client.query<{ created_at: Date }>(
      `INSERT INTO draws
       (id, event_id, pool, sequence, slot_number, drawer_id, provider_id,
        idempotency_key, fingerprint, actor_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING created_at`,
      [
        id,
        DEFAULT_EVENT_ID,
        input.pool,
        sequence,
        input.slotNumber,
        drawer.id,
        provider.id,
        input.idempotencyKey,
        `${input.pool}:${input.slotNumber}`,
        actor.id,
      ],
    );
    await client.query(
      `UPDATE pool_states SET current_participant_id = $3, complete = $4,
       version = version + 1, updated_at = now()
       WHERE event_id = $1 AND pool = $2`,
      [
        DEFAULT_EVENT_ID,
        input.pool,
        nextChain.currentParticipantId,
        nextChain.complete,
      ],
    );
    await writeAudit(
      client,
      actor,
      "建立有效抽獎",
      `${input.pool} #${input.slotNumber}`,
      `${drawer.name} → ${provider.name}`,
    );
    return {
      id,
      pool: input.pool,
      sequence,
      slotNumber: input.slotNumber,
      drawer,
      provider,
      createdAt: inserted.rows[0]!.created_at.toISOString(),
    } satisfies DrawResult;
  });
}

async function writeAudit(
  client: PoolClient,
  actor: { id: string; name: string },
  action: string,
  target: string,
  detail: string,
) {
  await client.query(
    `INSERT INTO audit_logs
     (event_id, actor_user_id, actor_name, action, target, detail, outcome)
     VALUES ($1,$2,$3,$4,$5,$6,'成功')`,
    [DEFAULT_EVENT_ID, actor.id, actor.name, action, target, detail],
  );
}

export async function setEventPaused(
  paused: boolean,
  actor: { id: string; name: string },
) {
  return withTransaction(async (client) => {
    const result = await client.query<{ paused: boolean }>(
      `UPDATE events SET paused = $2, updated_at = now()
       WHERE id = $1 RETURNING paused`,
      [DEFAULT_EVENT_ID, paused],
    );
    if (!result.rows[0]) throw new Error("EVENT_NOT_CONFIGURED");
    await writeAudit(
      client,
      actor,
      paused ? "暫停活動" : "恢復活動",
      "活動狀態",
      paused ? "已暫停" : "進行中",
    );
    return result.rows[0].paused;
  });
}

export async function resetEvent(
  confirmation: string,
  actor: { id: string; name: string },
) {
  return withTransaction(async (client) => {
    const locked = await client.query<{ name: string }>(
      `SELECT e.name
       FROM events e JOIN pool_states ps ON ps.event_id = e.id
       WHERE e.id = $1
       ORDER BY ps.pool
       FOR UPDATE OF e, ps`,
      [DEFAULT_EVENT_ID],
    );
    const event = locked.rows[0];
    if (!event || locked.rows.length !== 2) {
      throw new Error("EVENT_NOT_CONFIGURED");
    }
    if (confirmation !== event.name) {
      throw new Error("RESET_CONFIRMATION_MISMATCH");
    }

    const deleted = await client.query<{ id: string }>(
      "DELETE FROM draws WHERE event_id = $1 RETURNING id",
      [DEFAULT_EVENT_ID],
    );
    await client.query(
      `UPDATE pool_states
       SET current_participant_id = start_participant_id,
           complete = false,
           version = version + 1,
           updated_at = now()
       WHERE event_id = $1`,
      [DEFAULT_EVENT_ID],
    );
    await client.query(
      `UPDATE events SET paused = false, updated_at = now() WHERE id = $1`,
      [DEFAULT_EVENT_ID],
    );
    await writeAudit(
      client,
      actor,
      "重置活動",
      event.name,
      `清除本輪 ${deleted.rowCount ?? 0} 筆抽獎結果；名單與歷史稽核紀錄保留`,
    );
    return { eventName: event.name, clearedDraws: deleted.rowCount ?? 0 };
  });
}

export async function getAdminOverview() {
  const [
    eventResult,
    goodState,
    badState,
    participants,
    goodDraws,
    badDraws,
    auditResult,
  ] = await Promise.all([
    db.query<{
      name: string;
      paused: boolean;
      rules_version: string;
      updated_at: Date;
    }>(
      "SELECT name, paused, rules_version, updated_at FROM events WHERE id = $1",
      [DEFAULT_EVENT_ID],
    ),
    db.query<{
      start_participant_id: string;
      current_participant_id: string;
      complete: boolean;
    }>(
      "SELECT start_participant_id, current_participant_id, complete FROM pool_states WHERE event_id=$1 AND pool='good'",
      [DEFAULT_EVENT_ID],
    ),
    db.query<{
      start_participant_id: string;
      current_participant_id: string;
      complete: boolean;
    }>(
      "SELECT start_participant_id, current_participant_id, complete FROM pool_states WHERE event_id=$1 AND pool='bad'",
      [DEFAULT_EVENT_ID],
    ),
    loadParticipants(),
    loadDraws("good"),
    loadDraws("bad"),
    db.query<{
      id: number;
      created_at: Date;
      actor_name: string;
      action: string;
      target: string;
      detail: string;
      outcome: string;
    }>(
      `SELECT id, created_at, actor_name, action, target, detail, outcome
         FROM audit_logs WHERE event_id=$1 ORDER BY created_at DESC LIMIT 200`,
      [DEFAULT_EVENT_ID],
    ),
  ]);
  const event = eventResult.rows[0];
  const states = { good: goodState.rows[0], bad: badState.rows[0] };
  const draws = { good: goodDraws, bad: badDraws };
  if (!event || !states.good || !states.bad || participants.length === 0)
    throw new Error("EVENT_NOT_CONFIGURED");

  const poolSummaries = (Object.keys(states) as GiftPool[]).reduce(
    (all, pool) => {
      const state = states[pool]!;
      const currentDrawer = participants.find(
        (p) => p.id === state.current_participant_id,
      )!;
      all[pool] = {
        eventName: event.name,
        pool,
        paused: event.paused,
        total: participants.length,
        openedCount: draws[pool].length,
        remaining: participants.length - draws[pool].length,
        complete: state.complete,
        currentDrawer,
        opened: draws[pool],
        completedDrawerIds: draws[pool].map((draw) => draw.drawer.id),
        startParticipantId: state.start_participant_id,
      };
      return all;
    },
    {} as Record<GiftPool, Record<string, unknown>>,
  );

  const participantRows = participants.map((participant) => {
    const statusFor = (pool: GiftPool) =>
      draws[pool].some((draw) => draw.drawer.id === participant.id)
        ? "已完成"
        : states[pool]!.current_participant_id === participant.id
          ? "目前接棒"
          : "待抽";
    const giftFor = (pool: GiftPool) =>
      draws[pool].some((draw) => draw.provider.id === participant.id)
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
  const gifts = (Object.keys(draws) as GiftPool[]).flatMap((pool) =>
    participants.map((participant, index) => {
      const assignment = draws[pool].find(
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
  return {
    event: {
      name: event.name,
      status: event.paused ? "已暫停" : "進行中",
      rulesVersion: event.rules_version,
      participantCount: participants.length,
      updatedAt: event.updated_at.toISOString(),
    },
    paused: event.paused,
    pools: poolSummaries,
    participants: participantRows,
    gifts,
    auditLogs: auditResult.rows.map((row) => ({
      id: String(row.id),
      createdAt: row.created_at.toISOString(),
      actor: row.actor_name,
      action: row.action,
      target: row.target,
      detail: row.detail,
      outcome: row.outcome,
    })),
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
