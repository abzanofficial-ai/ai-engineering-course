// Data export and deletion (UK GDPR rights of access and erasure). Export covers the
// current tenant (ADR-0023); deletion removes the global identity and, by cascade, the
// learner's data in every tenant.
import { and, eq } from "drizzle-orm";
import type { Ctx } from "../context";
import { db } from "../db/client";
import * as t from "../db/schema";

const PERSONAL_TABLES = {
  sectionProgress: t.sectionProgress,
  labSteps: t.labStep,
  labCompletions: t.labCompletion,
  drillAnswers: t.drillAnswer,
  cardReviews: t.cardReview,
  lastPositions: t.lastPosition,
  xpEvents: t.xpEvent,
  activityDays: t.activityDay,
  settings: t.userSettings,
} as const;

export async function exportUserData(ctx: Ctx) {
  const { tenantId, userId } = ctx;
  const [profile] = await db()
    .select({ id: t.user.id, name: t.user.name, email: t.user.email, createdAt: t.user.createdAt })
    .from(t.user)
    .where(eq(t.user.id, userId));
  const accounts = await db()
    .select({ provider: t.account.providerId, createdAt: t.account.createdAt })
    .from(t.account)
    .where(eq(t.account.userId, userId));
  const data: Record<string, unknown[]> = {};
  for (const [name, table] of Object.entries(PERSONAL_TABLES)) {
    data[name] = await db()
      .select()
      .from(table)
      .where(and(eq(table.tenantId, tenantId), eq(table.userId, userId)));
  }
  return {
    exportedAt: new Date().toISOString(),
    tenant: tenantId,
    profile,
    signInMethods: accounts,
    ...data,
  };
}

/** Deletes the user; every personal table cascades (schema.ts). */
export async function deleteUser(ctx: Ctx): Promise<void> {
  await db().delete(t.user).where(eq(t.user.id, ctx.userId));
}

/** Updates the name shown on certificates (identity-level). */
export async function updateName(ctx: Ctx, name: string): Promise<void> {
  await db().update(t.user).set({ name }).where(eq(t.user.id, ctx.userId));
}
