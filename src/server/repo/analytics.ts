// Aggregate analytics (ADR-0032). Visits are counters by day and source; a learner's signup
// source is one row, deleted with their account. Reports are counts only, never lists of people.
import { and, count, countDistinct, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { Source } from "@/lib/attribution";
import type { Ctx } from "../context";
import { courseIndex } from "../course-index";
import { db } from "../db/client";
import {
  activityDay,
  checkpointAttempt,
  entitlement,
  membership,
  sectionProgress,
  signupSource,
  trafficDaily,
} from "../db/schema";

/** Counts one visit (an entry to the site by a visitor who is not signed in). */
export async function recordVisit(tenantId: string, day: string, s: Source): Promise<void> {
  await db()
    .insert(trafficDaily)
    .values({ tenantId, day, ...s, visits: 1 })
    .onConflictDoUpdate({
      target: [
        trafficDaily.tenantId,
        trafficDaily.day,
        trafficDaily.source,
        trafficDaily.medium,
        trafficDaily.campaign,
      ],
      set: { visits: sql`${trafficDaily.visits} + 1` },
    });
}

/** How long after joining a source still counts as the signup's source. */
export const SIGNUP_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Records where the learner came from, once, and only within a day of joining this tenant. */
export async function recordSignupSource(ctx: Ctx, s: Source, now = new Date()): Promise<boolean> {
  const [m] = await db()
    .select({ createdAt: membership.createdAt })
    .from(membership)
    .where(and(eq(membership.tenantId, ctx.tenantId), eq(membership.userId, ctx.userId)));
  if (!m || now.getTime() - m.createdAt.getTime() > SIGNUP_WINDOW_MS) return false;
  const rows = await db()
    .insert(signupSource)
    .values({ tenantId: ctx.tenantId, userId: ctx.userId, ...s })
    .onConflictDoNothing()
    .returning({ userId: signupSource.userId });
  return rows.length > 0;
}

export interface SourceRow {
  source: string;
  medium: string;
  visits: number;
  signups: number;
}

export interface AnalyticsOverview {
  from: string;
  to: string;
  course: string;
  totals: { visits: number; signups: number; activeLearners: number; learnerPlaces: number };
  bySource: SourceRow[];
  weekly: { week: string; activeLearners: number }[];
  chapters: { key: string; label: string; title: string; started: number; finished: number }[];
  checkpoints: { part: number; attempted: number; passed: number }[];
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Platform admin: the funnel and learning summary for one tenant and course. `from` and `to`
 * are days (UTC, `to` exclusive). Chapter and checkpoint figures cover all time, since learners
 * work through the course over months.
 */
export async function analyticsOverview(
  tenantId: string,
  course: string,
  from: Date,
  to: Date,
): Promise<AnalyticsOverview> {
  const [fromDay, toDay] = [isoDay(from), isoDay(to)];
  const joined = and(
    eq(membership.tenantId, tenantId),
    gte(membership.createdAt, from),
    lt(membership.createdAt, to),
  );

  const [visitRows, [signups], sourceRows, [active], [places], weekly, chapterRows, cpRows] =
    await Promise.all([
      db()
        .select({
          source: trafficDaily.source,
          medium: trafficDaily.medium,
          visits: sql<number>`sum(${trafficDaily.visits})::int`,
        })
        .from(trafficDaily)
        .where(
          and(
            eq(trafficDaily.tenantId, tenantId),
            gte(trafficDaily.day, fromDay),
            lt(trafficDaily.day, toDay),
          ),
        )
        .groupBy(trafficDaily.source, trafficDaily.medium),
      db().select({ n: count() }).from(membership).where(joined),
      db()
        .select({ source: signupSource.source, medium: signupSource.medium, n: count() })
        .from(signupSource)
        .innerJoin(
          membership,
          and(
            eq(membership.tenantId, signupSource.tenantId),
            eq(membership.userId, signupSource.userId),
          ),
        )
        .where(joined)
        .groupBy(signupSource.source, signupSource.medium),
      db()
        .select({ n: countDistinct(activityDay.userId) })
        .from(activityDay)
        .where(
          and(
            eq(activityDay.tenantId, tenantId),
            gte(activityDay.day, fromDay),
            lt(activityDay.day, toDay),
          ),
        ),
      db()
        .select({ n: count() })
        .from(entitlement)
        .where(
          and(
            eq(entitlement.tenantId, tenantId),
            eq(entitlement.course, course),
            inArray(entitlement.source, ["direct", "seat"]),
            gte(entitlement.createdAt, from),
            lt(entitlement.createdAt, to),
          ),
        ),
      db()
        .select({
          week: sql<string>`to_char(date_trunc('week', ${activityDay.day}::timestamp), 'YYYY-MM-DD')`,
          n: countDistinct(activityDay.userId),
        })
        .from(activityDay)
        .where(
          and(
            eq(activityDay.tenantId, tenantId),
            gte(activityDay.day, fromDay),
            lt(activityDay.day, toDay),
          ),
        )
        .groupBy(sql`1`)
        .orderBy(sql`1`),
      // Learners per (chapter, number of Learn sections read): small however many learners.
      db().execute<{ page_key: string; n: number; learners: number }>(sql`
        select page_key, n::int, count(*)::int as learners
        from (
          select ${sectionProgress.pageKey} as page_key, count(*) as n
          from ${sectionProgress}
          where ${sectionProgress.tenantId} = ${tenantId} and ${sectionProgress.course} = ${course}
          group by ${sectionProgress.pageKey}, ${sectionProgress.userId}
        ) per_learner
        group by page_key, n`),
      db()
        .select({
          part: checkpointAttempt.part,
          attempted: countDistinct(checkpointAttempt.userId),
          passed: sql<number>`count(distinct ${checkpointAttempt.userId}) filter (where ${checkpointAttempt.passed})::int`,
        })
        .from(checkpointAttempt)
        .where(and(eq(checkpointAttempt.tenantId, tenantId), eq(checkpointAttempt.course, course)))
        .groupBy(checkpointAttempt.part)
        .orderBy(checkpointAttempt.part),
    ]);

  // Signups without a recorded source came direct (we only record sources that were known).
  const signupTotal = signups?.n ?? 0;
  const bySource = new Map<string, SourceRow>();
  const row = (source: string, medium: string) => {
    const k = `${source}\u0000${medium}`;
    if (!bySource.has(k)) bySource.set(k, { source, medium, visits: 0, signups: 0 });
    return bySource.get(k)!;
  };
  for (const v of visitRows) row(v.source, v.medium).visits += Number(v.visits);
  let attributed = 0;
  for (const s of sourceRows) {
    row(s.source, s.medium).signups += s.n;
    attributed += s.n;
  }
  if (signupTotal - attributed > 0) row("direct", "").signups += signupTotal - attributed;

  const idx = courseIndex(course);
  const learnCount = idx?.learnSections ?? new Map<string, Set<string>>();
  const perPage = new Map<string, { started: number; finished: number }>();
  for (const r of chapterRows) {
    const p = perPage.get(r.page_key) ?? { started: 0, finished: 0 };
    p.started += r.learners;
    if (r.n >= (learnCount.get(r.page_key)?.size ?? Infinity)) p.finished += r.learners;
    perPage.set(r.page_key, p);
  }
  const chapters = (idx?.manifest.pages ?? [])
    .filter((p) => p.status === "published" && (learnCount.get(p.key)?.size ?? 0) > 0)
    .map((p) => ({
      key: p.key,
      label: p.label,
      title: p.title,
      ...(perPage.get(p.key) ?? { started: 0, finished: 0 }),
    }));

  return {
    from: fromDay,
    to: toDay,
    course,
    totals: {
      visits: visitRows.reduce((n, v) => n + Number(v.visits), 0),
      signups: signupTotal,
      activeLearners: active?.n ?? 0,
      learnerPlaces: places?.n ?? 0,
    },
    bySource: [...bySource.values()].sort(
      (a, b) => b.signups - a.signups || b.visits - a.visits || a.source.localeCompare(b.source),
    ),
    weekly: weekly.map((w) => ({ week: w.week, activeLearners: w.n })),
    chapters,
    checkpoints: cpRows.map((c) => ({
      part: c.part,
      attempted: c.attempted,
      passed: Number(c.passed),
    })),
  };
}
