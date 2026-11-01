import { describe, expect, it } from "vitest";
import { can, type Action, type Actor } from "./authz";

const actor = (over: Partial<Actor>): Actor => ({
  platformRole: null,
  tenantRole: "learner",
  membershipActive: true,
  ...over,
});
const ALL: Action[] = [
  "own:progress",
  "own:account",
  "tenant:learners:read",
  "tenant:learners:manage",
  "tenant:configure",
  "platform:content:publish",
  "platform:analytics:read",
  "platform:flags:manage",
  "platform:entitlements:manage",
  "platform:tenants:manage",
];
const allowed = (a: Actor) => ALL.filter((x) => can(a, x));

describe("can (roles as data, one permission matrix)", () => {
  it("learners manage only their own learning and account", () => {
    expect(allowed(actor({}))).toEqual(["own:progress", "own:account"]);
  });
  it("tutors can also read learners in their tenant (Phase 2)", () => {
    expect(allowed(actor({ tenantRole: "tutor" }))).toEqual([
      "own:progress",
      "own:account",
      "tenant:learners:read",
    ]);
  });
  it("tenant admins manage their tenant but nothing platform-wide", () => {
    const a = allowed(actor({ tenantRole: "tenant_admin" }));
    expect(a).toContain("tenant:configure");
    expect(a.some((x) => x.startsWith("platform:"))).toBe(false);
  });
  it("the platform owner can do everything", () => {
    expect(allowed(actor({ platformRole: "platform_owner", tenantRole: null }))).toEqual(ALL);
  });
  it("a deactivated or missing membership grants nothing", () => {
    expect(allowed(actor({ membershipActive: false }))).toEqual([]);
    expect(allowed(actor({ tenantRole: null }))).toEqual([]);
  });
});
