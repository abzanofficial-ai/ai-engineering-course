# ADR-0013: Observability — JSON logs, Sentry, uptime checks, cookieless analytics

- Status: accepted · Date: 2026-10-29 · Decider: Senior DevOps Engineer

## Decision

- **Logs:** `pino`-style structured JSON to stdout with request id, route, status, duration, hashed user id. Cloudflare Workers Logs collects them.
- **Errors:** Sentry, enabled only when `SENTRY_DSN` is set; no PII (`sendDefaultPii: false`).
- **Uptime:** `/api/health` (checks DB) polled by UptimeRobot/Cloudflare health checks.
- **Product analytics:** Cloudflare Web Analytics (cookieless, free) for traffic; learning analytics computed from our own tables (aggregate only). No cookies ⇒ no consent banner.
