// Feature flag overrides (ADR-0031). The only module that reads or writes feature_flag.
// flagsFor() is called on hot paths (the proxy, the access check), so it is cached briefly.
import { and, eq } from "drizzle-orm";
import { brandingFor } from "@/lib/branding";
import { FLAG_KEYS, FLAGS, resolveFlags, type FlagKey, type Flags } from "@/lib/flags";
import { db } from "../db/client";
import { featureFlag, user } from "../db/schema";
import { getTenant } from "./tenant";

const TTL_MS = 30_000;
const cache = new Map<string, { at: number; value: Flags }>();

/** The tenant's effective flags: defaults (from its config) with stored overrides on top. */
export async function flagsFor(tenantId: string): Promise<Flags> {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const [t, rows] = await Promise.all([
    getTenant(tenantId),
    db()
      .select({ key: featureFlag.key, enabled: featureFlag.enabled })
      .from(featureFlag)
      .where(eq(featureFlag.tenantId, tenantId)),
  ]);
  const value = resolveFlags(brandingFor(t.config), rows);
  cache.set(tenantId, { at: Date.now(), value });
  return value;
}

export function clearFlagCache(): void {
  cache.clear();
}

export interface FlagRow {
  key: FlagKey;
  label: string;
  description: string;
  warning: string | null;
  enabled: boolean;
  defaultValue: boolean;
  overridden: boolean;
  updatedAt: Date | null;
  updatedByEmail: string | null;
}

/** Platform admin: every declared flag for a tenant, with its default and any override. */
export async function listFlags(tenantId: string): Promise<FlagRow[]> {
  const [t, rows] = await Promise.all([
    getTenant(tenantId),
    db()
      .select({
        key: featureFlag.key,
        enabled: featureFlag.enabled,
        updatedAt: featureFlag.updatedAt,
        email: user.email,
      })
      .from(featureFlag)
      .leftJoin(user, eq(user.id, featureFlag.updatedBy))
      .where(eq(featureFlag.tenantId, tenantId)),
  ]);
  const brand = brandingFor(t.config);
  return FLAG_KEYS.map((key) => {
    const spec: (typeof FLAGS)[FlagKey] = FLAGS[key];
    const o = rows.find((r) => r.key === key);
    const defaultValue = spec.defaultFor(brand);
    return {
      key,
      label: spec.label,
      description: spec.description,
      warning: "warning" in spec ? spec.warning : null,
      enabled: o ? o.enabled : defaultValue,
      defaultValue,
      overridden: Boolean(o),
      updatedAt: o?.updatedAt ?? null,
      updatedByEmail: o?.email ?? null,
    };
  });
}

/** Platform admin: store an override, or remove it (null) to fall back to the default. */
export async function setFlag(
  tenantId: string,
  key: FlagKey,
  enabled: boolean | null,
  actorId: string,
): Promise<void> {
  if (enabled === null) {
    await db()
      .delete(featureFlag)
      .where(and(eq(featureFlag.tenantId, tenantId), eq(featureFlag.key, key)));
  } else {
    const now = new Date();
    await db()
      .insert(featureFlag)
      .values({ tenantId, key, enabled, updatedBy: actorId, updatedAt: now })
      .onConflictDoUpdate({
        target: [featureFlag.tenantId, featureFlag.key],
        set: { enabled, updatedBy: actorId, updatedAt: now },
      });
  }
  cache.delete(tenantId);
}
