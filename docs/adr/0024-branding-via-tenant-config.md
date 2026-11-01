# ADR-0024: Branding and access settings via tenant configuration

- Status: accepted · Date: 2026-10-30 · Decider: Senior UI/UX Designer and Chief Architect

## Decision

- `content/tenants/default.json` holds the default tenant's settings: name, short/header names, tagline, home intro, default course, logo icons, brand-mark colours, theme colours, email sender, support contact, footer, certificate wording, and access policy (public pages, post-billing free tier, launch access). A tenant record's `config` JSON overrides any field (`brandingFor`).
- Components, the web app manifest, emails and auth read branding from `src/lib/branding.ts`; colours reach CSS as variables (`--brand-mark`) on top of the design tokens. A test fails if a brand literal appears in `src/`.
- Static content pages are built before any request, so they carry the default tenant's branding. **Phase 2:** per-host branding for static pages by injecting tenant CSS variables and names at the edge (no per-tenant rebuilds); emails, manifest and dynamic pages already use the request's tenant.
- Access policy defaults (owner decision 2026-10-30): Start here and Chapter 1 public; until billing launches every signed-in learner gets the whole course; the post-billing free tier is Start here + Part 1, changeable in config.

## Consequences

White-labelling becomes data entry plus an admin screen, not code changes.
