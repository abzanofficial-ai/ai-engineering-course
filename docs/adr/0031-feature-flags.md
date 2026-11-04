# ADR-0031: Feature flags per tenant

- Status: accepted · Date: 2026-11-02 · Decider: Chief Architect, with the product owner
- Builds on ADR-0024 (tenant config), ADR-0030 (access rule and launch mode).

## Context

Launch mode ("every signed-in learner gets the full course") lived in the tenant config file, so
turning it off when paid plans start needed a code change and a deploy. The growth work that
follows (launch list, referrals, share cards) also needs to ship dark and be switched on when
ready, and per centre once centres have their own tenants.

## Decision

- **Registry in code** (`src/lib/flags.ts`): every flag is declared with a label, a description,
  an optional warning, and a default. A default may come from the tenant config (launch mode
  reads `access.launchOpenToAllSignedIn`), so existing configuration keeps working.
- **Overrides in the database**: table `feature_flag (tenant_id, key, enabled, updated_by,
updated_at)`. Only overrides are stored; deleting the row ("Reset to default") falls back to
  the default. Retired keys left in the table are ignored. `updated_by` is kept for audit and set
  to null if that account is deleted.
- **Reads** go through `flagsFor(tenantId)` (`src/server/repo/flags.ts`), cached for 30 seconds
  per server, so a change reaches every server within 30 seconds without a query per request.
- **Writes** only through `/api/admin/flags`, which needs `platform:flags:manage` (platform
  owner), checks same-origin JSON, validates the key against the registry and logs
  `flags.changed`. The `/admin/flags` screen asks for confirmation before a change that carries
  a warning.
- **First flag: `launch_open_access`.** The access check (`loadAccess`), the request gate
  (`src/proxy.ts`) and the plans page read it. If the proxy cannot read flags it treats launch
  mode as off: paid pages then need the signed access pass, which is checked without the
  database, so a database outage never opens paid content.

## Consequences

- The owner can switch launch mode off on the day billing starts, from the admin screen. Learners
  holding an access pass keep it until it expires (at most 15 minutes, ADR-0030).
- `/plans` is rendered per request, because its launch notice follows the flag.
- New features add a registry entry and read `flagsFor()`; nothing else is needed. A flag is
  removed by deleting its entry once the feature is permanent.
- Not in scope: percentage roll-outs and per-user targeting. Add them only when needed.
