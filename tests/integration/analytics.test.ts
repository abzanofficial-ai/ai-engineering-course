// Aggregate analytics (ADR-0032): anonymous visit counters, a new learner's source recorded
// once, and the owner's summary. Synthetic data only.
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import * as adminAnalytics from "@/app/api/admin/analytics/route";
import * as exportRoute from "@/app/api/me/export/route";
import * as attribution from "@/app/api/me/attribution/route";
import * as visit from "@/app/api/visit/route";
import { proxy } from "@/proxy";
import { courseIndex } from "@/server/course-index";
import { db } from "@/server/db/client";
import {
  activityDay,
  checkpointAttempt,
  entitlement,
  membership,
  sectionProgress,
  signupSource,
  trafficDaily,
  user,
} from "@/server/db/schema";
import { analyticsOverview, recordSignupSource } from "@/server/repo/analytics";
import { DEFAULT_TENANT_ID } from "@/server/repo/tenant";
import { BASE, req, signIn } from "./auth-helpers";
import { COURSE, makeUser } from "./helpers";

const T = DEFAULT_TENANT_ID;
const src = (source: string, medium = "", campaign = "") => ({ source, medium, campaign });
const postVisit = (cookie: string | null, body: unknown, init: { origin?: string } = {}) => {
  const r = req("/api/visit", cookie, { method: "POST", json: body });
  if (init.origin) r.headers.set("origin", init.origin);
  return visit.POST(r);
};
const visits = () =>
  db()
    .select({
      source: trafficDaily.source,
      medium: trafficDaily.medium,
      visits: trafficDaily.visits,
    })
    .from(trafficDaily)
    .orderBy(trafficDaily.source);

describe("visits", () => {
  it("counts anonymous visits by source; signed-in learners are not counted", async () => {
    expect((await postVisit(null, src("meta", "paid", "founders"))).status).toBe(204);
    await postVisit(null, src("meta", "paid", "founders"));
    await postVisit(null, src("direct"));
    const learner = await signIn("visit-learner@example.test");
    await postVisit(learner, src("meta", "paid", "founders"));
    expect(await visits()).toEqual([
      { source: "direct", medium: "", visits: 1 },
      { source: "meta", medium: "paid", visits: 2 },
    ]);
  });

  it("refuses unclean values and other sites", async () => {
    expect((await postVisit(null, src("Meta Ads"))).status).toBe(400);
    expect((await postVisit(null, src(""))).status).toBe(400);
    expect((await postVisit(null, { ...src("x"), extra: "<script>" })).status).toBe(204);
    expect((await postVisit(null, src("x"), { origin: "https://evil.example" })).status).toBe(403);
    expect((await visits()).map((v) => v.source)).toEqual(["x"]);
  });
});

describe("signup source", () => {
  const post = (cookie: string | null, body: unknown) =>
    attribution.POST(req("/api/me/attribution", cookie, { method: "POST", json: body }));

  it("is recorded once for a new learner, then never overwritten", async () => {
    const a = await signIn("new-from-linkedin@example.test");
    expect(await (await post(a, src("linkedin.com", "referral"))).json()).toEqual({
      recorded: true,
    });
    expect(await (await post(a, src("meta", "paid"))).json()).toEqual({ recorded: false });
    const rows = await db().select().from(signupSource);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: "linkedin.com", medium: "referral" });

    // Part of the learner's data export, and deleted with the account (cascade).
    const exported = await (await exportRoute.GET(req("/api/me/export", a))).json();
    expect(exported.signupSource).toEqual([
      expect.objectContaining({ source: "linkedin.com", medium: "referral" }),
    ]);
    await db().delete(user).where(eq(user.id, rows[0]!.userId));
    expect(await db().select().from(signupSource)).toEqual([]);
  });

  it("survives the signed-in redirect from the landing page to the dashboard", async () => {
    const a = await signIn("landing-redirect@example.test");
    const res = await proxy(
      new NextRequest(`${BASE}/?utm_source=meta&utm_medium=paid`, { headers: { cookie: a } }),
    );
    expect(res.headers.get("location")).toBe(`${BASE}/home?utm_source=meta&utm_medium=paid`);
  });

  it("is ignored after the first day of membership, and needs a signed-in learner", async () => {
    const id = await makeUser("old-learner");
    await db()
      .insert(membership)
      .values({ tenantId: T, userId: id, createdAt: new Date(Date.now() - 2 * 86_400_000) });
    expect(await recordSignupSource({ tenantId: T, userId: id }, src("meta"))).toBe(false);
    expect((await post(null, src("meta"))).status).toBe(401);
    const a = await signIn("bad-source@example.test");
    expect((await post(a, src("Not Clean"))).status).toBe(400);
  });
});

describe("the owner's summary", () => {
  it("adds up the funnel, sources, weekly activity, chapters and checkpoints", async () => {
    const idx = courseIndex(COURSE)!;
    const [p1, p2] = [...idx.learnSections.entries()].filter(([, s]) => s.size > 1);
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const learners = await Promise.all(["l1", "l2", "l3"].map((n) => makeUser(n)));
    for (const id of learners) await db().insert(membership).values({ tenantId: T, userId: id });
    // One old member: active this period but not a new signup.
    const old = await makeUser("old");
    await db()
      .insert(membership)
      .values({ tenantId: T, userId: old, createdAt: new Date("2020-01-01T00:00:00Z") });

    await db()
      .insert(trafficDaily)
      .values([
        { tenantId: T, day: today, ...src("meta", "paid", "a"), visits: 40 },
        { tenantId: T, day: today, ...src("meta", "paid", "b"), visits: 10 },
        { tenantId: T, day: today, ...src("direct"), visits: 25 },
        { tenantId: T, day: "2020-01-01", ...src("meta", "paid"), visits: 999 }, // outside range
      ]);
    await db()
      .insert(signupSource)
      .values([
        { tenantId: T, userId: learners[0]!, ...src("meta", "paid", "a") },
        { tenantId: T, userId: learners[1]!, ...src("linkedin.com", "referral") },
      ]);
    await db()
      .insert(activityDay)
      .values([...learners, old].map((userId) => ({ tenantId: T, userId, day: today })));
    // l1 finishes chapter p1, l2 starts it, l3 starts p2.
    const read = (userId: string, page: string, keys: string[]) =>
      db()
        .insert(sectionProgress)
        .values(
          keys.map((sectionKey) => ({
            tenantId: T,
            userId,
            course: COURSE,
            pageKey: page,
            sectionKey,
          })),
        );
    await read(learners[0]!, p1![0], [...p1![1]]);
    await read(learners[1]!, p1![0], [[...p1![1]][0]!]);
    await read(learners[2]!, p2![0], [[...p2![1]][0]!]);
    await db()
      .insert(checkpointAttempt)
      .values([
        {
          tenantId: T,
          userId: learners[0]!,
          course: COURSE,
          part: 1,
          attempt: 1,
          score: 40,
          passed: false,
          detail: {},
        },
        {
          tenantId: T,
          userId: learners[0]!,
          course: COURSE,
          part: 1,
          attempt: 2,
          score: 90,
          passed: true,
          detail: {},
        },
        {
          tenantId: T,
          userId: learners[1]!,
          course: COURSE,
          part: 1,
          attempt: 1,
          score: 30,
          passed: false,
          detail: {},
        },
      ]);
    await db().insert(entitlement).values({
      id: "ent-analytics",
      tenantId: T,
      userId: learners[0]!,
      course: COURSE,
      source: "direct",
    });

    const to = new Date(now.getTime() + 86_400_000);
    const from = new Date(now.getTime() - 7 * 86_400_000);
    const o = await analyticsOverview(T, COURSE, from, to);
    expect(o.totals).toEqual({ visits: 75, signups: 3, activeLearners: 4, learnerPlaces: 1 });
    // Most signups first, then most visits.
    expect(o.bySource).toEqual([
      { source: "meta", medium: "paid", visits: 50, signups: 1 },
      { source: "direct", medium: "", visits: 25, signups: 1 },
      { source: "linkedin.com", medium: "referral", visits: 0, signups: 1 },
    ]);
    expect(o.weekly.reduce((n, w) => n + w.activeLearners, 0)).toBe(4);
    expect(o.chapters.find((c) => c.key === p1![0])).toMatchObject({ started: 2, finished: 1 });
    expect(o.chapters.find((c) => c.key === p2![0])).toMatchObject({ started: 1, finished: 0 });
    expect(o.checkpoints).toEqual([{ part: 1, attempted: 2, passed: 1 }]);
    // No learner is named anywhere in the summary.
    expect(JSON.stringify(o)).not.toMatch(/@example\.test|l1-|l2-|l3-/);
  });

  it("the admin route checks its inputs", async () => {
    const owner = await signIn("owner@example.test");
    const get = (q: string) => adminAnalytics.GET(req(`/api/admin/analytics${q}`, owner));
    const ok = await (await get("?days=7")).json();
    expect(ok).toMatchObject({ days: 7, course: COURSE, tenantId: T });
    expect((await get("?days=365")).status).toBe(400);
    expect((await get("?course=nope")).status).toBe(400);
    expect((await get("?tenant=tnt_nope")).status).toBe(400);
  });
});
