# Changelog

All notable changes are recorded here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### M5c: Content import from the admin screen

#### Added

- `/admin/content`: upload a new handbook export and see exactly what would change:
  - new, removed or newly published pages, and address changes;
  - edited sections, and lab steps or questions added or removed;
  - import warnings.
- Content that learners have progress on can't disappear without the owner confirming it.
- Publish commits the file to GitHub, which triggers the CI rebuild. Only the exact previewed
  file can be published. Without a token, the screen shows the command-line steps.
- An admin menu links Content and Access and centres.
- The build saves diagram sizes (`renders.json`), so the preview matches the live build exactly.

#### Fixed

- The first version of the preview reported every chapter with a diagram as edited, because
  the preview built without the live diagram sizes. Caught by the new end-to-end test.
- A timing race in the account-deletion end-to-end test: it now checks the confirmation instead
  of a URL that the page tidies away.

#### Tests

- Unit: GitHub publishing (sha, branch and base64 content; creating a new file; GitHub's
  refusal reason) with a fake fetch.
- Integration:
  - owner-only access, and the admin-route guard extended;
  - the preview of an edited real handbook shows only Chapter 1, with its two sections;
  - a tampered file and missing consent are refused;
  - the instructions shown without a token;
  - a commit through a stubbed GitHub API.
- E2E: upload, preview, the consent checkbox, the publish instructions, the admin menu, axe;
  learners get a 404.

### Plum palette across the app

#### Changed

- New palette everywhere (design-system §6.5):
  - plum dark mode and blush light mode, following the reader's system setting;
  - peach → pink → lavender gradients on headlines, primary buttons, progress bars, the
    landing ring, hero glows and banners, while reading surfaces stay solid and calm;
  - part colours follow the same family, and chapter headers blend into the page colour;
  - code blocks are white in light mode;
  - the brand mark, theme colours and share image are updated.
- Accessibility: all axe suites pass in light and dark.

### Landing page and SEO

#### Added

- A founders section with the owner's tagline, "From Idea to Customers: Building your Startup
  with AI" and "For non-technical founders who want to go from idea → product → paying
  customers". The three steps map to the parts that teach them, and the unwritten ones are
  marked "coming soon".

- Motion and lazy rendering on the landing page, all CSS. It works without JavaScript and is
  switched off entirely with "reduce motion":
  - the fifteen parts orbit slowly and stay upright, and the dashed track turns;
  - milestone parts pulse, the centre glows, and parts pop in one by one and grow on hover;
  - the hero copy and numbers arrive in sequence, the headline gradient drifts, and the main
    button catches a light sweep;
  - sections, cards, route stops and FAQ rise in as they scroll into view, and the capstone
    layers slide in;
  - below-the-fold sections render only when they come near the screen
    (`content-visibility: auto`).
    Content is never hidden waiting for an animation; browsers without scroll-driven animations
    simply show it.

- A public landing page at `/`, built only from the course's own facts (design-system §6.4):
  - a hero and the real counts;
  - four finish lines: get hired, freelance, build your own product, lead the decisions;
  - the three promises and the four chapter modes;
  - the route, with expandable parts and "coming soon" marked;
  - the capstone in layers, the app features, centres, an FAQ and a final call to action.
    It makes no income or job guarantees, and has no testimonials until real ones exist.
- SEO:
  - metadata, canonical link and Open Graph/Twitter cards;
  - a generated 1200×630 share image (`/opengraph-image`);
  - JSON-LD `Course` and `FAQPage`;
  - `sitemap.xml` (public pages only) and `robots.txt`.

#### Changed

- The learner dashboard moved from `/` to `/home`. Signed-in visitors to `/` go straight there,
  and the installed app starts there. The app's tab bar is hidden on the landing page.
- The share image and the title read the brand name from tenant config.

#### Tests

- E2E:
  - the title, description, canonical link, social cards and structured data;
  - a single h1, the real counts, and no guarantee language;
  - the calls to action and the expanding route;
  - axe in light and dark with reduced motion, and no sideways scroll on phones;
  - signed-in visitors redirected to `/home`;
  - the sitemap contains only public pages, robots excludes private ones, and the share image
    is a PNG.

### M5b — Commercial model: direct learners, centre licences and seat packs

#### Added

- ADR-0030 and `content/plans.json`: three offers, priced in one editable file (placeholder
  prices until tested with centres):
  - **Direct:** monthly, annual and lifetime plans for individual learners.
  - **Centre licence:** a monthly fee that includes a number of active learners, then a fee
    per extra active learner.
  - **Seat packs:** a centre buys places and gives its students one join code. This replaces
    the 30% revenue share.
- One access rule everywhere: public → signed in → launch mode → centre licence → purchase,
  seat or grant → free tier → plans. Launch mode stays on, so every signed-in learner still
  has the full course.
- `/plans`: the offers, prices and how centres get in touch. A footer link points to it.
- `/join`: learners redeem a centre's join code. Codes are about 59 bits, stored only as a
  hash, rate-limited, and can be revoked or regenerated; a pack can never be over-redeemed.
- Account page: "Your access" says how the learner has access and until when.
- `/admin/commerce`, for platform owners only (everyone else gets a 404):
  - create seat packs (the code is shown once);
  - grant and revoke access by email;
  - set a centre's licence and see a month's active learners and the invoice amount.
- Server enforcement: progress and checkpoint writes refuse paid pages without access.
- For when launch mode is turned off, paid pages need a 15-minute signed access pass bound to
  the session. `/access` checks the database and issues it, or sends the learner to `/plans`.
- Migration 0006 adds `entitlement`, `seat_pack` and `tenant_licence`. It is additive only.

#### Fixed (found by the new tests before release)

- The seat-pack list counted 0 used seats, because of an ambiguous column in a subquery.
- The admin access list failed, because a date was passed to the database driver unconverted.

#### Tests

- Unit: prices, invoices, seat tiers, join codes, the access rule, free-tier patterns, paid-page
  detection and the access pass (forgery, expiry, session binding).
- Integration:
  - every route to access, with launch mode off;
  - six learners racing for one last seat, with exactly one winner;
  - expiry, revocation, regeneration and tenant separation;
  - export and account deletion;
  - licence usage and invoices;
  - the APIs with launch mode off, the `/access` pass and open-redirect refusal;
  - every admin route refuses learners (403) and signed-out requests (401);
  - the owner's full flow.
- E2E:
  - the plans page;
  - join errors;
  - Your access;
  - the owner creates a pack and a learner joins with the code in another browser, with axe;
  - learners get a 404 for admin.

### M5a — Verifiable certificates

#### Added

- Part certificates (ADR-0029). To earn one, finish every published chapter in the part (every
  section read, every lab step done and committed, the drill answered, every question rated)
  and pass the part checkpoint. The server re-checks all of this from the database before
  issuing. Claiming is idempotent and needs a name on the account.
- The course certificate becomes available once every chapter is published and every part
  certificate is earned. The page says so until then.
- `/certificates`: each part's progress towards its certificate, "Claim certificate", view,
  copy link and delete.
- `/certificates/<id>`: a public verification page with a 128-bit random id. It shows only the
  name, scope, course, date and issuer, is `noindex` and prints cleanly to PDF. Deleted or
  unknown ids are 404.
- Certificates are included in the data export and deleted with the account. The dashboard
  links to them.
- Migration 0005 adds the `certificate` table. It is additive only.

#### Tests

- Unit: eligibility rules and strict scope parsing.
- Integration:
  - not eligible until complete, idempotent claims, a name is required, and the name is
    snapshotted at issue;
  - the public lookup reveals nothing else;
  - another learner can't list or delete a certificate, and isn't eligible;
  - it is tenant-scoped and removed with the account;
  - the isolation route list and the repository classification are updated.
- E2E: earn Part 1 through the real API, claim, view, verify signed out (`noindex`, no email
  shown), delete and get a 404, with axe.

### Fixed

- "Mark as read" on the last section of a chapter without a lab saved the section but showed
  nothing, so it looked broken (the preview also jumped back to the top). It now shows a
  "Chapter complete" card: how many sections are read, a link to the next chapter, a way back to
  any unread section, and a link back to the course. Regression test: `tests/e2e/chapter-end.spec.ts`.

### Learner dashboard

#### Added

- Navigation from anywhere: a bottom tab bar on phones (Home, Course, Review, Progress, Notes)
  and the same links in the header on wider screens, with the current section highlighted. The
  course page has a "Home ›" breadcrumb.

- New look across the app: a soft blue-lavender background with gentle glows, light cards with
  rounder corners and soft shadows, an indigo accent, and a translucent header. Dark mode has
  its own navy and indigo equivalents. Every colour pair was checked for WCAG AA contrast
  (design-system §6).
- Dashboard revision:
  - a "My activity" chart of XP per day this week;
  - "Up next" (where you left off, then review or the next chapter);
  - streak, XP and days this week in the header;
  - a side column with the next part checkpoint, a course progress ring and the chapters in
    progress.

- `/` is now the learner's home (ADR-0028). It has:
  - side navigation: Courses, Learning path, My progress, Review due, Notes and bookmarks,
    Glossary, and Certificates (marked "soon"); on phones it becomes a scrolling row;
  - a card per course with its level, summary, size, live progress and Start course or Continue;
  - when signed in, this week's streak, XP, learning days and questions due.
- Courses are listed from `content/courses.json`; new optional `level`, `summary` and `icon`
  fields describe each card.
- After deleting an account, home confirms that the data was deleted.

#### Changed

- The header brand link and the installed app's start page go to the dashboard.
- Course progress uses one shared calculation (`courseProgress`) on the dashboard and the
  learning path.

#### Tests

- Unit: dashboard data from the real manifest; course progress.
- E2E: signed-out start, signed-in Continue with progress, no sideways scroll on phones, and axe
  in light and dark, signed out and signed in.
- E2E: Home and Course are reachable from a chapter on phones and computers, and the bottom bar
  never covers the end of the page.

### M4 — Find and annotate

#### Added

- Full-text search across every section (Pagefind index built with the content; ADR-0008): a
  `/search` page with highlighted excerpts that deep-link into the right mode and section, plus a
  search button in the header.
- Glossary page (`/learn/<course>/glossary`): all 366 terms A–Z, with a filter and a letter jump
  list. Each entry lists every chapter that defines it.
- Definitions in the text: the importer marks the first use of each chapter's own jargon terms in
  every prose section. Hover (desktop), tap or press Enter to see the definition, and Escape to
  close; focus returns to the term.
- Notes and bookmarks on every Learn section and lab (ADR-0027). They sync through the offline
  outbox, appear on a new `/notes` page, are included in the data export and are deleted with the
  account. A deleted note's text is erased immediately.
- Route page links to search, the glossary, and notes and bookmarks.

#### Changed

- CSP `script-src` adds `'wasm-unsafe-eval'`, which allows WebAssembly compilation only, for
  the search index (ADR-0018 update).
- Migration 0004 adds the `bookmark` and `note` tables. It is additive only.

#### Tests

- Unit: term matcher and marker (first use only, whole words, never in headings, links or code),
  plus a real-handbook check that every marked term links to that chapter's own definition, and
  the reducer for bookmarks and notes.
- Integration: note and bookmark last-write-wins, final deletes, validation, and isolation
  between learners (a reused note id, a `userId` in the payload, state and export) and between
  tenants; data removed with the account.
- E2E: search deep link, reload and highlights; term popover by tap, keyboard and hover; glossary
  filter; the notes flow, including that typed markup stays literal; axe in light and dark on
  search, glossary, notes and the open popover.

### M3 — Practice depth

#### Added

- Part checkpoints (ADR-0021): 10 questions from the part plus one decision drill; pass at 80%
  confident with the drill answered; 200 XP once; unlimited attempts with a fresh set each time.
  The server re-derives the question set for the attempt, validates and scores it (tenant-scoped
  `checkpoint_attempt` table, migration 0003). Unsure answers join spaced-repetition review.
- "Review due" page: every question due now across the course, one at a time; the route shows
  how many are waiting.
- Checkpoint cards on the route (not started / best score / passed).
- Sticky Sections menu in every chapter: all sections grouped by mode, read ticks, jumps to the
  right mode and card, closes with Escape.
- Previous chapter link alongside Up next.
- Data export includes checkpoint attempts.

#### Fixed

- The checkpoint result screen lost its "to revisit" list because saving the attempt changed the
  attempt number; the question set is now frozen when the learner presses Start.

#### Tests

- Checkpoint rules (unit), checkpoint API (pass/fail, XP once, mismatched sets rejected, review
  queue, isolation), tenant-scoped attempts, and Playwright journeys with axe checks.

### Future-proofing for white-label, LMS integration and billing (owner request)

#### Added

- Tenancy-ready data model (ADR-0023): `tenant`, `membership` (roles `tenant_admin`, `tutor`,
  `learner`) and `tenant_course` tables; default tenant `tnt_default`; `tenant_id` first in the
  key of every tenant-owned table; `user.platform_role` (`platform_owner`) replaces `user.role`.
  Migrations 0001–0002 keep every existing row (proven by a migration test).
- One permission matrix (`src/server/authz.ts`), one tenant resolver that never reads user
  input, `requireContext()` for routes, and tenant-scoped repositories in `src/server/repo/`.
  A lint rule forbids database access anywhere else.
- Branding and access settings from tenant configuration (ADR-0024):
  `content/tenants/default.json`, overridable per tenant; no brand literals in `src/` (tested).
- Tenants can switch off courses or modules; the API refuses progress for them.
- Tenant isolation tests: same learner in two tenants, cross-tenant learners, tenant-scoped
  export, tenant claims in requests ignored, every repository function classified.
- Docs: `docs/roadmap.md` (phases 1–4), ADR-0023 tenancy, ADR-0024 branding, ADR-0025 LTI
  deferred to Phase 3, ADR-0026 merchant of record (supersedes ADR-0010's Stripe flag);
  architecture §13, test strategy §4b, rollback steps in the runbook.

#### Changed

- Public pages are a tenant setting rather than a course setting.
- Data export now covers the current tenant (and says which).

### M2 — Sign-in, progress and the redesigned reader

#### Added

- Sign-in with an emailed magic link (Resend in production, Mailpit locally) and an optional
  Google button (shown once `GOOGLE_CLIENT_ID`/`SECRET` are set). Sessions last 30 days.
- Rate limits: per-IP on every auth endpoint, 5 sign-in links per email per hour, 120 progress
  batches per learner per minute.
- Account page: name on certificates, download my data (JSON), sign out, delete my account
  (type your email to confirm; every personal row is removed).
- Postgres schema and migrations (Drizzle): progress, lab steps and commits, drill answers,
  flashcard reviews (Leitner boxes), last position, XP events, activity days, settings.
- Progress API: one idempotent batch endpoint. Every key is validated against the course, XP is
  awarded once per item on the server, offline replays resolve last-write-wins.
- Redesigned reader (design-system §5): route map home with part outcomes and milestones; chapters
  in Learn / Practise / Decide / Review modes; lab checklist; answer-before-reveal drills;
  flashcards; deep links (#section) open the right mode; "Continue where you left off".
- XP, streak with freezes, weekly goal and progress percentages; "Your progress" page.
- Installable PWA: manifest, icons, service worker (visited chapters work offline; personal data
  never cached), install prompt from the second visit (iPhone gets Add to Home Screen steps).
- Offline outbox: actions show instantly, queue on the device per learner, sync when online.
- Public pages (Start here, Chapter 1) readable without an account; other chapters redirect to
  sign-in and come back afterwards.

#### Tests

- 75 unit tests (content, XP/streak/goal maths, spaced repetition, access rules) and 20
  integration tests against Postgres, including cross-learner isolation for every personal route
  and a check that fails if a new route lacks an isolation case.
- 35 Playwright tests on desktop and mobile: signed-out reading and gating, the full learner
  journey with XP, account export and deletion, offline progress syncing, and axe WCAG 2.2 AA on
  every screen in light and dark.

### Design revision (after preview feedback)

#### Changed

- Learner experience redesigned from a long-scroll reader to an app-like flow: home is a route
  map of the 15 parts; each chapter has Learn / Practise / Decide / Review modes
  (design-system §5).

#### Added (decisions; implementation scheduled in M2–M5)

- ADR-0019 XP, streaks, weekly goal and progress percentages (M2).
- ADR-0020 opt-in reminder emails (M5).
- ADR-0021 self-assessed part checkpoints, with a scored question bank as a later option (M3).
- ADR-0022 installable PWA with offline chapters (M2) and web push reminders (M5).

#### Revised milestones

- M2: sign-in, account, progress saved per learner, the redesigned reader with all four modes
  persisted (lab ticks, drill answers, flashcard ratings), XP, streaks, weekly goal, installable PWA.
- M3: part checkpoints, spaced-repetition review queue, lab/drill polish.
- M4: search, glossary hover, notes and bookmarks. M5: certificates, admin, analytics, reminders
  (email + push). M6: hardening, load test, accessibility audit, launch.

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
