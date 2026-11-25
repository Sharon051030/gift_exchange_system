import { db } from "../lib/db";

const email =
  process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLocaleLowerCase("en-US");
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Gift Exchange Admin";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!email || !password || password.length < 12) {
  throw new Error(
    "Set BOOTSTRAP_ADMIN_EMAIL and a BOOTSTRAP_ADMIN_PASSWORD of at least 12 characters.",
  );
}

process.env.ALLOW_ADMIN_BOOTSTRAP = "true";
const { auth } = await import("../lib/auth");
const created = await auth.api.signUpEmail({ body: { email, password, name } });
await db.query(`UPDATE "user" SET role='admin' WHERE id=$1`, [created.user.id]);
console.info(
  `Created admin account for ${email}. Remove bootstrap password variables now.`,
);
await db.end();
