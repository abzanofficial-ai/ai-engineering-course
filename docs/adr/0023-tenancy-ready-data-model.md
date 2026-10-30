# ADR-0023: Tenancy-ready data model, roles as data, one scoped data layer

- Status: accepted · Date: 2026-10-30 · Decider: Chief Architect (owner approved)

## Context

Phase 2 white-labels the platform for training centres on one codebase and deployment. Retro-fitting tenancy into personal data later means rewriting every query and migrating every row under load. Today there is one tenant.

## Decision

- **Identity is global, membership is per tenant.** Better Auth's `user`/`session`/`account` tables are the platform's sign-in identity (one email, one login). `membership(tenant_id, user_id, role, status)` grants access to a tenant. A learner at two centres has one login and two separate memberships with fully separate learning data.
- **Every tenant-owned table carries `tenant_id`** (FK to `tenant`), first in its primary key: section progress, lab steps, lab completions, drill answers, flashcard reviews, last position, XP events, activity days, settings — and, when built, certificates, notes, bookmarks, entitlements and analytics events. One default tenant, `tnt_default`, owns everything today. Migration 0001 backfills existing rows.
- **Roles are data.** Tenant roles on `membership.role` (`tenant_admin | tutor | learner`, enforced by a check constraint); the platform role on `user.platform_role` (`platform_owner` or null). `src/server/authz.ts` holds the only permission matrix (`can(actor, action)`). Only `learner` and `platform_owner` are used now.
- **One tenant resolver.** `resolveTenant(req)` (`src/server/tenant.ts`) returns the default tenant; Phase 2 resolves from the request host. It never reads a tenant from query, body, cookies or custom headers (tested).
- **One data layer.** `requireContext(req, action)` yields `ctx = { tenantId, userId }`; every repository in `src/server/repo/` applies both scopes. A lint rule forbids importing the database client anywhere else (exceptions: auth adapter, rate limiter, health check, migrations).
- **Content ownership.** Course content stays platform-owned in files and the build output; `tenant_course(tenant_id, course, enabled, disabled_modules)` lets a tenant offer or switch off courses, parts or chapters without copying content.

## Consequences

- Phase 2 adds host-based resolution, tenant admin and tutor features without changing existing tables or queries.
- "Delete my account" deletes the global identity and cascades to the learner's data in every tenant; per-tenant erasure (tenant as controller) is a Phase 2 addition.
- Isolation is tested at two levels: user×user (routes) and tenant×tenant (repositories), with suites that fail if a new route or repository function is not classified.

## Alternatives considered

Separate accounts per tenant (unique `(tenant_id, email)`): stronger separation, but conflicts with Better Auth's global email uniqueness and makes learners at two centres manage two logins. Schema- or database-per-tenant: strongest isolation, far more operational cost at our scale.
