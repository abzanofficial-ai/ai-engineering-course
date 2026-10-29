# ADR-0016: Spaced repetition with a Leitner box schedule

- Status: accepted · Date: 2026-10-29 · Decider: Senior UI/UX Designer

## Context
Learners rate each interview question "confident" or "unsure"; the book has no model answers (owner approved: learner writes an answer, self-rates, gets links back to the chapter).

## Decision
Leitner boxes 1–5 with intervals 1, 3, 7, 14, 30 days. "Unsure" → box 1 (due tomorrow); "confident" → next box. Review queue = due cards, unsure first. Pure function, unit-tested.

## Alternatives considered
SM-2 (needs a 0–5 grade; our input is binary).
