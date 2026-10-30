// The commercial model (ADR-0030): who may use a course, seat-pack join codes, admin grants and
// centre licence usage. Learner functions take ctx; platform functions are called only after
// can(actor, "platform:entitlements:manage") and name their tenant explicitly.
import { randomUUID } from "node:crypto";
import { and, count, desc, eq, gt, gte, isNull, lt, lte, or, sql } from "drizzle-orm";
import { isPublicPage } from "@/content/config";
import { brandingFor } from "@/lib/branding";
import { decideAccess, isFreeTierPage, licenceInvoice, type AccessDecision } from "@/lib/plans";
import type { Ctx } from "../context";
import { db } from "../db/client";
import { activityDay, entitlement, membership, seatPack, tenantLicence, user } from "../db/schema";
import { hashJoinCode, newJoinCode, normaliseJoinCode } from "../join-code";
import { getTenant } from "./tenant";

/** Everything the access rule needs for one learner and course, loaded once per request. */
export interface AccessContext {
  launchOpen: boolean;
  licenceActive: boolean;
  membershipActive: boolean;
  entitled: boolean;
  publicPages: string[];
  freeTier: string[];
}

const activeNow = (now: Date) =>
  and(
    isNull(entitlement.revokedAt),
    lte(entitlement.startsAt, now),
    or(isNull(entitlement.endsAt), gt(entitlement.endsAt, now)),
  );

export async function loadAccess(
  ctx: Ctx,
  course: string,
  now = new Date(),
): Promise<AccessContext> {
  const brand = brandingFor((await getTenant(ctx.tenantId)).config);
  const [[lic], [mem], [ent]] = await Promise.all([
    db()
      .select({
        status: tenantLicence.status,
        endsAt: tenantLicence.endsAt,
        startsAt: tenantLicence.startsAt,
      })
      .from(tenantLicence)
      .where(eq(tenantLicence.tenantId, ctx.tenantId)),
    db()
      .select({ status: membership.status })
      .from(membership)
      .where(and(eq(membership.tenantId, ctx.tenantId), eq(membership.userId, ctx.userId))),
    db()
      .select({ n: count() })
      .from(entitlement)
      .where(
        and(
          eq(entitlement.tenantId, ctx.tenantId),
          eq(entitlement.userId, ctx.userId),
          eq(entitlement.course, course),
          activeNow(now),
        ),
      ),
  ]);
  return {
    launchOpen: brand.access.launchOpenToAllSignedIn,
    licenceActive: Boolean(
      lic && lic.status === "active" && lic.startsAt <= now && (!lic.endsAt || lic.endsAt > now),
    ),
    membershipActive: mem?.status === "active",
    entitled: (ent?.n ?? 0) > 0,
    publicPages: brand.access.publicPages,
    freeTier: brand.access.freeTier,
  };
}

/** The access rule for a signed-in learner and one page (or the whole course when page is null). */
export function pageAccess(
  a: AccessContext,
  page: { key: string; partNumber: number } | null,
): AccessDecision {
  return decideAccess({
    isPublic: page ? isPublicPage(a.publicPages, page.key) : false,
    signedIn: true,
    launchOpen: a.launchOpen,
    licenceActive: a.licenceActive,
    membershipActive: a.membershipActive,
    entitled: a.entitled,
    isFreeTier: page ? isFreeTierPage(a.freeTier, page.key, page.partNumber) : false,
  });
}

export interface MyAccess {
  via: AccessDecision;
  entitlements: {
    id: string;
    source: string;
    plan: string | null;
    orgName: string | null;
    endsAt: Date | null;
  }[];
}

/** What the Account page shows: how the learner has access, and until when. */
export async function myAccess(ctx: Ctx, course: string, now = new Date()): Promise<MyAccess> {
  const a = await loadAccess(ctx, course, now);
  const rows = await db()
    .select({
      id: entitlement.id,
      source: entitlement.source,
      plan: entitlement.plan,
      orgName: seatPack.orgName,
      endsAt: entitlement.endsAt,
    })
    .from(entitlement)
    .leftJoin(seatPack, eq(seatPack.id, entitlement.seatPackId))
    .where(
      and(
        eq(entitlement.tenantId, ctx.tenantId),
        eq(entitlement.userId, ctx.userId),
        eq(entitlement.course, course),
        activeNow(now),
      ),
    )
    .orderBy(desc(entitlement.createdAt));
  return { via: pageAccess(a, null), entitlements: rows };
}

export type RedeemResult =
  | { ok: true; course: string; orgName: string; endsAt: Date; already: boolean }
  | { ok: false; error: "invalid" | "expired" | "full" };

/**
 * Redeems a seat-pack join code for the learner in ctx. The pack row is locked while seats are
 * counted, so two learners cannot take the last seat at once.
 */
export async function redeemJoinCode(
  ctx: Ctx,
  code: string,
  now = new Date(),
): Promise<RedeemResult> {
  if (normaliseJoinCode(code).length !== 12) return { ok: false, error: "invalid" };
  return db().transaction(async (tx) => {
    const [pack] = await tx
      .select()
      .from(seatPack)
      .where(and(eq(seatPack.codeHash, hashJoinCode(code)), eq(seatPack.tenantId, ctx.tenantId)))
      .for("update");
    if (!pack || pack.revokedAt) return { ok: false, error: "invalid" };

    const [mine] = await tx
      .select({ endsAt: entitlement.endsAt })
      .from(entitlement)
      .where(and(eq(entitlement.seatPackId, pack.id), eq(entitlement.userId, ctx.userId)));
    if (mine)
      return {
        ok: true,
        course: pack.course,
        orgName: pack.orgName,
        endsAt: mine.endsAt!,
        already: true,
      };

    if (pack.redeemBy && pack.redeemBy < now) return { ok: false, error: "expired" };
    const [usedRow] = await tx
      .select({ used: count() })
      .from(entitlement)
      .where(eq(entitlement.seatPackId, pack.id));
    if ((usedRow?.used ?? 0) >= pack.seats) return { ok: false, error: "full" };

    const endsAt = new Date(now);
    endsAt.setUTCMonth(endsAt.getUTCMonth() + pack.accessMonths);
    await tx.insert(entitlement).values({
      id: randomUUID(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      course: pack.course,
      source: "seat",
      plan: "seat-pack",
      seatPackId: pack.id,
      startsAt: now,
      endsAt,
    });
    return { ok: true, course: pack.course, orgName: pack.orgName, endsAt, already: false };
  });
}

// ---------------------------------------------------------------------------
// Platform administration (callers must hold platform:entitlements:manage)

export async function userIdByEmail(email: string): Promise<string | null> {
  const [row] = await db()
    .select({ id: user.id })
    .from(user)
    .where(eq(sql`lower(${user.email})`, email.trim().toLowerCase()));
  return row?.id ?? null;
}

export interface GrantInput {
  tenantId: string;
  userId: string;
  course: string;
  source: "direct" | "admin";
  plan?: string | null;
  endsAt?: Date | null;
  /** Payment provider reference; repeating a grant with the same reference changes nothing. */
  externalRef?: string | null;
  note?: string | null;
}

/** The single way access is granted (admin screen now, payment webhooks in Phase 4). */
export async function grantEntitlement(
  g: GrantInput,
  now = new Date(),
): Promise<{ id: string; created: boolean }> {
  const id = randomUUID();
  const rows = await db()
    .insert(entitlement)
    .values({
      id,
      tenantId: g.tenantId,
      userId: g.userId,
      course: g.course,
      source: g.source,
      plan: g.plan ?? null,
      externalRef: g.externalRef ?? null,
      note: g.note ?? null,
      startsAt: now,
      endsAt: g.endsAt ?? null,
    })
    .onConflictDoNothing({ target: entitlement.externalRef })
    .returning({ id: entitlement.id });
  if (rows.length) return { id, created: true };
  const [existing] = await db()
    .select({ id: entitlement.id })
    .from(entitlement)
    .where(eq(entitlement.externalRef, g.externalRef!));
  return { id: existing!.id, created: false };
}

export async function revokeEntitlement(id: string, now = new Date()): Promise<boolean> {
  const rows = await db()
    .update(entitlement)
    .set({ revokedAt: now })
    .where(and(eq(entitlement.id, id), isNull(entitlement.revokedAt)))
    .returning({ id: entitlement.id });
  return rows.length > 0;
}

export async function listEntitlements(tenantId: string, now = new Date()) {
  return db()
    .select({
      id: entitlement.id,
      email: user.email,
      name: user.name,
      course: entitlement.course,
      source: entitlement.source,
      plan: entitlement.plan,
      orgName: seatPack.orgName,
      startsAt: entitlement.startsAt,
      endsAt: entitlement.endsAt,
      active: sql<boolean>`${entitlement.revokedAt} is null and (${entitlement.endsAt} is null or ${entitlement.endsAt} > ${now.toISOString()}::timestamptz)`,
    })
    .from(entitlement)
    .innerJoin(user, eq(user.id, entitlement.userId))
    .leftJoin(seatPack, eq(seatPack.id, entitlement.seatPackId))
    .where(eq(entitlement.tenantId, tenantId))
    .orderBy(desc(entitlement.createdAt))
    .limit(500);
}

export interface SeatPackInput {
  tenantId: string;
  course: string;
  orgName: string;
  seats: number;
  accessMonths: number;
  redeemBy?: Date | null;
}

/** Creates a pack and returns its join code: the only time the code is ever visible. */
export async function createSeatPack(p: SeatPackInput): Promise<{ id: string; code: string }> {
  const id = randomUUID();
  const code = newJoinCode();
  await db()
    .insert(seatPack)
    .values({
      id,
      tenantId: p.tenantId,
      course: p.course,
      orgName: p.orgName.trim(),
      seats: p.seats,
      accessMonths: p.accessMonths,
      codeHash: hashJoinCode(code),
      codeHint: code.slice(-4),
      redeemBy: p.redeemBy ?? null,
    });
  return { id, code };
}

/** A new code for a pack (e.g. the old one leaked); learners who already joined keep access. */
export async function regenerateSeatCode(packId: string): Promise<string | null> {
  const code = newJoinCode();
  const rows = await db()
    .update(seatPack)
    .set({ codeHash: hashJoinCode(code), codeHint: code.slice(-4) })
    .where(and(eq(seatPack.id, packId), isNull(seatPack.revokedAt)))
    .returning({ id: seatPack.id });
  return rows.length ? code : null;
}

/** Stops new redemptions; learners who already joined keep their access until it ends. */
export async function revokeSeatPack(packId: string, now = new Date()): Promise<boolean> {
  const rows = await db()
    .update(seatPack)
    .set({ revokedAt: now })
    .where(and(eq(seatPack.id, packId), isNull(seatPack.revokedAt)))
    .returning({ id: seatPack.id });
  return rows.length > 0;
}

export async function listSeatPacks(tenantId: string) {
  return db()
    .select({
      id: seatPack.id,
      course: seatPack.course,
      orgName: seatPack.orgName,
      seats: seatPack.seats,
      used: sql<number>`count(${entitlement.id})::int`,
      accessMonths: seatPack.accessMonths,
      codeHint: seatPack.codeHint,
      redeemBy: seatPack.redeemBy,
      revokedAt: seatPack.revokedAt,
      createdAt: seatPack.createdAt,
    })
    .from(seatPack)
    .leftJoin(entitlement, eq(entitlement.seatPackId, seatPack.id))
    .where(eq(seatPack.tenantId, tenantId))
    .groupBy(seatPack.id)
    .orderBy(desc(seatPack.createdAt));
}

export interface LicenceInput {
  plan: string;
  basePence: number;
  includedLearners: number;
  extraLearnerPence: number;
  status: "active" | "suspended";
  endsAt?: Date | null;
}

export async function setTenantLicence(tenantId: string, l: LicenceInput): Promise<void> {
  await db()
    .insert(tenantLicence)
    .values({ tenantId, ...l, endsAt: l.endsAt ?? null })
    .onConflictDoUpdate({
      target: tenantLicence.tenantId,
      set: { ...l, endsAt: l.endsAt ?? null },
    });
}

/**
 * A centre's active learners in a calendar month (UTC) and the invoice that follows: members
 * with at least one learning day in the month. Deactivated members still count for the days
 * they were active.
 */
export async function licenceUsage(tenantId: string, month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("month must be YYYY-MM");
  const start = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const end = new Date(Date.UTC(y!, m!, 1)).toISOString().slice(0, 10);
  const [[lic], [activeRow]] = await Promise.all([
    db().select().from(tenantLicence).where(eq(tenantLicence.tenantId, tenantId)),
    db()
      .select({ active: sql<number>`count(distinct ${activityDay.userId})::int` })
      .from(activityDay)
      .innerJoin(
        membership,
        and(
          eq(membership.tenantId, activityDay.tenantId),
          eq(membership.userId, activityDay.userId),
        ),
      )
      .where(
        and(
          eq(activityDay.tenantId, tenantId),
          gte(activityDay.day, start),
          lt(activityDay.day, end),
        ),
      ),
  ]);
  const active = activeRow?.active ?? 0;
  return {
    month,
    activeLearners: active,
    licence: lic ?? null,
    invoice: lic ? licenceInvoice(active, lic) : null,
  };
}
