import { Pool, type PoolClient } from "pg";

const globalDatabase = globalThis as typeof globalThis & {
  giftExchangePool?: Pool;
};

export const db =
  globalDatabase.giftExchangePool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 8_000,
    allowExitOnIdle: process.env.NODE_ENV !== "production",
  });

if (process.env.NODE_ENV !== "production") {
  globalDatabase.giftExchangePool = db;
}

export function hasDatabaseConfiguration() {
  return Boolean(process.env.DATABASE_URL);
}

export async function withTransaction<T>(
  operation: (client: PoolClient) => Promise<T>,
) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
