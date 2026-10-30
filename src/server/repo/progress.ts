export { batchSchema, opSchema, type Op, type OpResult } from "@/lib/ops-schema";
// Applies a batch of learner actions (ADR-0009, ADR-0019): validates every key against the
// course, writes idempotent upserts with last-write-wins on client time, awards XP once per
// item and records the activity day — all in one transaction.
import { and, eq, sql } from "drizzle-orm";
import { addDays } from "@/lib/dates";
import { clampGoal, DRILL_MIN_CHARS, XP } from "@/lib/engagement";
import { nextReview } from "@/lib/srs";
import type { Batch, Op, OpResult } from "@/lib/ops-schema";
import type { Ctx } from "../context";
import { db, type Db } from "../db/client";
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
import { courseIndex, type CourseIndex } from "../course-index";

/** Accept the client's date only within ±1 day of the server's UTC date (ADR-0019). */
export function clampDay(day: string, now = new Date()): string {
  const utc = now.toISOString().slice(0, 10);
  if (day < addDays(utc, -1)) return addDays(utc, -1);
  if (day > addDays(utc, 1)) return addDays(utc, 1);
  return day;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function award(
  tx: Tx,
  tenantId: string,
  userId: string,
  course: string,
  eventId: string,
  points: number,
  label: string,
) {
  const rows = await tx
    .insert(xpEvent)
    .values({ tenantId, userId, course, eventId, points, label })
    .onConflictDoNothing()
    .returning({ points: xpEvent.points });
  return rows.length ? points : 0;
}

function validate(op: Op, idx: CourseIndex): string | null {
  switch (op.type) {
    case "section_read":
      return idx.learnSections.get(op.page)?.has(op.section) ? null : "unknown section";
    case "step":
      return idx.labSteps.get(op.page)?.get(op.lab)?.has(op.step) ? null : "unknown lab step";
    case "commit":
      return idx.labSteps.get(op.page)?.has(op.lab) ? null : "unknown lab";
    case "drill":
      return idx.drills.has(op.page) ? null : "unknown drill";
    case "card":
      return idx.cards.has(op.card) ? null : "unknown card";
    case "position":
      return idx.pages.has(op.page) ? null : "unknown page";
    case "goal":
      return null;
  }
}

/** Applies a batch for the learner in `ctx` (tenant and user scope come only from ctx). */
export async function applyOps(ctx: Ctx, batch: Batch, now = new Date()): Promise<OpResult[]> {
  const { tenantId, userId } = ctx;
  const idx = courseIndex(batch.course);
  if (!idx) return batch.ops.map(() => ({ ok: false, error: "unknown course" }));
  const course = batch.course;
  const day = clampDay(batch.day, now);

  return db().transaction(async (tx) => {
    const results: OpResult[] = [];
    for (const op of batch.ops) {
      const error = validate(op, idx);
      if (error) {
        results.push({ ok: false, error });
        continue;
      }
      let xp = 0;
      switch (op.type) {
        case "section_read":
          await tx
            .insert(sectionProgress)
            .values({ tenantId, userId, course, pageKey: op.page, sectionKey: op.section })
            .onConflictDoNothing();
          xp = await award(
            tx,
            tenantId,
            userId,
            course,
            `read:${op.page}:${op.section}`,
            XP.sectionRead,
            "Section read",
          );
          break;
        case "step":
          await tx
            .insert(labStep)
            .values({
              tenantId,
              userId,
              course,
              pageKey: op.page,
              labKey: op.lab,
              stepKey: op.step,
              done: op.done,
              clientTs: op.ts,
            })
            .onConflictDoUpdate({
              target: [
                labStep.tenantId,
                labStep.userId,
                labStep.course,
                labStep.pageKey,
                labStep.labKey,
                labStep.stepKey,
              ],
              set: { done: op.done, clientTs: op.ts, updatedAt: now },
              setWhere: sql`${labStep.clientTs} <= ${op.ts}`,
            });
          if (op.done)
            xp = await award(
              tx,
              tenantId,
              userId,
              course,
              `step:${op.page}:${op.lab}:${op.step}`,
              XP.labStep,
              "Lab step done",
            );
          break;
        case "commit":
          await tx
            .insert(labCompletion)
            .values({
              tenantId,
              userId,
              course,
              pageKey: op.page,
              labKey: op.lab,
              committed: op.done,
              clientTs: op.ts,
            })
            .onConflictDoUpdate({
              target: [
                labCompletion.tenantId,
                labCompletion.userId,
                labCompletion.course,
                labCompletion.pageKey,
                labCompletion.labKey,
              ],
              set: { committed: op.done, clientTs: op.ts, updatedAt: now },
              setWhere: sql`${labCompletion.clientTs} <= ${op.ts}`,
            });
          if (op.done)
            xp = await award(
              tx,
              tenantId,
              userId,
              course,
              `commit:${op.page}:${op.lab}`,
              XP.labCommitted,
              "Lab committed",
            );
          break;
        case "drill":
          await tx
            .insert(drillAnswer)
            .values({
              tenantId,
              userId,
              course,
              pageKey: op.page,
              answer: op.answer,
              revealed: op.revealed,
              clientTs: op.ts,
            })
            .onConflictDoUpdate({
              target: [
                drillAnswer.tenantId,
                drillAnswer.userId,
                drillAnswer.course,
                drillAnswer.pageKey,
              ],
              set: { answer: op.answer, revealed: op.revealed, clientTs: op.ts, updatedAt: now },
              setWhere: sql`${drillAnswer.clientTs} <= ${op.ts}`,
            });
          if (op.revealed && op.answer.trim().length >= DRILL_MIN_CHARS)
            xp = await award(
              tx,
              tenantId,
              userId,
              course,
              `drill:${op.page}`,
              XP.drillAnswered,
              "Decision drill answered",
            );
          break;
        case "card": {
          const [prev] = await tx
            .select({ box: cardReview.box, clientTs: cardReview.clientTs })
            .from(cardReview)
            .where(
              and(
                eq(cardReview.tenantId, tenantId),
                eq(cardReview.userId, userId),
                eq(cardReview.course, course),
                eq(cardReview.cardKey, op.card),
              ),
            );
          if (!prev || prev.clientTs <= op.ts) {
            const next = nextReview(prev?.box ?? null, op.rating, now);
            await tx
              .insert(cardReview)
              .values({
                tenantId,
                userId,
                course,
                cardKey: op.card,
                pageKey: idx.cards.get(op.card)!,
                rating: op.rating,
                box: next.box,
                dueAt: next.dueAt,
                clientTs: op.ts,
              })
              .onConflictDoUpdate({
                target: [
                  cardReview.tenantId,
                  cardReview.userId,
                  cardReview.course,
                  cardReview.cardKey,
                ],
                set: {
                  rating: op.rating,
                  box: next.box,
                  dueAt: next.dueAt,
                  clientTs: op.ts,
                  reviewedAt: now,
                },
              });
          }
          xp = await award(
            tx,
            tenantId,
            userId,
            course,
            `card:${op.card}`,
            XP.cardRated,
            "Flashcard rated",
          );
          break;
        }
        case "position":
          await tx
            .insert(lastPosition)
            .values({
              tenantId,
              userId,
              course,
              pageKey: op.page,
              mode: op.mode,
              sectionIndex: op.index,
              clientTs: op.ts,
            })
            .onConflictDoUpdate({
              target: [lastPosition.tenantId, lastPosition.userId, lastPosition.course],
              set: { pageKey: op.page, mode: op.mode, sectionIndex: op.index, clientTs: op.ts },
              setWhere: sql`${lastPosition.clientTs} <= ${op.ts}`,
            });
          break;
        case "goal":
          await tx
            .insert(userSettings)
            .values({ tenantId, userId, weeklyGoal: clampGoal(op.weeklyGoal) })
            .onConflictDoUpdate({
              target: [userSettings.tenantId, userSettings.userId],
              set: { weeklyGoal: clampGoal(op.weeklyGoal), updatedAt: now },
            });
          break;
      }
      results.push(xp ? { ok: true, xp } : { ok: true });
    }
    // Any learning action counts towards the streak, even when its XP was already earned.
    if (results.some((r, i) => r.ok && !["position", "goal"].includes(batch.ops[i]!.type))) {
      await tx.insert(activityDay).values({ tenantId, userId, day }).onConflictDoNothing();
    }
    return results;
  });
}
