// Tenant isolation (ADR-0023, test-strategy §4b). Only the default tenant exists in
// production today; these tests create a second tenant to prove every repository function
// applies the tenant scope, so Phase 2 multi-tenancy starts from proven isolation.
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as stateRoute from "@/app/api/me/state/route";
import * as ops from "@/app/api/me/ops/route";
import { generated } from "@generated/index";
import { db } from "@/server/db/client";
import * as accountRepo from "@/server/repo/account";
import * as certificateRepo from "@/server/repo/certificate";
import * as checkpointRepo from "@/server/repo/checkpoint";
import * as progressRepo from "@/server/repo/progress";
import * as stateRepo from "@/server/repo/state";
import * as tenantRepo from "@/server/repo/tenant";
import { req, signIn } from "./auth-helpers";
import { COURSE, makeUser, TODAY } from "./helpers";

const OTHER = "tnt_test_other";
const lab = generated[COURSE]!.manifest.pages.find((p) => p.key === "ch-1")!.sections.find(
  (s) => s.key === "lab",
)!;
const SECRET = "Tenant A's private drill answer, never visible in tenant B.";

async function makeOtherTenant() {
  await db().execute(
    sql`insert into tenant (id, slug, config) values (${OTHER}, 'other-centre', '{}'::jsonb) on conflict do nothing`,
  );
  await db().execute(
    sql`insert into tenant_course (tenant_id, course) values (${OTHER}, ${COURSE}) on conflict do nothing`,
  );
}

const write = (tenantId: string, userId: string, answer: string) =>
  progressRepo.applyOps(
    { tenantId, userId },
    {
      course: COURSE,
      day: TODAY,
      ops: [
        { type: "drill", page: "ch-1", answer, revealed: true, ts: 1 },
        { type: "step", page: "ch-1", lab: "lab", step: lab.steps![0]!.key, done: true, ts: 1 },
      ],
    },
  );

describe("tenant isolation", () => {
  it("classifies every repository export as tenant-scoped, identity-level or infrastructure", () => {
    const TENANT_SCOPED = [
      "applyOps",
      "loadState",
      "exportUserData",
      "submitCheckpoint",
      "claimCertificate",
      "listCertificates",
      "deleteCertificate",
    ];
    // Public by design: looks up one certificate by its unguessable id (ADR-0029).
    const PUBLIC = ["verifyCertificate"];
    const IDENTITY = ["deleteUser", "updateName"]; // the global sign-in identity (ADR-0023)
    const INFRA = [
      "clampDay",
      "isDisabled",
      "batchSchema",
      "opSchema",
      "getTenant",
      "ensureMembership",
      "courseAccess",
      "checkpointSchema",
      "clearTenantCaches",
      "DEFAULT_TENANT_ID",
      "newCertificateId",
    ];
    const exported = [
      accountRepo,
      certificateRepo,
      checkpointRepo,
      progressRepo,
      stateRepo,
      tenantRepo,
    ].flatMap((m) => Object.keys(m));
    // A new repository function must be added to one of the lists (and, if tenant-scoped, tested below).
    expect(exported.sort()).toEqual([...TENANT_SCOPED, ...PUBLIC, ...IDENTITY, ...INFRA].sort());
  });

  it("the same learner in two tenants has fully separate progress", async () => {
    await makeOtherTenant();
    const u = await makeUser("both");
    await write("tnt_default", u, SECRET);
    const inOther = await stateRepo.loadState({ tenantId: OTHER, userId: u }, COURSE, TODAY);
    expect(JSON.stringify(inOther)).not.toContain(SECRET);
    expect(inOther.steps).toEqual({});
    expect(inOther.xp.total).toBe(0);
    expect(inOther.streak.streak).toBe(0);

    await write(OTHER, u, "Tenant B's own answer");
    const inDefault = await stateRepo.loadState(
      { tenantId: "tnt_default", userId: u },
      COURSE,
      TODAY,
    );
    expect(inDefault.drills["ch-1"]!.answer).toBe(SECRET);
    expect(inDefault.xp.total).toBe(40); // tenant B's identical items earned XP separately
  });

  it("a learner in another tenant cannot see the first tenant's learner", async () => {
    await makeOtherTenant();
    const a = await makeUser("tenant-a");
    const b = await makeUser("tenant-b");
    await write("tnt_default", a, SECRET);
    const s = await stateRepo.loadState({ tenantId: OTHER, userId: b }, COURSE, TODAY);
    expect(JSON.stringify(s)).not.toContain(SECRET);
  });

  it("checkpoint attempts are tenant-scoped", async () => {
    await makeOtherTenant();
    const u = await makeUser("cp-tenant");
    const { partContent, seedFor, selectQuestions } = await import("@/lib/checkpoint");
    const keys = selectQuestions(partContent(generated[COURSE]!.manifest, 1).cards, seedFor(1, 1));
    const r = await checkpointRepo.submitCheckpoint(
      { tenantId: "tnt_default", userId: u },
      {
        course: COURSE,
        part: 1,
        day: TODAY,
        ratings: Object.fromEntries(keys.map((k) => [k, "confident" as const])),
        answer: SECRET,
      },
    );
    expect(r).toMatchObject({ ok: true, passed: true });
    expect(
      (await stateRepo.loadState({ tenantId: OTHER, userId: u }, COURSE, TODAY)).checkpoints,
    ).toEqual({});
  });

  it("export covers only the current tenant", async () => {
    await makeOtherTenant();
    const u = await makeUser("exporter");
    await write("tnt_default", u, SECRET);
    const other = await accountRepo.exportUserData({ tenantId: OTHER, userId: u });
    expect(JSON.stringify(other)).not.toContain(SECRET);
    expect(other.tenant).toBe(OTHER);
    const own = await accountRepo.exportUserData({ tenantId: "tnt_default", userId: u });
    expect(JSON.stringify(own)).toContain(SECRET);
  });

  it("requests always run in the resolved tenant, whatever the request claims", async () => {
    await makeOtherTenant();
    const a = await signIn("claims@example.test");
    const claim = { headers: { "x-tenant": OTHER } };
    await ops.POST(
      req("/api/me/ops", a, {
        method: "POST",
        ...claim,
        json: {
          course: COURSE,
          day: TODAY,
          tenantId: OTHER,
          ops: [{ type: "drill", page: "ch-1", answer: SECRET, revealed: false, ts: 1 }],
        },
      }),
    );
    const rows = await db().execute(sql`select tenant_id from drill_answer`);
    expect([...rows]).toEqual([{ tenant_id: "tnt_default" }]);
  });
});

describe("tenant course and module settings", () => {
  it("a disabled module refuses progress for its pages, without touching the content", async () => {
    await db().execute(
      sql`update tenant_course set disabled_modules = '["part:1"]'::jsonb where tenant_id = 'tnt_default'`,
    );
    tenantRepo.clearTenantCaches();
    const u = await makeUser("modules");
    const res = await progressRepo.applyOps(
      { tenantId: "tnt_default", userId: u },
      {
        course: COURSE,
        day: TODAY,
        ops: [
          { type: "section_read", page: "ch-1", section: "what-it-is", ts: 1 },
          { type: "section_read", page: "ch-5", section: "jargon", ts: 1 },
        ],
      },
    );
    expect(res).toEqual([
      { ok: false, error: "module not available" },
      { ok: true, xp: 5 },
    ]);
  });

  it("a course the tenant doesn't offer is not found", async () => {
    await db().execute(
      sql`update tenant_course set enabled = false where tenant_id = 'tnt_default'`,
    );
    tenantRepo.clearTenantCaches();
    const a = await signIn("nocourse@example.test");
    expect((await stateRoute.GET(req(`/api/me/state?course=${COURSE}`, a))).status).toBe(404);
  });
});
