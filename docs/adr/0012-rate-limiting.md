# ADR-0012: Rate limiting in Postgres now, Cloudflare rules later

- Status: accepted · Date: 2026-10-29 · Decider: Senior DevOps Engineer

## Decision
Auth endpoints use Better Auth's limiter with database storage. Write endpoints use a fixed-window counter (`rate_limit_bucket(key, window_start, count)`, one upsert per request; e.g. 120 ops-batches/min/user, 30 notes/min/user). On Cloudflare, add a WAF rate-limiting rule on `/api/auth/*` as an outer layer.

## Consequences
No Redis needed. Upsert cost is trivial at our write volume. Old buckets are deleted hourly.
