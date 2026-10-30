# Roadmap

Owner: Chief Architect. Status as of 2026-10-30. ✅ done · 🔄 in progress · ⏳ planned.

## Phase 1 — MVP (current)

| Milestone                           | Status                               | Scope                                                                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design docs                         | ✅                                   | Architecture, ADRs, test strategy, design system (incl. app-like redesign)                                                                                                                                                |
| M1 Content pipeline + static reader | ✅                                   | Idempotent import with stable keys, Coming soon, Mermaid SVG + alt text, Shiki code + copy, static pages, `content:diff`, CI                                                                                              |
| M2 Auth + progress                  | ✅                                   | Magic link (+ Google behind keys), account (rename, export, delete), progress API, route home, Learn/Practise/Decide/Review, XP, streaks, weekly goal, installable PWA, offline outbox                                    |
| Future-proofing (owner request)     | ✅                                   | Tenancy-ready data model, roles as data, tenant resolver, scoped repositories, branding via tenant config, tenant course/module settings, tenant isolation tests (ADR-0023, 0024)                                         |
| M3 Practice depth                   | 🔄                                   | Part checkpoints (ADR-0021), "Review due" spaced-repetition queue, sticky Sections list per mode, Previous chapter link, lab/drill polish                                                                                 |
| M4 Find and annotate                | ✅                                   | Full-text search (Pagefind), glossary page + hover/tap definitions, notes and bookmarks per section                                                                                                                       |
| M5 Certificates and admin           | 🔄 M5a certificates done; admin next | Verifiable certificates (part + course), admin import with diff preview + publish, aggregate analytics, feature flags, entitlements (free / subscription / product / bundle), reminder emails + web push (ADR-0020, 0022) |
| M6 Launch                           | ⏳                                   | Hardening, k6 load test (2,000 concurrent readers), accessibility audit, Cloudflare deploy, monitoring, backups, rollback runbook, cost model                                                                             |

## Phase 2 — White-label for training centres

⏳ Planned. Builds on ADR-0023/0024 without schema rewrites.

- Tenant resolved from domain/subdomain; custom domains with automated TLS (Cloudflare for SaaS)
- Branding admin screen: name, logo, colours, favicon, domain, email sender, certificate design, footer, support contact; per-host branding of static pages at the edge
- Tenant admin portal: invite learners, bulk CSV import, deactivate; manage tutors; cohorts (dates, schedule, live-session links); enable/disable modules (`tenant_course`); supplementary tenant content alongside (never inside) core content
- Tutor dashboard: per-learner progress, time spent, lab completion, drill answers to review and comment on, at-risk learners
- Funding evidence: guided learning hours, attendance, completion dates, milestones (10 hours, course completed, job/new-work outcome), CSV and PDF export, full audit trail
- Optional per-tenant SSO (Google, Microsoft)
- GDPR: tenant as controller, platform as processor; per-tenant export, deletion and retention; record of processing activities

## Phase 3 — LMS integration

⏳ Only when a centre needs it (ADR-0025).

- LTI 1.3 / LTI Advantage tool provider for Moodle, Canvas, Totara: launch + SSO, Deep Linking, Names and Role Provisioning, Assignment and Grade Services
- Standalone, LTI, or both, per tenant
- Documented CSV exports for funding/e-portfolio tools (Aptem, OneFile)
- SCORM: not planned (possible future option)

## Phase 4 — Billing

⏳ Behind feature flags (ADR-0026).

- Learner subscriptions (e.g. £24 / 6 months, annual) and one-off products via a merchant of record (Paddle or Lemon Squeezy), UK + international VAT, regional pricing
- Industry project packs (dental, legal, accounting, …) as a growing library for subscribers
- Tenant billing: set-up fee, monthly platform fee, per-active-learner pricing
- Entitlements already modelled in Phase 1
