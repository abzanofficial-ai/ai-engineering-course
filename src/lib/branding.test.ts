// Branding comes from tenant configuration, never from literals (ADR-0024).
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { magicLinkEmail } from "@/server/email";
import { brandingFor, defaultBranding, emailFrom, markGradient } from "./branding";

describe("tenant branding", () => {
  it("parses the seeded defaults", () => {
    expect(defaultBranding.name).toBe("The AI Engineering Handbook");
    expect(defaultBranding.access.launchOpenToAllSignedIn).toBe(true);
  });

  it("overlays a tenant's overrides, one level deep", () => {
    const b = brandingFor({ name: "Northside Academy", email: { fromName: "Northside" } });
    expect(b.name).toBe("Northside Academy");
    expect(b.email).toEqual({
      fromName: "Northside",
      fromAddress: defaultBranding.email.fromAddress,
    });
    expect(b.colors).toEqual(defaultBranding.colors);
    expect(() => brandingFor({ supportEmail: "not-an-email" })).toThrow();
  });

  it("drives emails, the sender and the web app manifest", () => {
    const b = brandingFor({ name: "Northside Academy", supportEmail: "help@northside.example" });
    const mail = magicLinkEmail("x@example.test", "https://app.example/verify", b);
    expect(mail.subject).toBe("Your sign-in link for Northside Academy");
    expect(mail.text).toContain("help@northside.example");
    expect(mail.from).toBe(emailFrom(b));
    expect(manifest().name).toBe(defaultBranding.name);
    expect(markGradient(defaultBranding)).toMatch(/^conic-gradient\(/);
  });

  it("no brand literal appears anywhere in src/ (outside branding and tests)", () => {
    const needles = [
      defaultBranding.name,
      defaultBranding.headerName,
      defaultBranding.shortName,
      defaultBranding.tagline,
      defaultBranding.email.fromAddress,
      defaultBranding.supportEmail,
    ];
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = path.join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (
          /\.(ts|tsx|css)$/.test(f) &&
          !/\.test\.ts$/.test(f) &&
          !p.endsWith(path.join("lib", "branding.ts"))
        ) {
          const text = readFileSync(p, "utf8");
          for (const n of needles)
            if (text.includes(n)) hits.push(`${path.relative(".", p)}: "${n}"`);
        }
      }
    };
    walk(path.resolve("src"));
    expect(hits).toEqual([]);
  });
});
