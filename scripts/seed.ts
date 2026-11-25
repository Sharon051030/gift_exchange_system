import { db } from "../lib/db";
import { createParticipants } from "../lib/demo-store";
import { DEFAULT_EVENT_ID } from "../lib/event-repository";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const participants = createParticipants();
const client = await db.connect();
try {
  await client.query("BEGIN");
  await client.query(
    `INSERT INTO events(id, name) VALUES($1, 'Christmas Mystery Gift')
     ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name`,
    [DEFAULT_EVENT_ID],
  );
  for (const [index, participant] of participants.entries()) {
    await client.query(
      `INSERT INTO participants(id,event_id,name,initials,avatar_tone,message,sort_order)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, initials=EXCLUDED.initials,
       avatar_tone=EXCLUDED.avatar_tone, message=EXCLUDED.message, sort_order=EXCLUDED.sort_order`,
      [
        participant.id,
        DEFAULT_EVENT_ID,
        participant.name,
        participant.initials,
        participant.avatarTone,
        participant.message,
        index + 1,
      ],
    );
  }
  await client.query(
    `INSERT INTO pool_states(event_id,pool,start_participant_id,current_participant_id)
     VALUES($1,'good',$2,$2),($1,'bad',$3,$3)
     ON CONFLICT (event_id,pool) DO NOTHING`,
    [DEFAULT_EVENT_ID, participants[0]!.id, participants[17]!.id],
  );
  await client.query("COMMIT");
  console.info(`Seeded ${participants.length} participants.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await db.end();
}
