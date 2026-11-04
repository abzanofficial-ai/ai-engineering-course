// Feature flags (ADR-0031): switch features on or off per tenant without a deploy. Each flag is
// declared here with its default; the database only stores overrides set from /admin/flags.
import type { TenantConfig } from "./branding";

export interface FlagSpec {
  label: string;
  description: string;
  /** Shown before the change is saved, when switching it could lock learners out. */
  warning?: string;
  /** The value when no override is stored (may come from the tenant's config). */
  defaultFor: (brand: TenantConfig) => boolean;
}

export const FLAGS = {
  launch_open_access: {
    label: "Launch mode: full course for everyone signed in",
    description:
      "While on, every signed-in learner can read every chapter. Turn it off when paid plans " +
      "start: then only public pages and the free tier are open without a plan, licence or seat.",
    warning:
      "Learners without a plan, centre licence or seat will lose access to paid chapters " +
      "within about 15 minutes.",
    defaultFor: (b) => b.access.launchOpenToAllSignedIn,
  },
} as const satisfies Record<string, FlagSpec>;

export type FlagKey = keyof typeof FLAGS;
export type Flags = Record<FlagKey, boolean>;

export const FLAG_KEYS = Object.keys(FLAGS) as FlagKey[];

export const isFlagKey = (k: string): k is FlagKey => Object.hasOwn(FLAGS, k);

/** Defaults overlaid with stored overrides; unknown stored keys (retired flags) are ignored. */
export function resolveFlags(
  brand: TenantConfig,
  overrides: { key: string; enabled: boolean }[],
): Flags {
  const out = Object.fromEntries(FLAG_KEYS.map((k) => [k, FLAGS[k].defaultFor(brand)])) as Flags;
  for (const o of overrides) if (isFlagKey(o.key)) out[o.key] = o.enabled;
  return out;
}
