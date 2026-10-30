# Test strategy

Owner: Senior SDET & QA Lead. Rule: **nothing merges without the tests that prove it**, and no test is skipped, disabled or quarantined to get a green build.

## 1. Risk-based priorities

| Risk                                                           | Impact                              | Primary defence                                                               |
| -------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| A learner reads or changes another learner's data              | Severe (privacy breach)             | Isolation test suite against a real Postgres (§4)                             |
| Re-import loses or scrambles progress                          | Severe (trust)                      | Importer golden + idempotency + key-stability tests                           |
| Parser mis-reads the book (wrong sections, broken labs/drills) | High                                | Fixture tests from real handbook edge cases + full-file structural assertions |
| Drill reveal leaks before answering                            | Medium                              | Unit + e2e                                                                    |
| Progress lost when offline                                     | High                                | Outbox unit tests + Playwright offline e2e                                    |
| Accessibility regressions                                      | High (WCAG 2.2 AA is a requirement) | axe on every page type, keyboard e2e                                          |
| Performance regressions (LCP, CLS)                             | Medium                              | Lighthouse CI budget on reader pages; k6 for APIs                             |
| Auth abuse                                                     | High                                | Rate-limit tests, magic-link single-use/expiry tests                          |

## 2. Test pyramid and tools

| Layer         | Tool                                                     | Scope                                                                                                     | Runs                             |
| ------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Static        | ESLint, `tsc --noEmit`, Prettier                         | All code                                                                                                  | Every push                       |
| Unit          | Vitest                                                   | Parser, keying, diff, glossary matcher, Leitner scheduler, outbox, entitlements logic, validation schemas | Every push (< 30 s)              |
| Integration   | Vitest + Postgres (Docker/CI service)                    | Repository layer, API route handlers, isolation, rate limits, export/delete                               | Every push                       |
| End-to-end    | Playwright (Chromium; mobile viewport project)           | Learner journeys, admin journeys, offline sync                                                            | Every PR                         |
| Accessibility | `@axe-core/playwright` + keyboard-only scripts           | Every page type, light and dark                                                                           | Every PR                         |
| Performance   | Lighthouse CI (LCP < 2.5 s on simulated 4G, CLS < 0.1)   | Home, chapter, glossary                                                                                   | PR (main pages)                  |
| Load          | k6                                                       | 2,000 virtual readers + write mix                                                                         | M6, before launch, and on demand |
| Security      | `pnpm audit`, header assertions, isolation suite, CodeQL | —                                                                                                         | Every PR / weekly                |

## 3. The content pipeline (highest-leverage tests)

- **Fixture tests:** small Markdown fixtures reproducing each edge case found in the handbook: `#` comments inside code, fenced code in blockquotes, `Step 7b`, two labs in one chapter, lab without "When it breaks", Chapters 1–6 commit-as-paragraph, Chapter 2 with no commit marker, drill reveal variants, jargon aliases (`Package / dependency`, `Asynchronous (async)`), escaped `\[placeholders\]`, unlinked Index entries, dead anchors.
- **Real-file structural assertions:** parsing `content/handbook.md` yields 29 published chapters (1–29), 20 coming-soon entries (Chapter 0, Appendix A, Chapters 30–47), 15 parts, 75 diagrams, every chapter has jargon/interview/lab/drill/stuck, 231 lab steps, 0 raw HTML nodes.
- **Idempotency:** importing twice produces byte-identical output.
- **Key stability:** editing prose, reordering sections, or adding a chapter does not change any existing key; renaming a custom heading changes exactly one key and the diff reports it.
- **Re-import with progress:** integration test seeds synthetic progress, imports a "next export" fixture (extra chapter + edited text), asserts all prior progress rows still resolve and the new chapter appears.

## 4. Isolation tests (prove no cross-learner access)

For **every** personal resource (section progress, last position, lab steps, lab completion, drill answers, card reviews, notes, bookmarks, certificates-private view, export) the suite creates learners A and B with synthetic data, then as B:

1. reads A's resource by every addressing route (keys, ids) → gets only B's own data (empty) or 404;
2. attempts to update/delete A's note by id → 404, A's row unchanged;
3. sends a payload containing `userId: A` → ignored (server uses the session);
4. calls the API with no session → 401;
5. requests `/api/me/export` → contains no A data;
6. as a non-admin calls every `/api/admin/*` route → 403.

The suite enumerates API routes from the filesystem and **fails if a new personal route has no isolation case**, so coverage cannot silently drift.

## 4b. Tenant isolation (ADR-0023)

Only one tenant exists in production, but every repository function is tested against a second tenant created inside the test:

1. The same learner in two tenants has fully separate progress, answers, XP and streaks.
2. A learner in tenant B cannot see tenant A's learner's data, even with identical content keys.
3. Data export covers only the current tenant.
4. Requests always run in the resolved tenant: a tenant named in the query, body, headers or cookies is ignored.
5. A disabled course is not found; a disabled module refuses progress.
6. Every export of `src/server/repo/*` must be classified as tenant-scoped, identity-level or infrastructure — a new function fails the suite until it is classified (and, if tenant-scoped, tested).
7. A migration test builds a pre-tenancy database, applies the migrations, and proves every row is kept and assigned to the default tenant.

Phase 2 extends these to host-based resolution (tenant A's domain can never serve tenant B's data) and to tutor/tenant-admin roles.

## 5. End-to-end journeys (Playwright)

1. Sign up by magic link (email captured from Mailpit/in-memory), set name, sign out/in.
2. Course home shows parts, per-part progress, "Continue" goes to last position.
3. Read a chapter: TOC jumps, code copy (strips `$ `), diagram visible with alt text, theme toggle, prev/next.
4. Lab: tick steps, reload — ticks persist; expand "When it breaks"; confirm "I committed it".
5. Drill: reveal button disabled until an answer is written (or "skip" chosen); answer persists; reveal shows reasoning.
6. Quiz: rate cards, unsure ones reappear in "Review due".
7. Search finds a phrase from a lab; glossary search; hover/tap definition.
8. Notes and bookmarks per section; appear in dashboard.
9. Complete all chapters of a part (via seeded progress) → certificate issued → public URL verifies while signed out.
10. Offline: go offline, tick steps, reload, go online → synced.
11. Admin: upload changed handbook → diff shows the new chapter → publish disabled without GitHub token shows CLI instruction; grant entitlement; toggle flag; analytics shows aggregate numbers only.
12. Delete my account → can no longer sign in, certificate URL 404s, export before deletion contains everything.

Each journey runs at desktop (1280×800) and mobile (Pixel 7) viewports; key screens in light and dark.

## 6. Accessibility

- axe (WCAG 2.2 A/AA tags) on: home, chapter, lab, drill, quiz, glossary, search, dashboard, account, certificate, admin pages — zero violations allowed.
- Keyboard-only script: skip link, TOC, code copy, lab ticks, drill submit/reveal, flashcard flip/rate, dialogs trap and return focus.
- Reduced motion: no animation when `prefers-reduced-motion: reduce` (asserted via emulation).
- Manual audit at M6 with VoiceOver + NVDA, recorded in `docs/accessibility-audit.md`.

## 7. Test data

- Seeds and fixtures contain **only synthetic learners** (`learner-a@example.test`), never real data. `.test` TLD guarantees no email can be delivered.
- Each integration/e2e worker uses its own schema-reset database; tests never share state.

## 8. Entry/exit criteria per milestone

- **Entry:** acceptance criteria written in the milestone issue; test cases listed.
- **Exit:** all layers green in CI; new code covered (target ≥ 85 % lines for `src/content` and `src/server`; coverage is a smell detector, not a goal); milestone summary lists what was tested and what was not.

## 9. Defect policy

A bug fix starts with a failing test reproducing it. Flaky tests are fixed or the underlying race is fixed — never retried into green.
