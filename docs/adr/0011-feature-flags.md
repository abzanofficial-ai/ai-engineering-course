# ADR-0011: Feature flags in Postgres with env override

- Status: accepted · Date: 2026-10-29 · Decider: Senior DevOps Engineer

## Decision
`feature_flag(key, enabled, description, updated_by, updated_at)`, editable at `/admin/flags`, cached in memory for 30 s. `FLAG_<KEY>=on|off` env vars override (for tests and emergencies). Known keys are declared in code with defaults, so a missing row is never an error.

## Alternatives considered
LaunchDarkly/Unleash (extra service and cost for a handful of flags).
