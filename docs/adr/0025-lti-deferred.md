# ADR-0025: LTI 1.3 deferred to Phase 3; SCORM not planned

- Status: accepted · Date: 2026-10-30 · Decider: Chief Architect

## Context

Training centres may want the course inside Moodle, Canvas or Totara.

## Decision

- Build an **LTI 1.3 / LTI Advantage tool provider in Phase 3**, only when a centre needs it: OIDC launch with SSO into the tenant, Deep Linking (tutors pick chapters/labs), Names and Role Provisioning (cohort sync), Assignment and Grade Services (completion to the gradebook). Each tenant can use the app standalone, via LTI, or both.
- Groundwork now: tenant-scoped memberships and roles (ADR-0023) map directly onto LTI contexts and roles; stable content keys give Deep Linking stable targets; completion is computed server-side from progress tables, ready to post as scores.
- Documented CSV exports for funding/e-portfolio tools (e.g. Aptem, OneFile) come with Phase 2 reporting.
- **SCORM packaging is not planned**: it would freeze content into static packages and lose server-side progress, entitlements and updates. Noted as a possible future option only.

## Consequences

No LTI libraries, keys or endpoints until Phase 3. A new ADR will pick the LTI library and key management then.
