# ADR-0014: Email via Resend in production, Mailpit locally

- Status: accepted · Date: 2026-10-29 · Decider: Senior DevOps Engineer

## Decision
`sendEmail()` uses Resend's HTTP API when `RESEND_API_KEY` is set, otherwise SMTP to Mailpit (`docker compose`), whose UI at http://localhost:8025 shows magic links. In tests, emails are captured in memory.

## Consequences
The whole sign-in flow works locally and in CI without any account.
