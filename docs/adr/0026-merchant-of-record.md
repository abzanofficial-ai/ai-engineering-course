# ADR-0026: Merchant of record for billing (supersedes the Stripe flag in ADR-0010)

- Status: accepted · Date: 2026-10-30 · Decider: Chief Architect (owner direction)

## Context

Learners pay a subscription (e.g. £24 per 6 months, annual option) and one-off industry project packs, in the UK and abroad. Training centres pay a set-up fee, a monthly platform fee and per-active-learner pricing.

## Decision

- Use a **merchant of record — Paddle or Lemon Squeezy** (chosen in Phase 4 on fees, payout terms and regional pricing). The MoR is the seller, so UK and international VAT/sales tax, invoices and chargebacks are theirs; regional pricing is supported.
- **Entitlements model (Phase 1, ADR-0010 updated):** product kinds `free | subscription | product | bundle`. `hasAccess(ctx, product)` is the only check. Until billing launches, the default tenant's `launchOpenToAllSignedIn` grants the subscription to every signed-in learner.
- Webhooks from the MoR verify signatures, are idempotent (event id as key), and call the same `grantEntitlement()` the admin screen uses. Everything billing-related sits behind feature flags (`billing.learner`, `billing.tenant`).
- Tenant billing (set-up, monthly, per active learner) is invoiced through the same MoR where possible; "active learner" = a membership with an activity day in the billing month, counted from `activity_day`.

## Consequences

ADR-0010's Stripe-behind-a-flag integration point is superseded; its entitlement tables remain, with `subscription` added. MoR fees (~5% + fixed fee) replace VAT registration and filing work; documented in the cost model.
