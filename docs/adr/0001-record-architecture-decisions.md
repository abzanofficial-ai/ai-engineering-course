# ADR-0001: Record architecture decisions

- Status: accepted · Date: 2026-10-29 · Decider: Chief Architect

## Context
The brief requires every extra service and every change to the suggested stack to be justified.

## Decision
Use lightweight ADRs in `docs/adr/`, numbered, one decision each, using `0000-template.md`. Superseded ADRs stay, marked as superseded.

## Consequences
New services or stack changes without an ADR are rejected in code review.
