// Tenant resolution (ADR-0023). One function decides which tenant a request belongs to.
// It never reads the tenant from user input (query, body, cookies or custom headers).
// Phase 2 resolves from the request's host (custom domain or subdomain).
import { brandingFor, type TenantConfig } from "@/lib/branding";
import { DEFAULT_TENANT_ID, getTenant, type TenantRecord } from "./repo/tenant";

export async function resolveTenant(_req: Request): Promise<TenantRecord> {
  return getTenant(DEFAULT_TENANT_ID);
}

/** The current tenant's branding (defaults overlaid with its stored config). */
export async function tenantBranding(req?: Request): Promise<TenantConfig> {
  const tenant = req ? await resolveTenant(req) : await getTenant(DEFAULT_TENANT_ID);
  return brandingFor(tenant.config);
}
