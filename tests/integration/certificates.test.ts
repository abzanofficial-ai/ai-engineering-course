// Certificates (ADR-0029): server-side eligibility, idempotent claims, public verification that
// reveals nothing else, and isolation between learners and tenants. Synthetic learners only.
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as listRoute from "@/app/api/me/certificates/route";
import * as oneRoute from "@/app/api/me/certificates/[id]/route";
import * as exportRoute from "@/app/api/me/export/route";
import { generated } from "@generated/index";
import { specOf } from "@/lib/learner-state";
import type { Op } from "@/lib/ops-schema";
import { db } from "@/server/db/client";
import { checkpointAttempt, user } from "@/server/db/schema";
import { deleteUser, updateName } from "@/server/repo/account";
import {
  claimCertificate,
  deleteCertificate,
  listCertificates,
  verifyCertificate,
} from "@/server/repo/certificate";
import { applyOps } from "@/server/repo/progress";
import { DEFAULT_TENANT_ID } from "@/server/repo/tenant";
import { req, signIn } from "./auth-helpers";
import { COURSE, makeUser, TODAY } from "./helpers";

const m = generated[COURSE]!.manifest;
const ctx = (userId: string, tenantId = DEFAULT_TENANT_ID) => ({ tenantId, userId });

/** Every item of every published Part 1 chapter, as the learner's own actions. */
function finishPart1(): Op[] {
  const ops: Op[] = [];
  for (const p of m.pages.filter((x) => x.partNumber === 1 && x.status === "published")) {
    const s = specOf(p);
    for (const section of s.learn) ops.push({ type: "section_read", page: p.key, section, ts: 1 });
    for (const lab of s.labs) {
      for (const step of lab.steps)
        ops.push({ type: "step", page: p.key, lab: lab.key, step, done: true, ts: 1 });
      ops.push({ type: "commit", page: p.key, lab: lab.key, done: true, ts: 1 });
    }
    if (s.drill)
      ops.push({
        type: "drill",
        page: p.key,
        answer: "A considered answer.",
        revealed: true,
        ts: 1,
      });
    for (const card of s.cards) ops.push({ type: "card", card, rating: "confident", ts: 1 });
  }
  return ops;
}

async function eligibleLearner(userId: string, tenantId = DEFAULT_TENANT_ID) {
  const ops = finishPart1();
  for (let i = 0; i < ops.length; i += 100)
    await applyOps(ctx(userId, tenantId), {
      course: COURSE,
      day: TODAY,
      ops: ops.slice(i, i + 100),
    });
  await db().insert(checkpointAttempt).values({
    tenantId,
    userId,
    course: COURSE,
    part: 1,
    attempt: 1,
    score: 90,
    passed: true,
    detail: {},
  });
}

describe("claiming a certificate", () => {
  it("refuses until the part is complete and the checkpoint passed", async () => {
    const u = await makeUser("Ada Learner");
    expect(await claimCertificate(ctx(u), COURSE, "part:1")).toEqual({
      ok: false,
      error: "not eligible",
    });
    const ops = finishPart1();
    await applyOps(ctx(u), { course: COURSE, day: TODAY, ops: ops.slice(0, 100) });
    expect(await claimCertificate(ctx(u), COURSE, "part:1")).toMatchObject({ ok: false });
  });

  it("issues once with the learner's name, and again returns the same certificate", async () => {
    const u = await makeUser("Ada Learner");
    await eligibleLearner(u);
    const first = await claimCertificate(ctx(u), COURSE, "part:1");
    expect(first).toMatchObject({ ok: true, created: true });
    if (!first.ok) throw new Error("expected a certificate");
    expect(first.certificate.id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(first.certificate.nameSnapshot).toBe("Ada Learner");

    const again = await claimCertificate(ctx(u), COURSE, "part:1");
    expect(again).toMatchObject({ ok: true, created: false });
    if (again.ok) expect(again.certificate.id).toBe(first.certificate.id);

    // Renaming later does not change an issued certificate.
    await updateName(ctx(u), "Ada L. Learner");
    expect((await verifyCertificate(first.certificate.id))?.name).toBe("Ada Learner");
    expect(await claimCertificate(ctx(u), COURSE, "course")).toEqual({
      ok: false,
      error: "not eligible",
    });
  });

  it("needs a name on the account", async () => {
    const u = await makeUser("x");
    await db().update(user).set({ name: "" }).where(eq(user.id, u));
    await eligibleLearner(u);
    expect(await claimCertificate(ctx(u), COURSE, "part:1")).toEqual({
      ok: false,
      error: "name required",
    });
  });
});

describe("verification and privacy", () => {
  it("the public lookup shows only what the certificate shows", async () => {
    const u = await makeUser("Ada Learner");
    await eligibleLearner(u);
    const r = await claimCertificate(ctx(u), COURSE, "part:1");
    if (!r.ok) throw new Error("expected a certificate");
    const v = await verifyCertificate(r.certificate.id);
    expect(Object.keys(v!).sort()).toEqual([
      "course",
      "id",
      "issuedAt",
      "name",
      "scope",
      "tenantId",
    ]);
    expect(JSON.stringify(v)).not.toContain(u); // never the user id or email
    expect(await verifyCertificate("not-a-real-id")).toBeNull();
    expect(await verifyCertificate("A".repeat(22))).toBeNull();
  });

  it("another learner cannot list or delete it; the owner can, and the link stops working", async () => {
    const a = await signIn("cert-a@example.test");
    const b = await signIn("cert-b@example.test");
    const [ua] = await db()
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, "cert-a@example.test"));
    await updateName(ctx(ua!.id), "Learner A");
    await eligibleLearner(ua!.id);

    const claim = await listRoute.POST(
      req("/api/me/certificates", a, { method: "POST", json: { course: COURSE, scope: "part:1" } }),
    );
    expect(claim.status).toBe(201);
    const { certificate } = await claim.json();

    // B: not eligible, sees nothing, cannot delete A's.
    const bClaim = await listRoute.POST(
      req("/api/me/certificates", b, { method: "POST", json: { course: COURSE, scope: "part:1" } }),
    );
    expect(bClaim.status).toBe(403);
    expect(
      (await (await listRoute.GET(req("/api/me/certificates", b))).json()).certificates,
    ).toEqual([]);
    const bDelete = await oneRoute.DELETE(
      req(`/api/me/certificates/${certificate.id}`, b, { method: "DELETE", json: {} }),
      { params: Promise.resolve({ id: certificate.id }) },
    );
    expect(bDelete.status).toBe(404);
    expect(await verifyCertificate(certificate.id)).not.toBeNull();
    expect(await (await exportRoute.GET(req("/api/me/export", b))).text()).not.toContain(
      certificate.id,
    );

    // A: listed and exported; deleting it removes the public link.
    expect(
      (await (await listRoute.GET(req("/api/me/certificates", a))).json()).certificates,
    ).toHaveLength(1);
    expect(await (await exportRoute.GET(req("/api/me/export", a))).text()).toContain(
      certificate.id,
    );
    const del = await oneRoute.DELETE(
      req(`/api/me/certificates/${certificate.id}`, a, { method: "DELETE", json: {} }),
      { params: Promise.resolve({ id: certificate.id }) },
    );
    expect(del.status).toBe(204);
    expect(await verifyCertificate(certificate.id)).toBeNull();
  });

  it("rejects unknown scopes and signed-out requests", async () => {
    const a = await signIn("cert-scope@example.test");
    for (const scope of ["part:0", "part:99x", "everything"]) {
      const r = await listRoute.POST(
        req("/api/me/certificates", a, { method: "POST", json: { course: COURSE, scope } }),
      );
      expect(r.status).toBe(400);
    }
    expect((await listRoute.GET(req("/api/me/certificates", null))).status).toBe(401);
  });

  it("is tenant-scoped and removed with the account", async () => {
    const OTHER = "tnt_test_certs";
    await db().execute(
      sql`insert into tenant (id, slug, config) values (${OTHER}, 'cert-centre', '{}'::jsonb) on conflict do nothing`,
    );
    await db().execute(
      sql`insert into tenant_course (tenant_id, course) values (${OTHER}, ${COURSE}) on conflict do nothing`,
    );
    const u = await makeUser("Two Tenant");
    await eligibleLearner(u);
    const r = await claimCertificate(ctx(u), COURSE, "part:1");
    expect(r.ok).toBe(true);
    expect(await listCertificates(ctx(u, OTHER))).toEqual([]);
    expect(await claimCertificate(ctx(u, OTHER), COURSE, "part:1")).toEqual({
      ok: false,
      error: "not eligible",
    });
    if (r.ok) expect(await deleteCertificate(ctx(u, OTHER), r.certificate.id)).toBe(false);

    await deleteUser(ctx(u));
    if (r.ok) expect(await verifyCertificate(r.certificate.id)).toBeNull();
  });
});
