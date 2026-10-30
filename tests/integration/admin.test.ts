// Platform administration (ADR-0030): every admin route refuses learners and signed-out
// requests, and the owner can run the whole seat-pack, grant and licence flow.
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as commerce from "@/app/api/admin/commerce/route";
import * as join from "@/app/api/me/join/route";
import { req, signIn } from "./auth-helpers";
import { COURSE } from "./helpers";

const HANDLERS: Record<string, Record<string, (r: Request) => Promise<Response>>> = {
  "admin/commerce/route.ts": commerce as unknown as Record<
    string,
    (r: Request) => Promise<Response>
  >,
};

const post = (cookie: string | null, json: unknown) =>
  commerce.POST(req("/api/admin/commerce", cookie, { method: "POST", json }));

describe("admin routes", () => {
  it("every route under api/admin is listed here (so none escapes the checks below)", () => {
    const root = path.resolve("src/app/api/admin");
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
    expect(found.sort()).toEqual(Object.keys(HANDLERS).sort());
  });

  it("learners get 403 and signed-out requests 401, for every method", async () => {
    const learner = await signIn("not-admin@example.test");
    for (const [file, mod] of Object.entries(HANDLERS))
      for (const [method, handler] of Object.entries(mod)) {
        if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) continue;
        const init =
          method === "GET" ? {} : { method, json: { action: "revoke-pack", packId: "x" } };
        expect(
          (await handler(req(`/api/${file}`, learner, init))).status,
          `${method} ${file}`,
        ).toBe(403);
        expect((await handler(req(`/api/${file}`, null, init))).status, `${method} ${file}`).toBe(
          401,
        );
      }
  });
});

describe("the owner's flow", () => {
  it("creates a pack, a learner joins with the code, grants and revokes access, sets a licence", async () => {
    const owner = await signIn("owner@example.test");
    const learner = await signIn("pupil@example.test");
    const overview = async (q = "") =>
      (await commerce.GET(req(`/api/admin/commerce${q}`, owner))).json();

    const start = await overview();
    expect(start.tenants.map((t: { id: string }) => t.id)).toContain("tnt_default");
    expect(start.courses).toEqual([COURSE]);

    const created = await post(owner, {
      action: "create-pack",
      tenantId: "tnt_default",
      course: COURSE,
      orgName: "Example Training Ltd",
      seats: 2,
      accessMonths: 6,
    });
    expect(created.status).toBe(201);
    const { code } = await created.json();
    expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    expect(
      (await join.POST(req("/api/me/join", learner, { method: "POST", json: { code } }))).status,
    ).toBe(200);
    const after = await overview();
    expect(after.packs[0]).toMatchObject({ orgName: "Example Training Ltd", seats: 2, used: 1 });
    expect(JSON.stringify(after)).not.toContain(code); // the code itself is never stored or shown again

    const granted = await post(owner, {
      action: "grant",
      tenantId: "tnt_default",
      course: COURSE,
      email: "PUPIL@example.test",
      endsAt: "2030-01-31",
    });
    expect(granted.status).toBe(201);
    const { id } = await granted.json();
    expect((await post(owner, { action: "revoke-grant", entitlementId: id })).status).toBe(200);
    expect((await post(owner, { action: "revoke-grant", entitlementId: id })).status).toBe(404);
    const unknown = await post(owner, {
      action: "grant",
      tenantId: "tnt_default",
      course: COURSE,
      email: "nobody@example.test",
    });
    expect(unknown.status).toBe(404);

    expect(
      (
        await post(owner, {
          action: "set-licence",
          tenantId: "tnt_default",
          basePence: 30000,
          includedLearners: 30,
          extraLearnerPence: 600,
          status: "active",
        })
      ).status,
    ).toBe(200);
    const usage = (await overview()).usage;
    expect(usage.licence).toMatchObject({ basePence: 30000, includedLearners: 30 });
    expect(usage.invoice.total).toBe(30000);

    // Bad input is refused, not stored.
    for (const bad of [
      {
        action: "create-pack",
        tenantId: "tnt_default",
        course: COURSE,
        orgName: "X",
        seats: 0,
        accessMonths: 6,
      },
      {
        action: "create-pack",
        tenantId: "tnt_nope",
        course: COURSE,
        orgName: "Centre",
        seats: 5,
        accessMonths: 6,
      },
      {
        action: "create-pack",
        tenantId: "tnt_default",
        course: "no-course",
        orgName: "Centre",
        seats: 5,
        accessMonths: 6,
      },
      { action: "drop-tables" },
    ])
      expect((await post(owner, bad)).status).toBe(400);
    expect((await commerce.GET(req("/api/admin/commerce?month=2026-13", owner))).status).toBe(400);
  });
});
