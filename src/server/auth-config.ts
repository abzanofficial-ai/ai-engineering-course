// Authentication (ADR-0005): email magic link + optional Google, sessions in Postgres.
import { createHash } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { db } from "./db/client";
import * as schema from "./db/schema";
import { magicLinkEmail, sendEmail } from "./email";
import { authSecret, env, googleEnabled } from "./env";
import { log } from "./log";
import { allow } from "./rate-limit";

const hashEmail = (email: string) =>
  createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 16);
const adminEmails = () =>
  new Set(
    env()
      .ADMIN_EMAILS.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );

function createAuth() {
  return betterAuth({
    appName: "AI Engineering Handbook",
    baseURL: env().APP_URL,
    secret: authSecret(),
    trustedOrigins: [env().APP_URL],
    database: drizzleAdapter(db(), { provider: "pg", schema }),
    user: {
      // Platform role only; tenant roles live in membership (ADR-0023).
      additionalFields: { platformRole: { type: "string", required: false, input: false } },
    },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    socialProviders: googleEnabled()
      ? { google: { clientId: env().GOOGLE_CLIENT_ID!, clientSecret: env().GOOGLE_CLIENT_SECRET! } }
      : {},
    account: { accountLinking: { enabled: true, trustedProviders: ["google"] } },
    // Per-IP limits on every auth endpoint; magic-link requests are tighter.
    rateLimit: {
      enabled: env().NODE_ENV !== "test" && env().AUTH_RATE_LIMIT === "on",
      storage: "database",
      window: 60,
      max: 30,
      customRules: { "/sign-in/magic-link": { window: 3600, max: 20 } },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: {
              ...user,
              platformRole: adminEmails().has(user.email.toLowerCase()) ? "platform_owner" : null,
            },
          }),
        },
      },
    },
    plugins: [
      magicLink({
        expiresIn: 600,
        sendMagicLink: async ({ email, url }) => {
          // Per-address limit on top of the per-IP one: 5 links per hour (architecture §6.3).
          if (!(await allow(`magic:${hashEmail(email)}`, 5, 3600))) {
            log.warn("auth.magic_link_rate_limited", { email: hashEmail(email) });
            throw new Error("Too many sign-in links requested. Try again in an hour.");
          }
          await sendEmail(magicLinkEmail(email, url));
          log.info("auth.magic_link_sent", { email: hashEmail(email) });
        },
      }),
      nextCookies(),
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;
let instance: Auth | null = null;

/** Created on first use, so builds need no secrets; production refuses to start without one. */
export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}
