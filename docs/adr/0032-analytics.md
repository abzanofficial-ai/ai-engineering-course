# ADR-0032: Aggregate analytics and source tracking without cookies

- Status: accepted · Date: 2026-11-04 · Decider: Chief Architect, with the product owner
- Builds on ADR-0013 (logging), ADR-0023 (tenancy), ADR-0030 (commercial model), ADR-0031 (flags).

## Context

The owner is about to run social posts, ads and outreach, and needs to know which of them
bring visitors and learners, and where learners stop in the course. The sign-in page promises
"No tracking cookies". Third-party analytics and ad pixels would break that promise and, under
UK PECR and GDPR, need a consent banner.

## Decision

- **Source of a visit:** `utm_source`, `utm_medium` and `utm_campaign` on the link, or else the
  referring site (normalised: `lnkd.in` → `linkedin.com`, `t.co` → `x.com`, search engines →
  `google`/`bing`… with medium `organic`), or else `direct` (`src/lib/attribution.ts`). Values are
  lower-cased and limited to `[a-z0-9._-]`, 40 characters.
- **No cookies, no device storage.** The browser keeps the source in memory only
  (`src/components/attribution.tsx`): it lasts while the visitor moves around the site and is
  gone when the tab closes.
- **Visits:** each page load by a visitor who is not signed in sends one `POST /api/visit`,
  which adds 1 to a daily counter per source (`traffic_daily`). Nothing about the visitor is
  stored. Abuse is limited to 60 counts per hour per client, keyed by an HMAC of the address in
  the existing rate-limit table; the address itself is never stored.
- **Signups:** the sign-in link carries the source as UTM parameters (so it survives opening the
  email on another device). After sign-in the app posts it once to `/api/me/attribution`, which
  stores one `signup_source` row if the learner joined this tenant in the last 24 hours and has
  none yet, then removes the parameters from the address bar. The row is part of the learner's
  data export and is deleted with their account.
- **Report:** `/admin/analytics` (needs `platform:analytics:read`) shows counts only, per tenant
  and course, for the last 7, 30 or 90 days: visits, new learners, active learners, paid or
  centre places; visits and new learners by source; active learners each week; for every
  chapter, learners who started and who read every Learn section (all time); and checkpoint
  attempts and passes per part. No learner is named or listed.

## Consequences

- Visits are page loads by signed-out visitors, not unique people; reloads count again. That is
  enough to compare channels, which is the purpose.
- Signups with no recorded source are shown as `direct`.
- If ads later need conversion reporting back to the ad platform, use a server-side conversions
  API with consent, never a pixel (decide then, in a new ADR).
- The signed-in redirect from `/` to `/home` now keeps the query string, so the source survives it.
