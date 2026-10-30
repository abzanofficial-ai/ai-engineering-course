// Data export and deletion (UK GDPR rights of access and erasure).
import { eq } from "drizzle-orm";
import type { Db } from "./db/client";
import * as t from "./db/schema";

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

export async function exportUserData(db: Db, userId: string) {
  const [profile] = await db
    .select({ id: t.user.id, name: t.user.name, email: t.user.email, createdAt: t.user.createdAt })
    .from(t.user)
    .where(eq(t.user.id, userId));
  const accounts = await db
    .select({ provider: t.account.providerId, createdAt: t.account.createdAt })
    .from(t.account)
    .where(eq(t.account.userId, userId));
  const data: Record<string, unknown[]> = {};
  for (const [name, table] of Object.entries(PERSONAL_TABLES)) {
    data[name] = await db.select().from(table).where(eq(table.userId, userId));
  }
  return { exportedAt: new Date().toISOString(), profile, signInMethods: accounts, ...data };
}

/** Deletes the user; every personal table cascades (schema.ts). */
export async function deleteUser(db: Db, userId: string): Promise<void> {
  await db.delete(t.user).where(eq(t.user.id, userId));
}
