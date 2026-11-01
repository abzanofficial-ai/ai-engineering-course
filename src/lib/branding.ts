// Tenant branding and settings (ADR-0024). Defaults live in content/tenants/default.json;
// a tenant record's `config` overrides any field. Components and emails read from here —
// never from literals.
import { z } from "zod";
import defaults from "../../content/tenants/default.json";

const schema = z.object({
  name: z.string(),
  shortName: z.string(),
  headerName: z.string(),
  tagline: z.string(),
  homeIntro: z.string(),
  defaultCourse: z.string(),
  logo: z.object({
    icon192: z.string(),
    icon512: z.string(),
    maskable512: z.string(),
    appleTouch: z.string(),
  }),
  colors: z.object({
    mark: z.array(z.string()).min(2),
    themeLight: z.string(),
    themeDark: z.string(),
  }),
  email: z.object({ fromName: z.string(), fromAddress: z.string().email() }),
  supportEmail: z.string().email(),
  footer: z.string(),
  certificate: z.object({ title: z.string(), body: z.string(), signatory: z.string() }),
  access: z.object({
    /** Page keys readable without an account (`*` suffix wildcard). */
    publicPages: z.array(z.string()),
    /** What the free tier includes once billing is live (Phase 4): page patterns or "part:N". */
    freeTier: z.array(z.string()),
    /** Until billing launches, every signed-in learner gets the full course. */
    launchOpenToAllSignedIn: z.boolean(),
  }),
});

export type TenantConfig = z.infer<typeof schema>;

/** The seeded defaults (used for static pages, which are built before any request). */
export const defaultBranding: TenantConfig = schema.parse(defaults);

/** Defaults overlaid with a tenant's stored overrides (one level deep for nested groups). */
export function brandingFor(overrides: Record<string, unknown> | null | undefined): TenantConfig {
  if (!overrides || !Object.keys(overrides).length) return defaultBranding;
  const merged: Record<string, unknown> = { ...defaultBranding };
  for (const [k, v] of Object.entries(overrides)) {
    const base = (defaultBranding as Record<string, unknown>)[k];
    merged[k] =
      v && typeof v === "object" && !Array.isArray(v) && base && typeof base === "object"
        ? { ...base, ...v }
        : v;
  }
  return schema.parse(merged);
}

/** The brand mark as a CSS gradient, exposed to stylesheets as --brand-mark. */
export function markGradient(c: TenantConfig): string {
  return `conic-gradient(from 200deg, ${[...c.colors.mark, c.colors.mark[0]].join(", ")})`;
}

export function emailFrom(c: TenantConfig): string {
  return `${c.email.fromName} <${c.email.fromAddress}>`;
}
