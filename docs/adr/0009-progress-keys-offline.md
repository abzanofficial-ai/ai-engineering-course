# ADR-0009: Learner data references content by stable string keys; offline outbox

- Status: accepted · Date: 2026-10-29 · Decider: Chief Architect

## Context
Re-imports must never lose progress; saving must tolerate flaky connections.

## Decision
- Keys: `ch-<n>`, section type or heading slug, `step-<label>`, card hash, as defined in architecture §4.2. Chapter number (fixed by the book's roadmap) is the identity; URL slugs are cosmetic with redirects.
- No foreign keys from personal tables to content. Diff preview reports removed/renamed keys and the number of affected learners.
- Writes are idempotent upserts keyed by composite PKs, sent through a client IndexedDB outbox, last-write-wins on client timestamp.

## Consequences
A renamed custom section heading resets "read" for that one section (flagged in diff). Orphaned rows cost a few bytes and reappear if the key returns.
