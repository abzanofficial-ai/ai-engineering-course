# ADR-0029: Verifiable certificates

- Status: accepted · Date: 2026-10-30 · Decider: Chief Architect, with Senior SDET & QA Lead

## Context

Phase 1 promises verifiable certificates per part and for the course (architecture §6.4,
ADR-0021). We must decide what "complete" means, how certificates are issued and verified, and
how they stay private and deletable.

## Decision

- **Part certificate (`part:N`)**: every published chapter in the part is 100% complete
  (every Learn section read, every lab step ticked and committed, the drill answered and
  revealed, every interview question rated) **and** the part checkpoint is passed.
- **Course certificate (`course`)**: every part certificate is earned **and** the course has no
  "coming soon" chapters. We do not certify a course that is not fully written; the page says
  when it will be available.
- **Issued on request, checked on the server.** The learner presses "Claim certificate"; the
  server recomputes completion from the database and never trusts the client. Issuing is
  idempotent (one per learner, course and scope).
- **The name on the certificate** is the account name at issue time (`name_snapshot`). A name
  is required; the learner sets it on the Account page.
- **Verification**: `/certificates/<id>`, where the id is 128 random bits (base64url). The
  public page shows only the name, scope, course, date and issuer, with `noindex`. Unknown or
  deleted ids return 404.
- **Privacy**: the table is tenant-scoped, included in the export, deletable by the learner
  and removed with the account. Issuer wording comes from the tenant's `certificate` branding.
- **Printing**: the page has print styles, so "Print or save as PDF" in the browser produces a
  clean one-page certificate. No server-side PDF in Phase 1.

## Consequences

- Earning a certificate takes real work (labs and drills), which is the point of the course.
- Later, the same table can carry tutor-issued or LTI-reported completions.
