// The request context every personal-data operation runs in: who, in which tenant, with
// which role. Repositories take `ctx` and apply both scopes themselves (ADR-0023).
import { can, type Action, type Actor, type TenantRole } from "./authz";
import { ensureMembership } from "./repo/tenant";
import { getUser, HttpError, type SessionUser } from "./session";
import { resolveTenant } from "./tenant";
import type { TenantRecord } from "./repo/tenant";

/** Scope passed to every repository function. */
export interface Ctx {
  tenantId: string;
  userId: string;
}

export interface RequestContext {
  ctx: Ctx;
  tenant: TenantRecord;
  user: SessionUser;
  actor: Actor;
}

export async function requireContext(req: Request, action: Action): Promise<RequestContext> {
  const user = await getUser(req.headers);
  if (!user) throw new HttpError(401, "Sign in to continue.");
  const tenant = await resolveTenant(req);
  const m = await ensureMembership(tenant.id, user.id);
  const actor: Actor = {
    platformRole: user.platformRole,
    tenantRole: m.role as TenantRole,
    membershipActive: m.status === "active",
  };
  if (!can(actor, action)) throw new HttpError(403, "You don't have access to this.");
  return { ctx: { tenantId: tenant.id, userId: user.id }, tenant, user, actor };
}
