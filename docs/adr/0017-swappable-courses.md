# ADR-0017: Courses are configuration

- Status: accepted · Date: 2026-10-29 · Decider: Chief Architect

## Decision

`content/courses.json` lists courses: `{ slug, title, source, product, publicChapters }`. Every route, table and key is namespaced by course slug. Adding a second course = add a Markdown file and a JSON entry; no code change. The parser handles the shared book conventions (`# Part`, `## Chapter`, `###` sections); a course that differs gets parser options in its config entry.
