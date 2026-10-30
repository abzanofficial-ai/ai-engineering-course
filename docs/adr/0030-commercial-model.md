# ADR-0030: Commercial model — direct learners, centre licences and seat packs

- Status: accepted · Date: 2026-10-30 · Decider: product owner, with Chief Architect
- Builds on ADR-0010 (entitlements), ADR-0023 (tenancy) and ADR-0026 (merchant of record).

## Context

The owner wants two routes to market: learners who subscribe directly, and training centres.
For centres, a flat monthly fee for unlimited students undercharges large centres, and a 30%
revenue share needs payment splitting that a merchant of record does not offer, exposes us to
the centre's pricing, refunds and chargebacks, and needs a minimum fee anyway. We build the
recommended model now and change the numbers when the first centres give feedback.

## Decision

Three offers, all priced in `content/plans.json` (editable without code). The prices there
are **placeholders until tested with real centres**.

1. **Direct** — individual learners: monthly, annual or one-off lifetime access to a course.
   Grants an `entitlement` (source `direct`) when payment is confirmed (Phase 4 webhook).
2. **Centre licence (white-label)** — a centre's own tenant (ADR-0023). Monthly base fee that
   includes a number of **active learners**, plus a fee per extra active learner, and an
   optional set-up fee. Every active member of a licensed tenant has access. An active learner
   is a member with at least one activity day in the calendar month (UTC), counted from
   `activity_day`; the admin screen shows the count and the invoice amount.
3. **Seat packs (instead of revenue share)** — a centre buys N learner places at a wholesale
   price per seat (cheaper for bigger packs) and charges its students what it likes. We create
   the pack and give the centre one **join code**; each student who redeems it gets an
   `entitlement` (source `seat`) for the pack's access period. A pack cannot be over-redeemed.
   Codes are 12 random characters from a 30-character alphabet without look-alikes (about 59 bits); only a hash is
   stored, redemption is rate-limited, and codes can be revoked or regenerated.

Also:

- **One access rule** (`decideAccess`) used by pages, APIs and the admin screen, in order: public
  page → allowed; signed out → sign in; launch mode (`launchOpenToAllSignedIn`, on until
  billing launches) → allowed; active centre licence + active membership → allowed; active
  entitlement → allowed; free-tier page → allowed; otherwise → plans page.
- **Static pages stay static.** When launch mode is off, the proxy asks for a short-lived
  signed access pass (HMAC with `AUTH_SECRET`, 15 minutes, bound to the user, tenant and
  course). Without a valid pass it sends the learner to `/access`, which checks the database,
  issues the pass and returns them, or sends them to `/plans`. Progress, checkpoint and
  certificate APIs check access on the server for every write.
- **Admin access (manual grants)** has source `admin`, optional end date, and is revocable.
  Entitlements are never deleted by revocation (audit), only marked revoked.
- **Payments:** until Phase 4, the plans page shows prices without checkout, and centres are
  invoiced manually from the admin screen's figures.

## Must be done before billing launches

- Build the search index from public and free-tier pages only (or serve it behind access);
  today it contains every chapter's text, which is fine only while launch mode is on.
- Connect the merchant-of-record webhook to `grantEntitlement()` (ADR-0026).
- A data processing agreement template for centres (they are controller, we are processor).

## Consequences

- Revenue grows with centre size; seat packs give centres a reseller margin without payment
  splitting; our income per seat is fixed and paid up front.
- Changing a price or the free tier is a config change; changing the model is a new ADR.
