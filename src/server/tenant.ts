// Tenant resolution (ADR-0023). One function decides which tenant a request belongs to.
// It never reads the tenant from user input (query, body, cookies or custom headers).
// Phase 2 resolves from the request's host (custom domain or subdomain).
import { DEFAULT_TENANT_ID, getTenant, type TenantRecord } from "./repo/tenant";

export async function resolveTenant(_req: Request): Promise<TenantRecord> {
  return getTenant(DEFAULT_TENANT_ID);
}
