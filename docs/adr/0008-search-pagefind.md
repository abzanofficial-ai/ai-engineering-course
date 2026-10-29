# ADR-0008: Full-text search with Pagefind (static, chunked index)

- Status: accepted · Date: 2026-10-29 · Decider: Chief Architect

## Context

Need full-text search across the whole course. Options: Postgres FTS (adds DB load to every keystroke) or a static index.

## Decision

Use **Pagefind**'s Node API to index custom records (one per section, with chapter/section metadata) at build time into `public/pagefind/`. The browser loads only the index chunks a query needs (typically < 100 KB).

## Consequences

Zero server cost per search; works offline once loaded. Paid content (future) is excluded from the public index and searched server-side when that feature arrives.

## Alternatives considered

Postgres FTS (DB load, more code); MiniSearch (whole index downloaded up front, ~300 KB+).
