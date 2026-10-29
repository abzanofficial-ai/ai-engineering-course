# ADR-0005: Better Auth for authentication

- Status: accepted · Date: 2026-10-29 · Decider: Chief Architect

## Context

Need email magic link + Google, sessions, account deletion and auth rate limiting. Auth.js (NextAuth) v5 — the App Router version — is still a beta release; v4 targets the Pages-era API.

## Decision

Use **Better Auth** (stable 1.x, MIT): magic-link plugin, Google provider, Drizzle adapter (tables in our own Postgres), built-in rate limiting, `deleteUser`. Self-hosted in our app, so no extra service.

## Consequences

- Auth tables live with our data; account deletion cascades in one transaction.
- Magic-link emails go through our `sendEmail()` (Resend in prod, Mailpit locally — ADR-0014).

## Alternatives considered

Auth.js v5 beta (beta in production auth is a risk); managed providers like Clerk/Auth0 (extra service, per-MAU cost at 100k learners, data leaves our DB).
