// Loads one learner's state for one course. Every query is filtered by the tenant and user in
// `ctx` — the only way personal data leaves the database (architecture §8, ADR-0023).
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { addDays, weekStart } from "@/lib/dates";
import { streakFrom, weekFrom } from "@/lib/engagement";
import type { LearnerState } from "@/lib/learner-state";
import type { Ctx } from "../context";
import { db as getDb } from "../db/client";
import {
  activityDay,
  cardReview,
  drillAnswer,
  labCompletion,
  labStep,
  lastPosition,
  sectionProgress,
  userSettings,
  xpEvent,
} from "../db/schema";

export async function loadState(ctx: Ctx, course: string, today: string): Promise<LearnerState> {
  const { tenantId, userId } = ctx;
  const db = getDb();
  const mine = (t: { tenantId: AnyPgColumn; userId: AnyPgColumn; course: AnyPgColumn }) =>
    and(eq(t.tenantId, tenantId), eq(t.userId, userId), eq(t.course, course));

  const [reads, steps, commits, drills, cards, last, xpTotal, xpWeek, recent, days, settings] =
    await Promise.all([
      db
        .select({ p: sectionProgress.pageKey, s: sectionProgress.sectionKey })
        .from(sectionProgress)
        .where(mine(sectionProgress)),
      db
        .select({ p: labStep.pageKey, l: labStep.labKey, s: labStep.stepKey })
        .from(labStep)
        .where(and(mine(labStep), eq(labStep.done, true))),
      db
        .select({ p: labCompletion.pageKey, l: labCompletion.labKey })
        .from(labCompletion)
        .where(and(mine(labCompletion), eq(labCompletion.committed, true))),
      db
        .select({ p: drillAnswer.pageKey, a: drillAnswer.answer, r: drillAnswer.revealed })
        .from(drillAnswer)
        .where(mine(drillAnswer)),
      db
        .select({ c: cardReview.cardKey, r: cardReview.rating })
        .from(cardReview)
        .where(mine(cardReview)),
      db.select().from(lastPosition).where(mine(lastPosition)).limit(1),
      db
        .select({ n: sql<number>`coalesce(sum(${xpEvent.points}), 0)::int` })
        .from(xpEvent)
        .where(mine(xpEvent)),
      db
        .select({ n: sql<number>`coalesce(sum(${xpEvent.points}), 0)::int` })
        .from(xpEvent)
        .where(
          and(mine(xpEvent), gte(xpEvent.createdAt, new Date(`${weekStart(today)}T00:00:00Z`))),
        ),
      db
        .select({ label: xpEvent.label, points: xpEvent.points, at: xpEvent.createdAt })
        .from(xpEvent)
        .where(mine(xpEvent))
        .orderBy(desc(xpEvent.createdAt))
        .limit(10),
      db
        .select({ d: activityDay.day })
        .from(activityDay)
        .where(
          and(
            eq(activityDay.tenantId, tenantId),
            eq(activityDay.userId, userId),
            gte(activityDay.day, addDays(today, -400)),
          ),
        ),
      db
        .select({ g: userSettings.weeklyGoal })
        .from(userSettings)
        .where(and(eq(userSettings.tenantId, tenantId), eq(userSettings.userId, userId))),
    ]);

  const state: LearnerState = {
    read: {},
    steps: {},
    commits: {},
    drills: {},
    cards: {},
    last: last[0]
      ? { pageKey: last[0].pageKey, mode: last[0].mode, sectionIndex: last[0].sectionIndex }
      : null,
    xp: {
      total: xpTotal[0]?.n ?? 0,
      week: xpWeek[0]?.n ?? 0,
      recent: recent.map((r) => ({ label: r.label, points: r.points, at: r.at.toISOString() })),
    },
    streak: { streak: 0, activeToday: false, freezesLeft: 0 },
    week: { days: [], active: 0, goal: 3 },
  };
  for (const r of reads) (state.read[r.p] ??= []).push(r.s);
  for (const r of steps) ((state.steps[r.p] ??= {})[r.l] ??= []).push(r.s);
  for (const r of commits) (state.commits[r.p] ??= []).push(r.l);
  for (const r of drills) state.drills[r.p] = { answer: r.a, revealed: r.r };
  for (const r of cards) state.cards[r.c] = r.r as "confident" | "unsure";
  const daySet = new Set(days.map((d) => d.d));
  state.streak = streakFrom(daySet, today);
  state.week = weekFrom(daySet, today, settings[0]?.g ?? 3);
  return state;
}
