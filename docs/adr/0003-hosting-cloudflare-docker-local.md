# ADR-0003: Host on Cloudflare Workers (OpenNext); Docker Compose for local

- Status: accepted · Date: 2026-10-29 · Decider: Senior DevOps Engineer (product owner chose Cloudflare)

## Context
The product owner will use Cloudflare for production later, and wants a free, simple local setup on their own machine. The brief suggested Vercel or Docker on Fly/Render.

## Decision
- **Production (later):** Cloudflare Workers using `@opennextjs/cloudflare`. Static assets and cached HTML served from Cloudflare's edge; Postgres reached through **Hyperdrive** (connection pooling).
- **Local:** `docker compose up` starts Postgres 16 and Mailpit. The app runs with `pnpm dev` (or fully in Docker via the `app` profile).
- Until Cloudflare is connected, the deploy job in CI is present but skipped when `CLOUDFLARE_API_TOKEN` is not set.

## Consequences
- Code must be Workers-compatible on request paths: no Node-only modules at runtime (the Mermaid/Playwright step runs only at build time in CI). We use `postgres.js` (works with Hyperdrive) and avoid filesystem reads at request time — generated content is imported as modules.
- Workers Paid is $5/month; no per-seat cost (Vercel Pro would be $20/seat).

## Alternatives considered
Vercel (simplest Next.js host, but $20/month for commercial use and owner prefers Cloudflare); Render free tier (sleeps, slow cold starts — fails the LCP target).
