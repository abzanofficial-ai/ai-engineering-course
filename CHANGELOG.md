# Changelog

All notable changes are recorded here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### M1 — Content pipeline and static reader

#### Added

- Content importer (`src/content/`): parses `content/handbook.md` into a typed course model with
  stable keys for chapters, sections, lab steps, flashcards and glossary terms.
  - Front matter becomes "Start here" pages; the Index table drives "Coming soon" chapters
    (Chapter 0, Appendix A, Chapters 30–47).
  - Handles every template variant found in the book: inline `Definition:`, two labs in one
    chapter, `Step 7b`, commit instructions as heading or paragraph, drill reveal variants,
    jargon aliases, escaped `[placeholders]`, `#` comments inside code.
  - Raw HTML in the source is never rendered.
- Mermaid diagrams pre-rendered to light and dark SVG at build time, with generated alt text
  and a "Diagram as text" description; cached by content hash.
- Code highlighting (Shiki, high-contrast GitHub themes) with copy buttons; shell blocks copy
  only the commands, without `$ `.
- Static reader: course home (parts, chapters, coming soon), chapter pages with definition
  lede, sticky table of contents, chapter navigation, prev/next, light/dark/system theme.
- `pnpm content:diff` to preview a re-import; CI posts it on PRs that change the content.
- Security headers (CSP, HSTS, nosniff, frame-ancestors none, referrer and permissions policy).
- CI: lint, format, typecheck, unit tests, audit, build, Playwright e2e + axe accessibility.
- Docs: architecture, ADRs 0001–0018, test strategy, design system, README.
