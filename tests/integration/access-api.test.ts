// Access once billing launches (ADR-0030), through the real routes: the default tenant's launch
// mode is switched off for each test and restored afterwards.
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as accessPage from "@/app/access/route";
import * as accessApi from "@/app/api/me/access/route";
import * as checkpoints from "@/app/api/me/checkpoints/route";
import * as join from "@/app/api/me/join/route";
import * as ops from "@/app/api/me/ops/route";
import { PASS_COOKIE, verifyPass } from "@/lib/access-pass";
import { db } from "@/server/db/client";
import { authSecret } from "@/server/env";
import { createSeatPack } from "@/server/repo/commerce";
import { clearTenantCaches, DEFAULT_TENANT_ID } from "@/server/repo/tenant";
import { req, signIn } from "./auth-helpers";
import { COURSE, TODAY } from "./helpers";

const PAID = `/learn/${COURSE}/21-tool-calling-and-function-calling`;

beforeEach(async () => {
  await db().execute(
    sql`update tenant set config = ${JSON.stringify({ access: { launchOpenToAllSignedIn: false } })}::jsonb where id = ${DEFAULT_TENANT_ID}`,
  );
  clearTenantCaches();
});
afterEach(async () => {
  await db().execute(sql`update tenant set config = '{}'::jsonb where id = ${DEFAULT_TENANT_ID}`);
  clearTenantCaches();
});

const read = (cookie: string, page: string, section: string) =>
  ops.POST(
    req("/api/me/ops", cookie, {
      method: "POST",
      json: { course: COURSE, day: TODAY, ops: [{ type: "section_read", page, section, ts: 1 }] },
    }),
  );

describe("with launch mode off", () => {
  it("free-tier progress saves; paid progress is refused until the learner joins", async () => {
    const a = await signIn("access-a@example.test");
    expect((await (await read(a, "ch-3", "what-it-is")).json()).results).toEqual([
      { ok: true, xp: 5 },
    ]);
    expect((await (await read(a, "ch-21", "what-it-is")).json()).results).toEqual([
      { ok: false, error: "no access" },
    ]);
    const cp = await checkpoints.POST(
      req("/api/me/checkpoints", a, {
        method: "POST",
        json: { course: COURSE, part: 5, day: TODAY, ratings: {}, answer: "x" },
      }),
    );
    expect(cp.status).toBe(400);
    expect(
      (await (await accessApi.GET(req(`/api/me/access?course=${COURSE}`, a))).json()).via,
    ).toEqual({
      allowed: false,
      reason: "plans",
    });

    const { code } = await createSeatPack({
      tenantId: DEFAULT_TENANT_ID,
      course: COURSE,
      orgName: "Example Training Ltd",
      seats: 10,
      accessMonths: 12,
    });
    const bad = await join.POST(
      req("/api/me/join", a, { method: "POST", json: { code: "AAAA-BBBB-CCCC" } }),
    );
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toMatch(/isn't valid/);
    const ok = await join.POST(req("/api/me/join", a, { method: "POST", json: { code } }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true, orgName: "Example Training Ltd" });

    expect((await (await read(a, "ch-21", "what-it-is")).json()).results).toEqual([
      { ok: true, xp: 5 },
    ]);
    const access = await (await accessApi.GET(req(`/api/me/access?course=${COURSE}`, a))).json();
    expect(access.entitlements).toHaveLength(1);
    expect(access.entitlements[0]).toMatchObject({
      source: "seat",
      orgName: "Example Training Ltd",
    });
  });

  it("/access issues a pass for entitled learners and sends others to the plans", async () => {
    const a = await signIn("access-pass@example.test");
    const denied = await accessPage.GET(req(`/access?next=${encodeURIComponent(PAID)}`, a));
    expect(denied.status).toBe(307);
    expect(denied.headers.get("location")).toContain(`/plans?next=${encodeURIComponent(PAID)}`);

    const { code } = await createSeatPack({
      tenantId: DEFAULT_TENANT_ID,
      course: COURSE,
      orgName: "Centre",
      seats: 1,
      accessMonths: 1,
    });
    await join.POST(req("/api/me/join", a, { method: "POST", json: { code } }));
    const granted = await accessPage.GET(req(`/access?next=${encodeURIComponent(PAID)}`, a));
    expect(new URL(granted.headers.get("location")!).pathname).toBe(PAID);
    const cookie = granted.headers.get("set-cookie")!;
    expect(cookie).toContain(`${PASS_COOKIE}=`);
    expect(cookie).toMatch(/HttpOnly/i);
    const pass = cookie.split(";")[0]!.split("=")[1];
    const session = decodeURIComponent(a.match(/better-auth\.session_token=([^;]+)/)![1]!);
    expect(await verifyPass(authSecret(), session, pass)).toMatchObject({ courses: [COURSE] });
    expect(await verifyPass(authSecret(), "someone-else", pass)).toBeNull();

    // Open redirects are refused.
    const evil = await accessPage.GET(
      req(`/access?next=${encodeURIComponent("//evil.example")}`, a),
    );
    expect(new URL(evil.headers.get("location")!).host).toBe(
      new URL(granted.headers.get("location")!).host,
    );
  });

  it("signed out, /access goes to sign-in and the APIs refuse", async () => {
    const r = await accessPage.GET(req(`/access?next=${encodeURIComponent(PAID)}`, null));
    expect(r.headers.get("location")).toContain("/sign-in?next=");
    expect(
      (await join.POST(req("/api/me/join", null, { method: "POST", json: { code: "x" } }))).status,
    ).toBe(401);
    expect((await accessApi.GET(req(`/api/me/access?course=${COURSE}`, null))).status).toBe(401);
  });
});
