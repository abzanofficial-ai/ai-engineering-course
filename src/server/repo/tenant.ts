// Tenants and memberships (ADR-0023). The only module that reads these tables.
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { membership, tenant } from "../db/schema";
import type { TenantRole } from "../authz";

export const DEFAULT_TENANT_ID = "tnt_default";

export interface TenantRecord {
  id: string;
  slug: string;
  status: string;
  config: Record<string, unknown>;
}

const cache = new Map<string, { at: number; value: TenantRecord }>();

export async function getTenant(id: string): Promise<TenantRecord> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const [row] = await db().select().from(tenant).where(eq(tenant.id, id));
  if (!row) throw new Error(`Tenant ${id} not found`);
  const value = {
    id: row.id,
    slug: row.slug,
    status: row.status,
    config: (row.config ?? {}) as Record<string, unknown>,
  };
  cache.set(id, { at: Date.now(), value });
  return value;
}

/** The user's membership in a tenant, created as a learner on first use. */
export async function ensureMembership(
  tenantId: string,
  userId: string,
): Promise<{ role: TenantRole; status: string }> {
  await db().insert(membership).values({ tenantId, userId, role: "learner" }).onConflictDoNothing();
  const [row] = await db()
    .select({ role: membership.role, status: membership.status })
    .from(membership)
    .where(and(eq(membership.tenantId, tenantId), eq(membership.userId, userId)));
  return { role: row!.role as TenantRole, status: row!.status };
}
