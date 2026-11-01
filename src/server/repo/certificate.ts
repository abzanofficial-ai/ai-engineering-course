// Certificates (ADR-0029), scoped to ctx (ADR-0023). Eligibility is recomputed from the
// database on every claim; the client's view of its own progress is never trusted.
import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { eligibility, isEligible, type Scope } from "@/lib/certificates";
import type { Ctx } from "../context";
import { courseIndex } from "../course-index";
import { db } from "../db/client";
import { certificate, user } from "../db/schema";
import { loadState } from "./state";
import { courseAccess } from "./tenant";

export interface CertificateRow {
  id: string;
  course: string;
  scope: string;
  nameSnapshot: string;
  issuedAt: Date;
}

export type ClaimResult =
  | { ok: true; certificate: CertificateRow; created: boolean }
  | { ok: false; error: "unknown course" | "name required" | "not eligible" };

const columns = {
  id: certificate.id,
  course: certificate.course,
  scope: certificate.scope,
  nameSnapshot: certificate.nameSnapshot,
  issuedAt: certificate.issuedAt,
};

const mine = (ctx: Ctx) =>
  and(eq(certificate.tenantId, ctx.tenantId), eq(certificate.userId, ctx.userId));

/** 128 random bits, URL-safe (22 characters). */
export const newCertificateId = () => randomBytes(16).toString("base64url");

export async function claimCertificate(
  ctx: Ctx,
  course: string,
  scope: Scope,
  now = new Date(),
): Promise<ClaimResult> {
  const idx = courseIndex(course);
  const access = idx ? await courseAccess(ctx.tenantId, course) : null;
  if (!idx || !access?.enabled) return { ok: false, error: "unknown course" };

  const [existing] = await db()
    .select(columns)
    .from(certificate)
    .where(and(mine(ctx), eq(certificate.course, course), eq(certificate.scope, scope)));
  if (existing) return { ok: true, certificate: existing, created: false };

  const state = await loadState(ctx, course, now.toISOString().slice(0, 10));
  if (!isEligible(eligibility(idx.manifest, state), scope))
    return { ok: false, error: "not eligible" };

  const [me] = await db().select({ name: user.name }).from(user).where(eq(user.id, ctx.userId));
  const name = me?.name?.trim() ?? "";
  if (!name) return { ok: false, error: "name required" };

  const [row] = await db()
    .insert(certificate)
    .values({
      id: newCertificateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      course,
      scope,
      nameSnapshot: name,
      issuedAt: now,
    })
    .onConflictDoNothing()
    .returning(columns);
  if (row) return { ok: true, certificate: row, created: true };
  // A concurrent claim won the race: return the one that exists.
  const [again] = await db()
    .select(columns)
    .from(certificate)
    .where(and(mine(ctx), eq(certificate.course, course), eq(certificate.scope, scope)));
  return { ok: true, certificate: again!, created: false };
}

export async function listCertificates(ctx: Ctx): Promise<CertificateRow[]> {
  return db()
    .select(columns)
    .from(certificate)
    .where(mine(ctx))
    .orderBy(desc(certificate.issuedAt));
}

/** Deletes one of the learner's own certificates; false when it is not theirs or not found. */
export async function deleteCertificate(ctx: Ctx, id: string): Promise<boolean> {
  const rows = await db()
    .delete(certificate)
    .where(and(mine(ctx), eq(certificate.id, id)))
    .returning({ id: certificate.id });
  return rows.length > 0;
}

/**
 * Public verification by unguessable id: only what the certificate itself shows. Not scoped to
 * a learner by design (anyone with the link may verify it).
 */
export async function verifyCertificate(id: string) {
  if (!/^[A-Za-z0-9_-]{22}$/.test(id)) return null;
  const [row] = await db()
    .select({
      id: certificate.id,
      tenantId: certificate.tenantId,
      course: certificate.course,
      scope: certificate.scope,
      name: certificate.nameSnapshot,
      issuedAt: certificate.issuedAt,
    })
    .from(certificate)
    .where(eq(certificate.id, id));
  return row ?? null;
}
