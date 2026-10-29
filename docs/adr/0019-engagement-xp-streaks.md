# ADR-0019: Engagement — XP, streaks, weekly goal and visible progress

- Status: accepted · Date: 2026-10-29 · Decider: Senior UI/UX Designer, approved by product owner
- Supersedes the "calm, no gamification" principle in the first design-system draft.

## Context

Preview feedback: the reader felt like "another PDF". The owner asked for points, streaks, reminders, progress percentages and a test after each part. Learners study alongside a job (the book budgets six to nine months), so motivation must reward real work and survive busy weeks.

## Decision

- **XP for real work, never for page views.** Earned once per item (idempotent by event id):

  | Action                                                 | XP  |
  | ------------------------------------------------------ | --- |
  | Learn section marked read                              | 5   |
  | Lab step ticked                                        | 10  |
  | "I committed it"                                       | 50  |
  | Decision drill answered (≥ 20 characters, not skipped) | 30  |
  | Flashcard rated (first time per card)                  | 5   |
  | Part checkpoint passed                                 | 200 |

  Unticking does not remove XP (no punishment for correcting a mistake); re-ticking never awards twice.

- **Streak:** a day counts when the learner earns any XP (learner's local date, sent by the client and clamped server-side to ±1 day of UTC). One **streak freeze** is earned per 7-day streak (max 2) and is used automatically for a single missed day.
- **Weekly goal:** default 3 active days per week (Mon–Sun), learner-adjustable 1–7. Shown as a ring; the primary motivator, because it fits learners with jobs better than daily streaks.
- **Progress percentages:** chapter = average of its parts (Learn read, lab steps + commit, drill, cards rated); part = average of published chapters; course = average of parts. Shown as text as well as rings (WCAG: never colour-only).
- **No leaderboards, no loss-aversion dark patterns** (no "you'll lose everything" copy, no paid streak repair).

## Data model

- `xp_event(user_id, course, event_id, points, created_at)`, PK `(user_id, course, event_id)` — the idempotency key is the PK, so double-submits and offline replays cannot award twice.
- `activity_day(user_id, day)` — already planned for analytics; now also drives streaks.
- `user_settings(user_id, weekly_goal, timezone)`.
- Streak and totals are computed (SQL over the above), not stored, so they can never drift.

## Consequences

Awarding happens server-side inside the same transaction as the progress write; the client only displays the result. Isolation tests cover the new tables.
