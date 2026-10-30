# ADR-0018: Content Security Policy compatible with static, edge-cached pages

- Status: accepted · Date: 2026-10-29 · Decider: Chief Architect (with QA, who found the issue in a browser test)

## Context

Next.js embeds inline `<script>` tags in every page for hydration data, which differs per page. A strict CSP needs per-request nonces, and nonces force dynamic rendering — losing static generation and edge caching (a core NFR). Hashes cannot be precomputed for Next's inline scripts.

## Decision

`script-src 'self' 'unsafe-inline'` (no `unsafe-eval` in production), with every other directive strict: `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `connect-src 'self'`.

XSS is prevented at the source rather than relying on CSP:

- Course Markdown is rendered with raw HTML disabled; the only HTML injected is our own importer output.
- User-written text (notes, drill answers) is only ever rendered as React text nodes, never as HTML — enforced by a lint rule banning `dangerouslySetInnerHTML` outside `src/components/section-blocks.tsx` and the reader page, which render importer output only.
- No third-party scripts.

## Consequences

CSP is defence in depth, not the primary XSS control. Revisit if Next.js ships hash-based inline script support for static pages.

## Update (M4)

`script-src` adds `'wasm-unsafe-eval'` so the static search index (Pagefind, ADR-0008) can compile its WebAssembly module. It permits WebAssembly compilation only; JavaScript `eval` stays blocked in production.
