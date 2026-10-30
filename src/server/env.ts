// Server configuration, validated once at start-up (architecture §8, OWASP A05).
// Every external service is optional; missing values select a safe local default.
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().default("postgres://lms:lms_local_only@localhost:5432/lms"),
  AUTH_SECRET: z.string().min(32).optional(),
  RESEND_API_KEY: z.string().optional(),
  /** Optional override of the tenant's email sender (ADR-0024), e.g. for a verified domain. */
  EMAIL_FROM: z.string().optional(),
  /** "memory" captures emails in-process (tests); "mailpit" posts to the local Mailpit API. */
  EMAIL_TRANSPORT: z.enum(["auto", "memory", "mailpit", "console", "file"]).default("auto"),
  /** "file" transport (end-to-end tests only): append emails as JSON lines to this path. */
  MAIL_FILE: z.string().default(".cache/e2e-mail.jsonl"),
  /** Per-IP auth rate limiting. "off" only for local end-to-end runs (all sign-ins share one IP). */
  AUTH_RATE_LIMIT: z.enum(["on", "off"]).default("on"),
  MAILPIT_URL: z.string().url().default("http://localhost:8025"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  /** Comma-separated emails that get the admin role on sign-up (no UI to self-promote). */
  ADMIN_EMAILS: z.string().default(""),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
  const parsed = schema.parse(raw);
  if (parsed.NODE_ENV === "production" && !parsed.AUTH_SECRET) {
    throw new Error("AUTH_SECRET must be set in production (openssl rand -base64 32)");
  }
  const local = /^http:\/\/localhost(:\d+)?$/.test(parsed.APP_URL);
  if (!local && (parsed.EMAIL_TRANSPORT === "file" || parsed.AUTH_RATE_LIMIT === "off")) {
    throw new Error(
      "EMAIL_TRANSPORT=file and AUTH_RATE_LIMIT=off are for local end-to-end tests only",
    );
  }
  cached = parsed;
  return parsed;
}

/** Development/test fallback secret; production refuses to start without AUTH_SECRET. */
export function authSecret(): string {
  return env().AUTH_SECRET ?? "local-development-secret-not-for-production-use-0000";
}

export function googleEnabled(): boolean {
  const e = env();
  return Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET);
}
