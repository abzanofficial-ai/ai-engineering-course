# ADR-0020: Opt-in reminder emails

- Status: accepted · Date: 2026-10-29 · Decider: Senior DevOps Engineer (delivery), Chief Architect (privacy)

## Decision

Three reminder types, **all off by default** (UK GDPR / PECR: explicit opt-in for non-transactional email):

1. Weekly progress summary (Sunday evening, learner's timezone).
2. Streak reminder at 20:00 local if no activity today and the streak is ≥ 3 days.
3. Flashcards due (at most once a week).

- Consent stored in `reminder_pref(user_id, kind, enabled, consented_at)`; every email has a signed one-click unsubscribe link (RFC 8058 `List-Unsubscribe-Post`).
- Sent by a scheduled job (Cloudflare Cron Trigger calling `/api/cron/reminders` with a secret) through the existing `sendEmail()` (Resend). No new service.
- Never more than one reminder email per learner per day; suppressed for 7 days after a hard bounce.

## Consequences

Cost stays inside Resend's free tier at launch (weekly email to opted-in learners only); the cost model notes the Pro tier ($20/month) once volume exceeds 3,000 emails/month. Push notifications: see ADR-0022 (web push via the installable PWA), sent alongside these emails.
