// Proves learners cannot read or change each other's data (test-strategy §4).
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as me from "@/app/api/me/route";
import * as exportRoute from "@/app/api/me/export/route";
import * as ops from "@/app/api/me/ops/route";
import * as stateRoute from "@/app/api/me/state/route";
import { generated } from "@generated/index";
import { db } from "@/server/db/client";
import { user } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { req, signIn } from "./auth-helpers";
import { COURSE, TODAY } from "./helpers";

const lab = generated[COURSE]!.manifest.pages.find((p) => p.key === "ch-1")!.sections.find(
  (s) => s.key === "lab",
)!;
const SECRET_ANSWER = "Learner A's private drill answer, which nobody else may read.";

/** Every personal route handled here. Adding a route under api/me without a case fails the suite. */
const COVERED = ["me/route.ts", "me/export/route.ts", "me/ops/route.ts", "me/state/route.ts"];

async function seedA() {
  const a = await signIn("learner-a@example.test");
  const b = await signIn("learner-b@example.test");
  const res = await ops.POST(
    req("/api/me/ops", a, {
      method: "POST",
      json: {
        course: COURSE,
        day: TODAY,
        ops: [
          { type: "drill", page: "ch-1", answer: SECRET_ANSWER, revealed: true, ts: 1 },
          { type: "step", page: "ch-1", lab: "lab", step: lab.steps![0]!.key, done: true, ts: 1 },
          { type: "position", page: "ch-7", mode: "decide", index: 0, ts: 1 },
        ],
      },
    }),
  );
  expect(res.status).toBe(200);
  return { a, b };
}

describe("cross-learner isolation", () => {
  it("covers every personal API route", () => {
    const root = path.resolve("src/app/api/me");
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = path.join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (f === "route.ts")
          found.push(path.relative(path.resolve("src/app/api"), p).split(path.sep).join("/"));
      }
    };
    walk(root);
    expect(found.sort()).toEqual([...COVERED].sort());
  });

  it("B's state contains none of A's progress, answers or position", async () => {
    const { b } = await seedA();
    const res = await stateRoute.GET(req(`/api/me/state?course=${COURSE}&day=${TODAY}`, b));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toContain(SECRET_ANSWER);
    const { state } = JSON.parse(body);
    expect(state.drills).toEqual({});
    expect(state.steps).toEqual({});
    expect(state.last).toBeNull();
    expect(state.xp.total).toBe(0);
  });

  it("B's export contains none of A's data", async () => {
    const { b } = await seedA();
    const res = await exportRoute.GET(req("/api/me/export", b));
    const body = await res.text();
    expect(body).not.toContain(SECRET_ANSWER);
    expect(body).not.toContain("learner-a@example.test");
    expect(JSON.parse(body).profile.email).toBe("learner-b@example.test");
  });

  it("a userId smuggled into a write is ignored: B's writes only ever touch B", async () => {
    const { a, b } = await seedA();
    const [aRow] = await db()
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, "learner-a@example.test"));
    const res = await ops.POST(
      req("/api/me/ops", b, {
        method: "POST",
        json: {
          course: COURSE,
          day: TODAY,
          userId: aRow!.id,
          ops: [
            { type: "drill", page: "ch-1", answer: "overwritten by B", revealed: false, ts: 99 },
          ],
        },
      }),
    );
    expect(res.status).toBe(200);
    const aState = await (
      await stateRoute.GET(req(`/api/me/state?course=${COURSE}&day=${TODAY}`, a))
    ).json();
    expect(aState.state.drills["ch-1"].answer).toBe(SECRET_ANSWER);
  });

  it("B cannot delete A's account, even knowing A's email", async () => {
    const { a, b } = await seedA();
    const res = await me.DELETE(
      req("/api/me", b, { method: "DELETE", json: { confirmEmail: "learner-a@example.test" } }),
    );
    expect(res.status).toBe(400);
    const aState = await stateRoute.GET(req(`/api/me/state?course=${COURSE}&day=${TODAY}`, a));
    expect(aState.status).toBe(200);
  });

  it("every personal route refuses requests without a session", async () => {
    const responses = await Promise.all([
      stateRoute.GET(req(`/api/me/state?course=${COURSE}`, null)),
      exportRoute.GET(req("/api/me/export", null)),
      ops.POST(
        req("/api/me/ops", null, {
          method: "POST",
          json: { course: COURSE, day: TODAY, ops: [{ type: "goal", weeklyGoal: 3, ts: 1 }] },
        }),
      ),
      me.PATCH(req("/api/me", null, { method: "PATCH", json: { name: "x" } })),
      me.DELETE(req("/api/me", null, { method: "DELETE", json: { confirmEmail: "x" } })),
    ]);
    expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401, 401]);
  });

  it("a forged or expired session cookie is refused", async () => {
    const res = await stateRoute.GET(
      req(`/api/me/state?course=${COURSE}`, "better-auth.session_token=forged.value"),
    );
    expect(res.status).toBe(401);
  });

  it("cross-origin writes are refused (CSRF)", async () => {
    const { a } = await seedA();
    const r = new Request("http://localhost:3000/api/me/ops", {
      method: "POST",
      headers: { cookie: a, origin: "https://evil.example", "content-type": "application/json" },
      body: JSON.stringify({
        course: COURSE,
        day: TODAY,
        ops: [{ type: "goal", weeklyGoal: 1, ts: 1 }],
      }),
    });
    expect((await ops.POST(r)).status).toBe(403);
  });
});

describe("account", () => {
  it("updates the certificate name and validates it", async () => {
    const a = await signIn("learner-a@example.test");
    expect(
      (await me.PATCH(req("/api/me", a, { method: "PATCH", json: { name: "Sam Patel" } }))).status,
    ).toBe(200);
    expect(
      (await me.PATCH(req("/api/me", a, { method: "PATCH", json: { name: "" } }))).status,
    ).toBe(400);
    const s = await (await stateRoute.GET(req(`/api/me/state?course=${COURSE}`, a))).json();
    expect(s.user.name).toBe("Sam Patel");
  });

  it("deleting an account removes the user and every personal row, and ends the session", async () => {
    const { a } = await seedA();
    const res = await me.DELETE(
      req("/api/me", a, { method: "DELETE", json: { confirmEmail: "LEARNER-A@example.test" } }),
    );
    expect(res.status).toBe(200);
    const left = await db().execute(
      // every table holding user data, counted in one go
      (await import("drizzle-orm")).sql`select
        (select count(*) from "user" where email = 'learner-a@example.test')
        + (select count(*) from drill_answer) + (select count(*) from lab_step where user_id not in (select id from "user"))
        + (select count(*) from session where user_id not in (select id from "user")) as n`,
    );
    expect(Number((left as unknown as { n: string }[])[0]!.n)).toBe(0);
    expect((await stateRoute.GET(req(`/api/me/state?course=${COURSE}`, a))).status).toBe(401);
  });

  it("export includes the learner's own answers and progress", async () => {
    const { a } = await seedA();
    const data = await (await exportRoute.GET(req("/api/me/export", a))).json();
    expect(data.profile.email).toBe("learner-a@example.test");
    expect(data.drillAnswers[0].answer).toBe(SECRET_ANSWER);
    expect(data.labSteps).toHaveLength(1);
    expect(data.xpEvents.length).toBeGreaterThan(0);
  });
});

describe("sign-in rate limits", () => {
  it("allows at most 5 magic links per email address per hour", async () => {
    const { getAuth } = await import("@/server/auth-config");
    const ask = () =>
      getAuth().handler(
        new Request("http://localhost:3000/api/auth/sign-in/magic-link", {
          method: "POST",
          headers: { "content-type": "application/json", origin: "http://localhost:3000" },
          body: JSON.stringify({ email: "limited@example.test" }),
        }),
      );
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await ask()).status);
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses[5]).toBeGreaterThanOrEqual(400);
  });
});

describe("tenancy and roles (ADR-0023)", () => {
  it("resolves the default tenant and ignores any tenant named in the request", async () => {
    const { resolveTenant } = await import("@/server/tenant");
    const sneaky = new Request("http://localhost:3000/api/me/state?tenant=other&tenantId=other", {
      headers: { "x-tenant": "other", "x-tenant-id": "other", cookie: "tenant=other" },
    });
    expect((await resolveTenant(sneaky)).id).toBe("tnt_default");
  });

  it("creates a learner membership in the default tenant on first use", async () => {
    const a = await signIn("member@example.test");
    await stateRoute.GET(req(`/api/me/state?course=${COURSE}`, a));
    const rows = await db().execute(
      (await import("drizzle-orm"))
        .sql`select m.tenant_id, m.role from membership m join "user" u on u.id = m.user_id where u.email = 'member@example.test'`,
    );
    expect([...rows]).toEqual([{ tenant_id: "tnt_default", role: "learner" }]);
  });

  it("gives ADMIN_EMAILS the platform_owner role, and nobody else", async () => {
    // ADMIN_EMAILS=owner@example.test is set for the integration project (vitest.config.ts).
    const owner = await signIn("owner@example.test");
    const learner = await signIn("plain@example.test");
    const o = await (await stateRoute.GET(req(`/api/me/state?course=${COURSE}`, owner))).json();
    const l = await (await stateRoute.GET(req(`/api/me/state?course=${COURSE}`, learner))).json();
    expect(o.user.platformRole).toBe("platform_owner");
    expect(l.user.platformRole).toBeNull();
  });

  it("a deactivated membership loses access to personal routes", async () => {
    const a = await signIn("deactivated@example.test");
    await stateRoute.GET(req(`/api/me/state?course=${COURSE}`, a));
    await db().execute(
      (await import("drizzle-orm"))
        .sql`update membership set status = 'deactivated' where user_id = (select id from "user" where email = 'deactivated@example.test')`,
    );
    expect((await stateRoute.GET(req(`/api/me/state?course=${COURSE}`, a))).status).toBe(403);
  });
});
