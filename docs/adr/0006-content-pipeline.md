# ADR-0006: Build-time content import from Git; static pages; publish = commit

- Status: accepted · Date: 2026-10-29 · Decider: Chief Architect

## Context

`content/handbook.md` is the single source of truth and will be re-exported repeatedly. Content pages must be static/edge-cached. Admins need a diff preview before publishing.

## Decision

- An importer (`src/content/`) parses the Markdown AST into a typed course model and generated files in `.content/` at build time. Pages are statically generated from those files. No content lives in the database.
- Publishing a new version = committing a new `content/handbook.md` to `main` (by a developer, or by the admin screen through the GitHub API behind flag `content.githubPublish`). The diff preview uses the same importer.
- Output is deterministic; the importer is tested for idempotency.

## Consequences

- Reading content costs no database queries; rollback of content = `git revert`.
- A publish takes one CI build (~minutes), not seconds. Acceptable for a book updated chapter by chapter.

## Alternatives considered

Content in Postgres with on-demand revalidation (instant publish, but every page depends on the DB and the Cloudflare incremental cache — more moving parts); MDX (would require rewriting the source, which we must not do).
