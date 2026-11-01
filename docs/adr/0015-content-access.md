# ADR-0015: Public preview, sign-in for the rest; content is not secret

- Status: accepted · Date: 2026-10-29 · Decider: Chief Architect (owner approved)

## Update (2026-10-30)

Public pages are now a tenant setting (`access.publicPages`, ADR-0024). The business model adds a subscription with a free tier; until billing launches every signed-in learner has the whole course.

## Decision

Front matter ("Start here") and Chapter 1 are public and indexable; other chapters and all interactive features require sign-in. Gating is a cheap cookie-presence check in `proxy.ts`, so pages stay edge-cacheable. Free course content is not treated as confidential (search index snippets are public). Personal data and future paid content are confidential and are always authorised server-side.
