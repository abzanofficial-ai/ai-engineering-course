// The commercial model (ADR-0030) against a real database: the access rule's every route in,
// seat packs (including the race for the last seat), admin grants and licence usage.
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { activityDay, membership } from "@/server/db/schema";
import { exportUserData, deleteUser } from "@/server/repo/account";
import {
  createSeatPack,
  grantEntitlement,
  licenceUsage,
  listSeatPacks,
  loadAccess,
  myAccess,
  pageAccess,
  redeemJoinCode,
  regenerateSeatCode,
  revokeEntitlement,
  revokeSeatPack,
  setTenantLicence,
} from "@/server/repo/commerce";
import { clearTenantCaches, DEFAULT_TENANT_ID } from "@/server/repo/tenant";
import { COURSE, makeUser } from "./helpers";

const CLOSED = "tnt_test_closed"; // a tenant with launch mode off, as after billing launches
const ctx = (userId: string, tenantId = CLOSED) => ({ tenantId, userId });
const CH3 = { key: "ch-3", partNumber: 1 }; // free tier ("part:1")
const CH9 = { key: "ch-9", partNumber: 2 }; // paid
const START = { key: "start-how-to-use-this-book", partNumber: 0 }; // public

async function member(userId: string, tenantId = CLOSED, status = "active") {
  await db().insert(membership).values({ tenantId, userId, role: "learner", status });
}

beforeEach(async () => {
  await db().execute(
    sql`insert into tenant (id, slug, config) values (${CLOSED}, 'closed-centre', ${JSON.stringify({
      access: { launchOpenToAllSignedIn: false },
    })}::jsonb) on conflict do nothing`,
  );
  await db().execute(
    sql`insert into tenant_course (tenant_id, course) values (${CLOSED}, ${COURSE}) on conflict do nothing`,
  );
  clearTenantCaches();
});

describe("the access rule", () => {
  it("launch mode gives every signed-in learner the course (today's default tenant)", async () => {
    const u = await makeUser();
    expect(pageAccess(await loadAccess(ctx(u, DEFAULT_TENANT_ID), COURSE), CH9)).toEqual({
      allowed: true,
      via: "launch",
    });
  });

  it("with launch mode off: public and free tier are open, paid needs access", async () => {
    const u = await makeUser();
    await member(u);
    const a = await loadAccess(ctx(u), COURSE);
    expect(pageAccess(a, START)).toEqual({ allowed: true, via: "public" });
    expect(pageAccess(a, CH3)).toEqual({ allowed: true, via: "free" });
    expect(pageAccess(a, CH9)).toEqual({ allowed: false, reason: "plans" });
  });

  it("an admin grant opens the course; revoking or expiry closes it", async () => {
    const u = await makeUser();
    await member(u);
    const g = await grantEntitlement({
      tenantId: CLOSED,
      userId: u,
      course: COURSE,
      source: "admin",
    });
    expect(pageAccess(await loadAccess(ctx(u), COURSE), CH9)).toEqual({
      allowed: true,
      via: "entitlement",
    });
    expect((await myAccess(ctx(u), COURSE)).entitlements.map((e) => e.source)).toEqual(["admin"]);
    expect(await revokeEntitlement(g.id)).toBe(true);
    expect(await revokeEntitlement(g.id)).toBe(false);
    expect(pageAccess(await loadAccess(ctx(u), COURSE), CH9).allowed).toBe(false);

    await grantEntitlement({
      tenantId: CLOSED,
      userId: u,
      course: COURSE,
      source: "admin",
      endsAt: new Date(Date.now() - 1000),
    });
    expect(pageAccess(await loadAccess(ctx(u), COURSE), CH9).allowed).toBe(false);
  });

  it("payment grants are idempotent on the provider's reference", async () => {
    const u = await makeUser();
    const g = {
      tenantId: CLOSED,
      userId: u,
      course: COURSE,
      source: "direct" as const,
      externalRef: "sub_123",
    };
    const first = await grantEntitlement(g);
    const again = await grantEntitlement(g);
    expect(first.created).toBe(true);
    expect(again).toEqual({ id: first.id, created: false });
  });

  it("a centre licence covers its active members only while active", async () => {
    const [u, gone] = [await makeUser(), await makeUser()];
    await member(u);
    await member(gone, CLOSED, "deactivated");
    await setTenantLicence(CLOSED, {
      plan: "centre-licence",
      basePence: 30000,
      includedLearners: 30,
      extraLearnerPence: 600,
      status: "active",
    });
    expect(pageAccess(await loadAccess(ctx(u), COURSE), CH9)).toEqual({
      allowed: true,
      via: "licence",
    });
    expect(pageAccess(await loadAccess(ctx(gone), COURSE), CH9).allowed).toBe(false);
    await setTenantLicence(CLOSED, {
      plan: "centre-licence",
      basePence: 30000,
      includedLearners: 30,
      extraLearnerPence: 600,
      status: "suspended",
    });
    expect(pageAccess(await loadAccess(ctx(u), COURSE), CH9).allowed).toBe(false);
  });

  it("access in one tenant gives nothing in another", async () => {
    const u = await makeUser();
    await member(u);
    await grantEntitlement({
      tenantId: DEFAULT_TENANT_ID,
      userId: u,
      course: COURSE,
      source: "admin",
    });
    expect(pageAccess(await loadAccess(ctx(u), COURSE), CH9).allowed).toBe(false);
  });
});

describe("seat packs", () => {
  const pack = (seats: number, extra: Partial<Parameters<typeof createSeatPack>[0]> = {}) =>
    createSeatPack({
      tenantId: CLOSED,
      course: COURSE,
      orgName: "Example Training Ltd",
      seats,
      accessMonths: 12,
      ...extra,
    });

  it("redeems up to the number of seats, once per learner, for the access period", async () => {
    const { code } = await pack(2);
    const [a, b, c] = [await makeUser(), await makeUser(), await makeUser()];
    const now = new Date("2026-11-01T10:00:00Z");
    const ra = await redeemJoinCode(ctx(a), code.toLowerCase().replaceAll("-", " "), now);
    expect(ra).toMatchObject({ ok: true, already: false, orgName: "Example Training Ltd" });
    if (ra.ok) expect(ra.endsAt.toISOString()).toBe("2027-11-01T10:00:00.000Z");
    expect(await redeemJoinCode(ctx(a), code, now)).toMatchObject({ ok: true, already: true });
    expect(await redeemJoinCode(ctx(b), code, now)).toMatchObject({ ok: true, already: false });
    expect(await redeemJoinCode(ctx(c), code, now)).toEqual({ ok: false, error: "full" });
    await member(a);
    expect(pageAccess(await loadAccess(ctx(a), COURSE, now), CH9)).toEqual({
      allowed: true,
      via: "entitlement",
    });
    expect((await listSeatPacks(CLOSED))[0]).toMatchObject({
      seats: 2,
      used: 2,
      codeHint: code.slice(-4),
    });
  });

  it("two learners racing for the last seat: exactly one gets it", async () => {
    const { code } = await pack(1);
    const users = await Promise.all(Array.from({ length: 6 }, () => makeUser()));
    const results = await Promise.all(users.map((u) => redeemJoinCode(ctx(u), code)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.error === "full")).toBe(true);
  });

  it("refuses wrong, revoked, expired, regenerated-away and other-tenant codes", async () => {
    const u = await makeUser();
    expect(await redeemJoinCode(ctx(u), "AAAA-BBBB-CCCC")).toEqual({ ok: false, error: "invalid" });
    expect(await redeemJoinCode(ctx(u), "short")).toEqual({ ok: false, error: "invalid" });

    const revoked = await pack(5);
    await revokeSeatPack(revoked.id);
    expect(await redeemJoinCode(ctx(u), revoked.code)).toEqual({ ok: false, error: "invalid" });

    const late = await pack(5, { redeemBy: new Date(Date.now() - 1000) });
    expect(await redeemJoinCode(ctx(u), late.code)).toEqual({ ok: false, error: "expired" });

    const rotated = await pack(5);
    const fresh = await regenerateSeatCode(rotated.id);
    expect(await redeemJoinCode(ctx(u), rotated.code)).toEqual({ ok: false, error: "invalid" });
    expect(await redeemJoinCode(ctx(u), fresh!)).toMatchObject({ ok: true });

    const elsewhere = await createSeatPack({
      tenantId: DEFAULT_TENANT_ID,
      course: COURSE,
      orgName: "Other",
      seats: 5,
      accessMonths: 12,
    });
    expect(await redeemJoinCode(ctx(u), elsewhere.code)).toEqual({ ok: false, error: "invalid" });
  });

  it("seat access is in the learner's export and goes with the account", async () => {
    const { code } = await pack(3);
    const u = await makeUser();
    await redeemJoinCode(ctx(u), code);
    const exported = (await exportUserData(ctx(u))) as unknown as Record<string, unknown[]>;
    expect(exported.entitlements).toHaveLength(1);
    await deleteUser(ctx(u));
    expect((await listSeatPacks(CLOSED))[0]!.used).toBe(0);
  });
});

describe("licence usage", () => {
  it("counts members with a learning day in the month and prices the invoice", async () => {
    await setTenantLicence(CLOSED, {
      plan: "centre-licence",
      basePence: 30000,
      includedLearners: 1,
      extraLearnerPence: 600,
      status: "active",
    });
    const [a, b, c] = [await makeUser(), await makeUser(), await makeUser()];
    for (const u of [a, b, c]) await member(u);
    await db()
      .insert(activityDay)
      .values([
        { tenantId: CLOSED, userId: a, day: "2026-10-03" },
        { tenantId: CLOSED, userId: a, day: "2026-10-20" },
        { tenantId: CLOSED, userId: b, day: "2026-10-31" },
        { tenantId: CLOSED, userId: c, day: "2026-11-01" }, // next month
      ]);
    const usage = await licenceUsage(CLOSED, "2026-10");
    expect(usage.activeLearners).toBe(2);
    expect(usage.invoice).toEqual({ base: 30000, extra: 1, extraPence: 600, total: 30600 });
    expect((await licenceUsage(CLOSED, "2026-11")).activeLearners).toBe(1);
    await expect(licenceUsage(CLOSED, "2026-13")).rejects.toThrow();
  });
});
