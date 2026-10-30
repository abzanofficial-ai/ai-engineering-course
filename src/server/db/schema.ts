// Database schema (architecture §5). Auth tables follow Better Auth's generated shape;
// every personal table starts its primary key with user_id and cascades on user delete,
// so "delete my account" removes everything in one statement (UK GDPR).
import {
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
  role: text("role").default("learner"),
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
    userId: userRef(),
    course: text("course").notNull(),
    pageKey: text("page_key").notNull(),
    sectionKey: text("section_key").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.course, t.pageKey, t.sectionKey] })],
);

export const labStep = pgTable(
  "lab_step",
  {
    userId: userRef(),
    course: text("course").notNull(),
    pageKey: text("page_key").notNull(),
    labKey: text("lab_key").notNull(),
    stepKey: text("step_key").notNull(),
    done: boolean("done").notNull(),
    clientTs: bigint("client_ts", { mode: "number" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.course, t.pageKey, t.labKey, t.stepKey] })],
);

export const labCompletion = pgTable(
  "lab_completion",
  {
    userId: userRef(),
    course: text("course").notNull(),
    pageKey: text("page_key").notNull(),
    labKey: text("lab_key").notNull(),
    committed: boolean("committed").notNull(),
    clientTs: bigint("client_ts", { mode: "number" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.course, t.pageKey, t.labKey] })],
);

export const drillAnswer = pgTable(
  "drill_answer",
  {
    userId: userRef(),
    course: text("course").notNull(),
    pageKey: text("page_key").notNull(),
    answer: text("answer").notNull().default(""),
    revealed: boolean("revealed").notNull().default(false),
    clientTs: bigint("client_ts", { mode: "number" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.course, t.pageKey] })],
);

export const cardReview = pgTable(
  "card_review",
  {
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
    primaryKey({ columns: [t.userId, t.course, t.cardKey] }),
    index("card_review_due_idx").on(t.userId, t.course, t.dueAt),
  ],
);

export const lastPosition = pgTable(
  "last_position",
  {
    userId: userRef(),
    course: text("course").notNull(),
    pageKey: text("page_key").notNull(),
    mode: text("mode").notNull(),
    sectionIndex: integer("section_index").notNull().default(0),
    clientTs: bigint("client_ts", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.course] })],
);

// ---------------------------------------------------------------------------
// Engagement (ADR-0019). Totals and streaks are computed, never stored.

export const xpEvent = pgTable(
  "xp_event",
  {
    userId: userRef(),
    course: text("course").notNull(),
    /** Idempotency key, e.g. "step:ch-1:lab:step-3"; the PK makes double awards impossible. */
    eventId: text("event_id").notNull(),
    points: integer("points").notNull(),
    label: text("label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.course, t.eventId] }),
    index("xp_event_recent_idx").on(t.userId, t.course, t.createdAt),
  ],
);

export const activityDay = pgTable(
  "activity_day",
  {
    userId: userRef(),
    day: date("day", { mode: "string" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);

export const userSettings = pgTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  weeklyGoal: integer("weekly_goal").notNull().default(3),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

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
