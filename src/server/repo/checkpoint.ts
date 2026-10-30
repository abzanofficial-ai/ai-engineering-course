// Part checkpoint submissions (ADR-0021), scoped to ctx (ADR-0023). The client draws the
// questions; the server re-derives the expected set, validates it, scores it and awards XP.
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  partContent,
  pickDrill,
  scoreCheckpoint,
  seedFor,
  selectQuestions,
} from "@/lib/checkpoint";
import { isDay } from "@/lib/dates";
import { XP } from "@/lib/engagement";
import { nextReview } from "@/lib/srs";
import type { Ctx } from "../context";
import { courseIndex } from "../course-index";
import { db } from "../db/client";
import { activityDay, cardReview, checkpointAttempt, xpEvent } from "../db/schema";
import { clampDay, isDisabled } from "./progress";
import { loadAccess, pageAccess } from "./commerce";
import { courseAccess } from "./tenant";

export const checkpointSchema = z.object({
  course: z.string().min(1).max(200),
  part: z.number().int().min(1).max(99),
  day: z.string().refine(isDay),
  ratings: z.record(z.string().max(200), z.enum(["confident", "unsure"])),
  answer: z.string().max(10_000),
});

export type CheckpointResult =
  | { ok: true; attempt: number; score: number; passed: boolean; xp: number }
  | { ok: false; error: string };

export async function submitCheckpoint(
  ctx: Ctx,
  input: z.infer<typeof checkpointSchema>,
  now = new Date(),
): Promise<CheckpointResult> {
  const { tenantId, userId } = ctx;
  const idx = courseIndex(input.course);
  if (!idx) return { ok: false, error: "unknown course" };
  const access = await courseAccess(tenantId, input.course);
  const content = partContent(idx.manifest, input.part);
  if (
    !access.enabled ||
    !content.cards.length ||
    isDisabled(access.disabledModules, content.drillPages[0] ?? "", idx)
  )
    return { ok: false, error: "checkpoint not available" };
  // ADR-0030: a checkpoint covers the part's paid pages, so it needs the same access.
  if (
    !pageAccess(await loadAccess(ctx, input.course, now), { key: "", partNumber: input.part })
      .allowed
  )
    return { ok: false, error: "no access" };

  return db().transaction(async (tx) => {
    const [{ n }] = (await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(checkpointAttempt)
      .where(
        and(
          eq(checkpointAttempt.tenantId, tenantId),
          eq(checkpointAttempt.userId, userId),
          eq(checkpointAttempt.course, input.course),
          eq(checkpointAttempt.part, input.part),
        ),
      )) as [{ n: number }];
    const attempt = n + 1;

    // The answered questions must be exactly the set drawn for this attempt.
    const expected = selectQuestions(content.cards, seedFor(input.part, attempt));
    const given = Object.keys(input.ratings);
    if (given.length !== expected.length || !expected.every((k) => k in input.ratings))
      return { ok: false as const, error: "questions do not match this attempt" };

    const drillPage = pickDrill(content.drillPages, attempt);
    const { score, passed } = scoreCheckpoint(input.ratings, input.answer);
    await tx.insert(checkpointAttempt).values({
      tenantId,
      userId,
      course: input.course,
      part: input.part,
      attempt,
      score,
      passed,
      detail: { ratings: input.ratings, drillPage, answer: input.answer },
    });

    let xp = 0;
    if (passed) {
      const rows = await tx
        .insert(xpEvent)
        .values({
          tenantId,
          userId,
          course: input.course,
          eventId: `checkpoint:part-${input.part}`,
          points: XP.checkpointPassed,
          label: `Part ${input.part} checkpoint passed`,
        })
        .onConflictDoNothing()
        .returning({ p: xpEvent.points });
      xp = rows.length ? XP.checkpointPassed : 0;
    }
    // Unsure answers join spaced-repetition review, due tomorrow.
    for (const [cardKey, rating] of Object.entries(input.ratings)) {
      if (rating !== "unsure") continue;
      const next = nextReview(null, "unsure", now);
      await tx
        .insert(cardReview)
        .values({
          tenantId,
          userId,
          course: input.course,
          cardKey,
          pageKey: idx.cards.get(cardKey)!,
          rating,
          box: next.box,
          dueAt: next.dueAt,
          clientTs: now.getTime(),
        })
        .onConflictDoUpdate({
          target: [cardReview.tenantId, cardReview.userId, cardReview.course, cardReview.cardKey],
          set: {
            rating,
            box: next.box,
            dueAt: next.dueAt,
            clientTs: now.getTime(),
            reviewedAt: now,
          },
        });
    }
    await tx
      .insert(activityDay)
      .values({ tenantId, userId, day: clampDay(input.day, now) })
      .onConflictDoNothing();
    return { ok: true as const, attempt, score, passed, xp };
  });
}
