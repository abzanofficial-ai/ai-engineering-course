// Database schema (architecture §5, ADR-0023). Auth tables follow Better Auth's generated
// shape and hold the global sign-in identity. Everything a tenant owns carries tenant_id and
// starts its primary key with (tenant_id, user_id); it cascades on user delete, so "delete my
// account" removes everything in one statement (UK GDPR).
import { sql } from "drizzle-orm";
import {
  check,
  jsonb,
  primaryKey,
  date,
  pgTable,
  text,
  bigint,
  timestamp,
  boolean,
  integer,
  index,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  /** Platform-wide role (ADR-0023): null, or "platform_owner". Tenant roles live in membership. */
  platformRole: text("platform_role"),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// ---------------------------------------------------------------------------
// Tenancy (ADR-0023). One default tenant today; training centres become tenants in Phase 2.

/** Tenant branding and settings (ADR-0024). Shape: TenantConfig in src/lib/branding.ts. */
export const tenant = pgTable("tenant", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull().default("active"),
  config: jsonb("config").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const TENANT_ROLES = ["tenant_admin", "tutor", "learner"] as const;

export const membership = pgTable(
  "membership",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenant.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("learner"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.userId] }),
    check("membership_role_check", sql`${t.role} in ('tenant_admin', 'tutor', 'learner')`),
    check("membership_status_check", sql`${t.status} in ('active', 'deactivated')`),
  ],
);

/** Which platform-owned courses a tenant offers, and which modules it has switched off. */
export const tenantCourse = pgTable(
  "tenant_course",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenant.id),
    course: text("course").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    disabledModules: jsonb("disabled_modules").$type<string[]>().notNull().default([]),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.course] })],
);

const tenantRef = () =>
  text("tenant_id")
    .notNull()
    .references(() => tenant.id);

// ---------------------------------------------------------------------------
// Learning state. Content is referenced by stable string keys (ADR-0009): no foreign keys
// into content, so re-imports can never delete progress. `client_ts` (ms) resolves offline
// replays with last-write-wins.

const userRef = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

export const sectionProgress = pgTable(
  "section_progress",
  {
    tenantId: tenantRef(),
    userId: userRef(),
    course: text("course").notNull(),
    pageKey: text("page_key").notNull(),
    sectionKey: text("section_key").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.userId, t.course, t.pageKey, t.sectionKey] })],
);

export const labStep = pgTable(
  "lab_step",
  {
    tenantId: tenantRef(),
    userId: userRef(),
    course: text("course").notNull(),
    pageKey: text("page_key").notNull(),
    labKey: text("lab_key").notNull(),
    stepKey: text("step_key").notNull(),
    done: boolean("done").notNull(),
    clientTs: bigint("client_ts", { mode: "number" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.userId, t.course, t.pageKey, t.labKey, t.stepKey] }),
  ],
);

export const labCompletion = pgTable(
  "lab_completion",
  {
    tenantId: tenantRef(),
    userId: userRef(),
    course: text("course").notNull(),
    pageKey: text("page_key").notNull(),
    labKey: text("lab_key").notNull(),
    committed: boolean("committed").notNull(),
    clientTs: bigint("client_ts", { mode: "number" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.userId, t.course, t.pageKey, t.labKey] })],
);

export const drillAnswer = pgTable(
  "drill_answer",
  {
    tenantId: tenantRef(),
    userId: userRef(),
    course: text("course").notNull(),
    pageKey: text("page_key").notNull(),
    answer: text("answer").notNull().default(""),
    revealed: boolean("revealed").notNull().default(false),
    clientTs: bigint("client_ts", { mode: "number" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.userId, t.course, t.pageKey] })],
);

export const cardReview = pgTable(
  "card_review",
  {
    tenantId: tenantRef(),
    userId: userRef(),
    course: text("course").notNull(),
    cardKey: text("card_key").notNull(),
    pageKey: text("page_key").notNull(),
    rating: text("rating").notNull(), // "confident" | "unsure"
    box: integer("box").notNull(), // Leitner box 1–5 (ADR-0016)
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    clientTs: bigint("client_ts", { mode: "number" }).notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.userId, t.course, t.cardKey] }),
    index("card_review_due_idx").on(t.userId, t.course, t.dueAt),
  ],
);

export const lastPosition = pgTable(
  "last_position",
  {
    tenantId: tenantRef(),
    userId: userRef(),
    course: text("course").notNull(),
    pageKey: text("page_key").notNull(),
    mode: text("mode").notNull(),
    sectionIndex: integer("section_index").notNull().default(0),
    clientTs: bigint("client_ts", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.userId, t.course] })],
);

export const checkpointAttempt = pgTable(
  "checkpoint_attempt",
  {
    tenantId: tenantRef(),
    userId: userRef(),
    course: text("course").notNull(),
    part: integer("part").notNull(),
    attempt: integer("attempt").notNull(),
    /** % of questions rated confident (ADR-0021). */
    score: integer("score").notNull(),
    passed: boolean("passed").notNull(),
    /** Card keys asked and how the learner rated each; the drill page and their answer. */
    detail: jsonb("detail").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.userId, t.course, t.part, t.attempt] })],
);

// ---------------------------------------------------------------------------
// Notes and bookmarks (ADR-0027). Both are learner text or choices, so both are personal data:
// tenant-scoped, exported, and deleted with the account.

export const bookmark = pgTable(
  "bookmark",
  {
    tenantId: tenantRef(),
    userId: userRef(),
    course: text("course").notNull(),
    pageKey: text("page_key").notNull(),
    sectionKey: text("section_key").notNull(),
    /** Kept as a flag (not a delete) so last-write-wins works across devices. */
    on: boolean("on").notNull(),
    clientTs: bigint("client_ts", { mode: "number" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.userId, t.course, t.pageKey, t.sectionKey] })],
);

export const note = pgTable(
  "note",
  {
    tenantId: tenantRef(),
    userId: userRef(),
    /** Chosen by the client (UUID) so a note made offline keeps its identity when it syncs. */
    id: text("id").notNull(),
    course: text("course").notNull(),
    pageKey: text("page_key").notNull(),
    sectionKey: text("section_key").notNull(),
    body: text("body").notNull(),
    /** Tombstone, so a delete on one device beats an older edit from another. */
    deleted: boolean("deleted").notNull().default(false),
    clientTs: bigint("client_ts", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.userId, t.id] }),
    index("note_page_idx").on(t.tenantId, t.userId, t.course, t.pageKey),
  ],
);

// ---------------------------------------------------------------------------
// Engagement (ADR-0019). Totals and streaks are computed, never stored.

export const xpEvent = pgTable(
  "xp_event",
  {
    tenantId: tenantRef(),
    userId: userRef(),
    course: text("course").notNull(),
    /** Idempotency key, e.g. "step:ch-1:lab:step-3"; the PK makes double awards impossible. */
    eventId: text("event_id").notNull(),
    points: integer("points").notNull(),
    label: text("label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.userId, t.course, t.eventId] }),
    index("xp_event_recent_idx").on(t.userId, t.course, t.createdAt),
  ],
);

export const activityDay = pgTable(
  "activity_day",
  {
    tenantId: tenantRef(),
    userId: userRef(),
    day: date("day", { mode: "string" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.userId, t.day] })],
);

export const userSettings = pgTable(
  "user_settings",
  {
    tenantId: tenantRef(),
    userId: userRef(),
    weeklyGoal: integer("weekly_goal").notNull().default(3),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.userId] })],
);

// ---------------------------------------------------------------------------
// Fixed-window rate limits for write endpoints (ADR-0012). Auth uses Better Auth's rate_limit.

export const rateLimitBucket = pgTable(
  "rate_limit_bucket",
  {
    key: text("key").notNull(),
    windowStart: bigint("window_start", { mode: "number" }).notNull(),
    count: integer("count").notNull(),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);
