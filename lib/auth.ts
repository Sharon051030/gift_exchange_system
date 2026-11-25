import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { db } from "./db";

export const auth = betterAuth({
  appName: "Christmas Mystery Gift",
  database: db,
  emailAndPassword: {
    enabled: true,
    disableSignUp: process.env.ALLOW_ADMIN_BOOTSTRAP !== "true",
    minPasswordLength: 12,
    maxPasswordLength: 128,
    autoSignIn: false,
  },
  session: {
    expiresIn: 60 * 60 * 12,
    updateAge: 60 * 30,
    storeSessionInDatabase: true,
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": { window: 60 * 10, max: 5 },
    },
  },
  plugins: [
    admin({ defaultRole: "viewer", adminRoles: ["admin"] }),
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
