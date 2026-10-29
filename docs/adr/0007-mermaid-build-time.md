# ADR-0007: Render Mermaid to SVG at build time, light and dark, with alt text

- Status: accepted · Date: 2026-10-29 · Decider: Senior UI/UX Designer, with DevOps

## Context

75 diagrams. Client-side Mermaid is ~1 MB of JS and shifts layout; the handbook has no alt text.

## Decision

- The importer renders each diagram with the Mermaid library in headless Chromium (Playwright) into **two SVG files** (light, dark), named by content hash, cached in `.cache/mermaid/` so unchanged diagrams are not re-rendered.
- Served as `<img>` with explicit `width`/`height` (no layout shift); the inactive theme's image is `display:none` and `loading="lazy"`, so it is not downloaded.
- **Alt text:** an optional `%% alt: …` comment line in the block wins; otherwise a short alt is generated ("Flowchart: <first node> → … (N steps)") plus a full text description generated from nodes and edges, available in an expandable "Diagram as text" disclosure.
- If Chromium is unavailable (e.g. a quick local build), the importer falls back to rendering the source in a `<pre>` with the text description, and logs a warning. CI always has Chromium.

## Consequences

Zero Mermaid JS shipped to learners. Build needs Chromium (present in CI and in the dev container).
