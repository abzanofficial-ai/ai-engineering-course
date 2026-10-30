// Authorisation in one place (ADR-0023). Roles are data: a platform role on the user and a
// tenant role on the membership. Only learner and platform_owner are used today.
export const TENANT_ROLES = ["tenant_admin", "tutor", "learner"] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];
export type PlatformRole = "platform_owner";

export interface Actor {
  platformRole: PlatformRole | null;
  /** null when the user has no membership in the current tenant. */
  tenantRole: TenantRole | null;
  membershipActive: boolean;
}

export type Action =
  | "own:progress" // read/write my own learning state
  | "own:account" // update, export or delete my own account
  | "tenant:learners:read" // see learners' progress (tutors, Phase 2)
  | "tenant:learners:manage" // invite, deactivate (Phase 2)
  | "tenant:configure" // branding, modules (Phase 2)
  | "platform:content:publish"
  | "platform:analytics:read"
  | "platform:flags:manage"
  | "platform:entitlements:manage"
  | "platform:tenants:manage";

const TENANT_MATRIX: Record<TenantRole, ReadonlySet<Action>> = {
  learner: new Set(["own:progress", "own:account"]),
  tutor: new Set(["own:progress", "own:account", "tenant:learners:read"]),
  tenant_admin: new Set([
    "own:progress",
    "own:account",
    "tenant:learners:read",
    "tenant:learners:manage",
    "tenant:configure",
  ]),
};

export function can(actor: Actor, action: Action): boolean {
  if (actor.platformRole === "platform_owner") return true;
  if (action.startsWith("platform:")) return false;
  if (!actor.tenantRole || !actor.membershipActive) return false;
  return TENANT_MATRIX[actor.tenantRole].has(action);
}
