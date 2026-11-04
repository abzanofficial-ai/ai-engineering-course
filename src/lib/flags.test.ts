import { describe, expect, it } from "vitest";
import { brandingFor, defaultBranding } from "./branding";
import { FLAG_KEYS, FLAGS, isFlagKey, resolveFlags } from "./flags";

describe("feature flags", () => {
  it("every flag has a label, a description and a boolean default", () => {
    for (const k of FLAG_KEYS) {
      expect(k).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(FLAGS[k].label.length).toBeGreaterThan(5);
      expect(FLAGS[k].description.length).toBeGreaterThan(20);
      expect(typeof FLAGS[k].defaultFor(defaultBranding)).toBe("boolean");
    }
  });

  it("launch mode defaults to the tenant config", () => {
    expect(resolveFlags(defaultBranding, []).launch_open_access).toBe(
      defaultBranding.access.launchOpenToAllSignedIn,
    );
    const closed = brandingFor({ access: { launchOpenToAllSignedIn: false } });
    expect(resolveFlags(closed, []).launch_open_access).toBe(false);
  });

  it("a stored override wins; retired keys are ignored", () => {
    const flags = resolveFlags(defaultBranding, [
      { key: "launch_open_access", enabled: false },
      { key: "retired_flag", enabled: true },
    ]);
    expect(flags).toEqual({ launch_open_access: false });
  });

  it("isFlagKey accepts declared keys only", () => {
    expect(isFlagKey("launch_open_access")).toBe(true);
    expect(isFlagKey("toString")).toBe(false);
    expect(isFlagKey("nope")).toBe(false);
  });
});
