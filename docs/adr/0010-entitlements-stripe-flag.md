# ADR-0010: Entitlements model now; Stripe behind a feature flag

- Status: accepted · Date: 2026-10-29 · Decider: Chief Architect

## Context
Core course free (account required); industry capstone packs sold later, possibly as bundles.

## Decision
Tables `product(code, kind free|paid|bundle, course?, price_pence?)`, `bundle_item(bundle, product)`, `entitlement(user, product, source default|grant|purchase, revoked_at)`. A single `hasAccess()` check used by pages and APIs. Admin can grant/revoke. Stripe webhook route exists, verifies signatures, and is 404 unless flag `payments.stripe` is on; it calls the same `grantEntitlement()`.

## Consequences
Launching payments is: configure Stripe keys, create products, turn on the flag. Paid content must be rendered at request time after `hasAccess()` (never in public static assets).
