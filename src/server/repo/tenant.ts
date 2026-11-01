// Tenants and memberships (ADR-0023). The only module that reads these tables.
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { membership, tenant, tenantCourse } from "../db/schema";
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

export interface CourseAccess {
  enabled: boolean;
  /** Page keys or "part:N" the tenant has switched off; content itself is never copied. */
  disabledModules: string[];
}

const courseCache = new Map<string, { at: number; value: CourseAccess }>();

/** Whether a tenant offers a platform course, and which modules it has disabled. */
export async function courseAccess(tenantId: string, course: string): Promise<CourseAccess> {
  const key = `${tenantId}:${course}`;
  const hit = courseCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const [row] = await db()
    .select({ enabled: tenantCourse.enabled, disabled: tenantCourse.disabledModules })
    .from(tenantCourse)
    .where(and(eq(tenantCourse.tenantId, tenantId), eq(tenantCourse.course, course)));
  const value = row
    ? { enabled: row.enabled, disabledModules: row.disabled ?? [] }
    : { enabled: false, disabledModules: [] };
  courseCache.set(key, { at: Date.now(), value });
  return value;
}

/** For tests and the Phase 2 admin screen: forget cached tenant settings. */
export function clearTenantCaches(): void {
  cache.clear();
  courseCache.clear();
}

/** Platform administration: every tenant, for the admin screens (callers hold platform:*). */
export async function listTenants(): Promise<
  { id: string; slug: string; name: string; status: string }[]
> {
  const rows = await db().select().from(tenant).orderBy(tenant.createdAt);
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    status: r.status,
    name: String((r.config as Record<string, unknown>)?.name ?? r.slug),
  }));
}
