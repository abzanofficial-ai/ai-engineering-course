# ADR-0022: Installable PWA with offline chapters and web push reminders

- Status: accepted · Date: 2026-10-30 · Decider: Chief Architect, approved by product owner
- Amends ADR-0020 (push no longer waits for native apps).

## Context

Learners study on phones. The owner asked whether an installed web app can notify like a native app. Native apps are out of scope for the MVP.

## Decision

- **Installable PWA** (M2): web app manifest, icons, theme colours, and a service worker that
  - caches the app shell and every chapter the learner opens (stale-while-revalidate), so visited chapters work offline;
  - never caches `/api/*` responses (personal data) — progress writes queue in the client outbox instead (ADR-0009).
    An "Install app" prompt appears after the learner's second visit (Android/desktop `beforeinstallprompt`; iOS gets a short "Share → Add to Home Screen" hint).
- **Web push** (M5) alongside email for the three reminder types of ADR-0020, using the Web Push protocol with VAPID keys (env `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`). Sent from the same scheduled job, using a WebCrypto-based implementation that runs on Cloudflare Workers.
  - Permission is requested only after the learner switches a reminder on, never on page load.
  - `push_subscription(id, user_id, endpoint, p256dh, auth, user_agent, created_at)`; deleted on unsubscribe, on HTTP 404/410 from the push service, and by account deletion (cascade).
  - iOS/iPadOS 16.4+ receive push only when installed to the Home Screen; email remains the fallback.

## Consequences

No new paid service. Delivery is best-effort (OS battery and Focus modes may delay). The artifact preview cannot demonstrate push or offline, since its sandbox blocks service workers; they are tested in Playwright against the real app.
