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

## Update (M5c): the admin content screen

- `/admin/content` (platform owners only) uploads a new export, builds it with the same
  importer and the live build's diagram sizes (`.content/<course>/renders.json`), and shows the
  difference: new, removed and newly published pages, address changes, edited sections, lab
  steps and questions, and import warnings.
- Publishing commits the file through the GitHub contents API (`GITHUB_PUBLISH_TOKEN` with
  contents:write, `GITHUB_REPOSITORY`, `GITHUB_PUBLISH_BRANCH`). Only the exact file that was
  previewed can be published (SHA-256 check). If a version would hide content learners have
  progress on, the owner must confirm first. Without a token the screen shows the command-line
  steps instead. The `content.githubPublish` flag is replaced by "is a token configured".
