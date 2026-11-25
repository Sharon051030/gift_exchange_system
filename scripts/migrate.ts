import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "../lib/db";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

await db.query(`CREATE TABLE IF NOT EXISTS app_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
)`);

const directory = join(process.cwd(), "db", "migrations");
const files = (await readdir(directory))
  .filter((name) => /^\d+_.*\.sql$/.test(name))
  .sort();

for (const name of files) {
  const applied = await db.query("SELECT 1 FROM app_migrations WHERE name=$1", [
    name,
  ]);
  if (applied.rowCount) continue;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(await readFile(join(directory, name), "utf8"));
    await client.query("INSERT INTO app_migrations(name) VALUES($1)", [name]);
    await client.query("COMMIT");
    console.info(`Applied ${name}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

await db.end();
