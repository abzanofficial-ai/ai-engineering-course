# ADR-0027: Notes and bookmarks sync through the progress outbox

- Status: accepted · Date: 2026-10-30 · Decider: Chief Architect, with Senior SDET & QA Lead

## Context

Learners want to bookmark sections and keep their own notes, on any device and offline. Notes
are free text typed by a learner: personal data that could hold anything, so it must be private,
exportable, deletable, and never rendered as HTML.

## Decision

- **Same channel as progress.** Three new ops go through the existing outbox and
  `/api/me/ops` (ADR-0009): `bookmark {page, section, on}`, `note_save {id, page, section, body}`
  and `note_delete {id}`. No new endpoints, so the isolation suite's route list is unchanged and
  offline works for free.
- **Client-chosen ids.** A note's id is a UUID made on the device, so a note written offline
  keeps its identity when it syncs. The primary key is `(tenant_id, user_id, id)`: an id is only
  meaningful inside the learner's own namespace, so another learner sending the same id creates
  their own row and can never read, edit or delete the original.
- **Last write wins** on the client timestamp, as for lab steps. Bookmarks are a flag rather than
  a delete so a late "on" cannot override a newer "off".
- **Deletes are final.** `note_delete` sets a tombstone and erases the body at once; a later
  `note_save` for that id is ignored, so a stale device cannot bring deleted text back.
- **Limits.** Body 1–5,000 characters after trimming; sections must exist in the course index.
- **No XP and no streak** for notes or bookmarks: they are not learning actions.
- **Rendering.** Notes are shown as React text with `white-space: pre-wrap`; they never pass
  through `dangerouslySetInnerHTML`, and an e2e test proves typed markup stays literal.
- **Privacy.** Both tables are tenant-scoped, included in the data export, and cascade-deleted
  with the account. Tutors (Phase 2) do **not** see notes unless a later ADR decides otherwise
  with the learner's consent.

## Consequences

- The local snapshot stores note text on the device, as it already does for drill answers; it is
  cleared on sign-out.
- Tombstones stay in the table (without text). A retention job can purge them in M6.
