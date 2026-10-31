# Design system

Owner: Senior UI/UX Designer. Principles: **the book is the product** (typography first, chrome second), **motivating, not manipulative** (XP, streaks and goals reward real work; no leaderboards or loss-aversion tricks, ADR-0019), **mobile first**, **WCAG 2.2 AA by construction**.

## 1. Foundations

### Typography

| Token         | Value                                                                              | Use                                                        |
| ------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `--font-body` | System UI stack (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, …`) | All text — no web-font download, no font-swap layout shift |
| `--font-mono` | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`                         | Code                                                       |
| Body size     | 1.0625rem (17px) mobile, 1.125rem (18px) ≥ 768px; line-height 1.7                  | Reader                                                     |
| Measure       | `max-width: 68ch` for prose                                                        | Reader                                                     |
| Scale         | 1.25 ratio: h1 2.1rem, h2 1.6rem, h3 1.3rem, h4 1.1rem                             | Headings                                                   |

### Colour tokens (light / dark). All text pairs ≥ 4.5:1, UI boundaries ≥ 3:1

| Token              | Light     | Dark      | Use                                          |
| ------------------ | --------- | --------- | -------------------------------------------- |
| `--bg`             | `#ffffff` | `#0f1115` | Page                                         |
| `--surface`        | `#f6f7f9` | `#171a21` | Cards, code                                  |
| `--text`           | `#1a1d23` | `#e6e8ec` | Body (16.9:1 / 14.9:1)                       |
| `--muted`          | `#555b66` | `#a3a9b5` | Secondary text (7.0:1 / 7.6:1)               |
| `--border`         | `#8a909b` | `#5c6370` | Inputs, dividers that matter (3.3:1 / 3.1:1) |
| `--hairline`       | `#e3e6ea` | `#2a2f38` | Decorative dividers only                     |
| `--accent`         | `#1d4ed8` | `#8ab4ff` | Links, primary buttons (6.7:1 / 8.4:1)       |
| `--accent-fg`      | `#ffffff` | `#0f1115` | Text on accent                               |
| `--success`        | `#166534` | `#6ee7a0` | Completed                                    |
| `--warning`        | `#8a4b00` | `#ffc46b` | Unsure / due                                 |
| `--focus`          | `#c2410c` | `#ffb38a` | Focus ring (3px solid + 2px offset)          |
| `--placeholder-bg` | `#fff4c2` | `#4a3f12` | `[placeholder]` highlight in prompts         |

Theme = system preference by default, overridable (Light / Dark / System) in the header; stored in a cookie-free `localStorage` key and applied by an inline script before paint (no flash). Code uses Shiki dual themes (`github-light` / `github-dark`) via CSS variables; diagrams swap SVG per theme.

### Space, shape, motion

- Spacing scale 4px base: 4, 8, 12, 16, 24, 32, 48, 64.
- Radius 8px cards, 6px controls. Touch targets ≥ 44×44px (WCAG 2.5.8 needs 24; we go further on mobile).
- Motion: 150 ms ease-out for disclosure/flip; all disabled under `prefers-reduced-motion: reduce`.

### Components (shadcn/ui-style on Radix primitives where interactive)

Button (primary/secondary/ghost), Checkbox (lab step), Disclosure (When it breaks, drill reveal, diagram text), Tooltip/Popover (glossary term — popover on tap, tooltip on hover+focus, dismissible with Esc), Dialog (delete account, search), Tabs (quiz modes), Progress bar (with text label "4 of 12"), Toast (save status, polite live region), Badge ("Coming soon", "Lab", "Unsure").

### Accessibility rules every component follows

- Visible focus ring on everything focusable; never `outline: none` without replacement. Focus not obscured by sticky header (`scroll-padding-top`).
- One `h1` per page; heading levels follow the book (`##`→h1 on chapter page, `###`→h2, `####`→h3).
- Skip link to main content; landmarks (`header`, `nav`, `main`, `aside`, `footer`).
- State is never colour alone: completed has a ✓ icon + text; unsure has a label.
- Diagrams: alt text + "Diagram as text" disclosure. Code blocks: language label announced, copy button labelled "Copy bash code"; result announced ("Copied").
- Save status uses `aria-live="polite"`.
- Dragging is never required (WCAG 2.5.7). No timeouts on drill/quiz.

## 2. Layout

- **Mobile (< 768px):** single column. Header: menu, course title, search icon, theme, account. TOC in a "On this page" sheet opened from a sticky bottom bar that also holds prev/next.
- **Tablet (768–1199px):** content column + collapsible TOC.
- **Desktop (≥ 1200px):** three columns — chapter nav (left, collapsible), content (68ch), sticky TOC + progress (right).

## 3. Wireframes (text)

### 3.1 Course home

```
┌───────────────────────────────────────────────────────────────┐
│ ☰  The AI Engineering Handbook            🔍   ◐   (Account) │
├───────────────────────────────────────────────────────────────┤
│ Welcome back, Sam                                             │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ CONTINUE WHERE YOU LEFT OFF                               │ │
│ │ Ch 21 · Tool Calling & Function Calling                   │ │
│ │ Practice lab — step 4 of 9          [ Continue → ]        │ │
│ └───────────────────────────────────────────────────────────┘ │
│ Course progress  ███████░░░░░░░░  11 of 29 chapters           │
│ Review due: 6 cards  [Start review]                           │
│                                                               │
│ START HERE                                                    │
│  • How to use this book  ✓     • The capstone                 │
│                                                               │
│ PART 1 — Programming Foundation        4/4 ✓  [Certificate]   │
│  ✓ 1 Python for AI Engineering    25 min read · 45 min lab    │
│  ✓ 2 Git & GitHub                 …                           │
│ PART 2 — Mathematics & Data Basics     1/2                    │
│  ✓ 5 Statistics & Linear Algebra                              │
│  ◐ 6 NumPy & Pandas               (half-filled = in progress) │
│ …                                                             │
│ PART 11 — Evaluation & Safety          [Coming soon]          │
│  31 Eval-driven development       Coming soon (not a link)    │
└───────────────────────────────────────────────────────────────┘
```

Signed-out: same layout, no personal rows, a "Create a free account" card; Start here and Chapter 1 readable.

### 3.2 Chapter reader

````
Desktop
┌──────────┬──────────────────────────────────┬──────────────┐
│ Part 9   │ Part 9 · Chapter 21              │ ON THIS PAGE │
│  21 ●    │ Tool Calling & Function Calling  │ Jargon       │
│  22      │ 22 min read · lab ~60 min        │ What it is   │
│  23      │ ┌──────────────────────────────┐ │ How it works │
│ …        │ │ Definition: you describe …   │ │ ▸ Practice   │
│          │ └──────────────────────────────┘ │   lab  3/9   │
│          │ ## Jargon decoder (table, terms   │ Decision     │
│          │    searchable in glossary)        │   drill ✓    │
│          │ ## What it is …  a ‧tool‧ (dotted │ …            │
│          │    underline = glossary popover)  │──────────────│
│          │ ```python  [python] [Copy]       │ Chapter 40%  │
│          │ [diagram img]  ▸ Diagram as text  │ 🔖 Bookmark  │
│          │ Each section footer:              │ 📝 Notes (2) │
│          │   [🔖] [📝 Add note]              │              │
│          │ ← Ch 20 Tracing   Ch 22 Agents → │              │
└──────────┴──────────────────────────────────┴──────────────┘
Mobile: single column; bottom bar [☰ On this page] [← ] [ →]
````

### 3.3 Lab checklist

````
## Practice lab: the Harbour & Finch viewing assistant
What you'll build: …            Time: about 60 minutes
Progress ███░░░░  3 of 9 steps                       Saved ✓
┌────────────────────────────────────────────────────────────┐
│ [✓] Step 1 — Set up                                        │
│     (step content; code blocks with Copy)                  │
│ [✓] Step 2 — …                                             │
│ [ ] Step 3 — …                                             │
│ …                                                          │
│ ▸ When it breaks (5 known problems)   ← disclosure          │
│ Commit it                                                  │
│   ```bash $ git add . …```  [Copy commands]                │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ [ I committed it ]  ← primary; becomes "Committed ✓    │ │
│ │                      on 3 Nov · Undo"                  │ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
````

Checkbox label is the step title; the whole heading row is the hit target. Ticking does not collapse content.

### 3.4 Decision drill

```
## Decision drill: "just give it access to our whole CRM"
The scenario. …
What to ask: 1… 2… 3…
┌────────────────────────────────────────────────────────────┐
│ Your answer (private — only you can see it)                │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ What would you ask, and what would you recommend?      │ │
│ │                                                        │ │
│ └────────────────────────────────────────────────────────┘ │
│ Saved as you type ✓                                        │
│ [ Compare with an experienced engineer ]  (enabled once    │
│    ≥ 20 characters)        or  "Skip and reveal" (link)    │
└────────────────────────────────────────────────────────────┘
After reveal (two columns ≥ 1024px, stacked on mobile):
┌──────────────── Your answer ─────┬── How an experienced engineer reasons ──┐
│ (read-only, [Edit])              │ … What to tell the client … Where this  │
│                                  │ crosses departments …                   │
└──────────────────────────────────┴─────────────────────────────────────────┘
```

Focus moves to the revealed heading; announced via live region.

### 3.5 Quiz / flashcard mode

```
Interview practice — Chapter 21           Card 3 of 8   [Review due: 6]
┌────────────────────────────────────────────────────────────┐
│  "Read tools and write tools — what's the difference, and  │
│   why does it matter for approval gates?"                  │
│                                                            │
│  Your answer (optional, private)                           │
│  [                                                       ] │
│                                                            │
│  [ Show where the chapter covers this ]                    │
│      → links: Read tools and write tools… · What goes wrong│
│                                                            │
│  How did you do?   [ Unsure ]   [ Confident ]              │
└────────────────────────────────────────────────────────────┘
Keyboard: 1 = Unsure, 2 = Confident (shown as hints).
Modes (tabs): This chapter · Review due (all unsure/due) · All chapters
```

### 3.6 Dashboard (`/dashboard`)

```
Your learning
┌────────────┬────────────┬────────────┬────────────┐
│ Chapters   │ Labs       │ Drills     │ Cards due  │
│ 11 / 29    │ 9 / 30     │ 10 / 29    │ 6          │
└────────────┴────────────┴────────────┴────────────┘
Continue: Ch 21 · lab step 4                [Continue →]
Certificates: Part 1 ✓ [View · Copy link]   Part 2 (1 chapter left)
Bookmarks (list, newest first, link to section)
Notes (grouped by chapter, search box)
Account: name on certificates [Sam Patel] · Download my data · Delete account
```

### 3.7 Admin import

```
Admin › Content
Current published: release 2026-10-29 · hash 3fa9c2 · 29 chapters
[ Choose handbook.md ]  [ Preview changes ]
┌ Diff preview ──────────────────────────────────────────────┐
│ + Added chapters (1):   30 AI Product, UX & Feedback Loops │
│ ~ Changed chapters (3): 18 (2 sections), 21 (lab: +1 step) │
│ − Removed keys (1):  ch-21 / step-9 — 214 learners have    │
│                      progress here (kept, will be orphaned)│
│ ! Renamed headings (1): ch-19 "Measuring retrieval…" →     │
│                      "Measuring retrieval separately" — 88 │
│                      learners' 'read' mark for that section│
│ Coming soon → published: 30                                │
│ Warnings: 0 parse errors · 2 diagrams without %% alt       │
└────────────────────────────────────────────────────────────┘
[ Publish ]  (disabled + CLI instructions if GitHub publish flag/token absent)
```

## 4. Content formatting rules

- Tables scroll horizontally inside their own container on mobile (page never scrolls sideways), with the first column sticky for jargon tables.
- Code blocks: language label, copy button, horizontal scroll, `tabindex="0"` for keyboard scrolling. For `bash` blocks with `$ ` prompts, copy takes only the command lines without `$ `.
- "Stuck? Ask Claude" prompts: each in a card with "Copy prompt"; `[placeholders]` highlighted with `--placeholder-bg` and a legend "Replace the highlighted parts".
- Coming-soon chapters: muted text, "Coming soon" badge, not links, `aria-disabled` is not used (they are plain text).

## 5. Revision 2 — app-like learning experience (owner feedback: "it looks like another PDF")

The reader no longer presents a chapter as one long page. Approved in the phone preview.

### 5.1 Home = the route

- Hero: course title, one-line promise, live counts (chapters, lab steps, drills, interview questions), course % complete, streak and weekly-goal ring, and one primary "Continue where you left off" button.
- **Your route:** the 15 parts as stops on a vertical line, each part with its own hue along the route (teal → blue → violet → magenta → orange). Each stop shows the book's own "You can now…" outcome from the Index, a progress ring with the % as text, and milestone flags where the Index marks one in bold (Part 8 "First sellable product", Part 13 "Pass the system design round").
- Chapter cards under each stop: number, title, reading/lab time, progress ring. Coming-soon chapters are muted text with a badge.
- **Part checkpoint** card at the end of each part with published chapters (ADR-0021).

### 5.2 Chapter = four modes

Tinted header in the part's hue: eyebrow (Part · title), chapter title, definition as the lede, chips (read time, lab steps and time, key terms, questions), chapter % bar.

Sticky mode tabs, each with an icon, a colour and a progress label:

| Mode     | Colour token         | Contains                                                                                                                           |
| -------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Learn    | `--learn` (blue)     | One section per card, "Got it · next", numbered section dots; Jargon decoder as tap-to-reveal term cards                           |
| Practise | `--practise` (green) | Lab checklist (tick opens the next step), progress ring, collapsible "When it breaks", "I committed it", Stuck? Ask Claude prompts |
| Decide   | `--decide` (amber)   | Scenario → private answer (≥ 20 chars) → side-by-side comparison with the expert reasoning                                         |
| Review   | `--review` (violet)  | Flashcards, Unsure / Confident, "practise only unsure"                                                                             |

### 5.3 Engagement (ADR-0019, 0020)

- Top bar: streak (flame icon + days) and XP (star icon + total) as one tappable chip opening **Your progress**.
- "+10 XP" toast (polite live region, no animation under reduced motion).
- **Your progress** page: course %, per-part %, XP total and this week, streak with freezes, weekly-goal ring and stepper (1–7 days), recent activity, and **Reminders** switches (all off by default, with the consent wording "Email me…" and "Unsubscribe any time").

### 5.4 Part checkpoint (ADR-0021)

Intro (rules: 10 questions + 1 drill, pass at 80 % confident) → one question per card with elapsed time, Unsure / Confident → drill → result: pass (200 XP, certificate status) or "not yet" with links to the chapters behind each unsure question, and Try again.

### 5.5 Typography update

Display face: Bricolage Grotesque (self-hosted via `next/font`, weights 600/800, used for headings and numbers only); body remains the system stack for speed.

## 6. Revision 3 — soft palette and the learner dashboard (owner reference, 2026-10-30)

Owner: Senior UI/UX Designer. The owner asked for a calmer, lighter look across the app and a
dashboard with activity and progress at a glance.

### 6.1 Palette (tokens in `src/app/globals.css`; every pair checked by calculation)

| Token                    | Light                           | Dark                     | Check                                    |
| ------------------------ | ------------------------------- | ------------------------ | ---------------------------------------- |
| `--bg` (page)            | `#e9eef7` + lavender/blue glows | `#0e1124` + indigo glows | —                                        |
| `--raised` (cards)       | `#fbfcff`                       | `#1c2039`                | —                                        |
| `--ink`                  | `#1c1f3a`                       | `#eceefa`                | 15.7 / 13.8 : 1                          |
| `--muted`                | `#565d78`                       | `#a7adc8`                | ≥ 5.6 / 7.2 : 1 on page and cards        |
| `--accent`               | `#4f46e5` (indigo)              | `#a8abff`                | 6.1 / 7.6 : 1; button text 6.3 / 8.8 : 1 |
| `--edge` (field borders) | `#868ea8`                       | `#6b7396`                | ≥ 3.2 : 1                                |
| `--bar-past` (chart)     | `#827dec`                       | `#6a67d8`                | ≥ 3.3 : 1 against cards                  |

Cards use a shared `--radius` of 20px and a soft two-layer shadow. The header is translucent
with a blur. Part hues on the route and chapter headers are unchanged: they identify parts.

### 6.2 Dashboard (`/`, ADR-0028)

Three columns on wide screens (navigation · main · side column); one column on phones with the
navigation as a scrolling row.

- **Header:** "Home", a welcome, and streak · XP · days this week.
- **My activity:** XP per day this week as a single-series bar chart. Today is solid accent;
  other days are a lighter step of the same hue; days with no XP show a baseline stub. Only
  today and the best day carry a value label; every bar shows its value on hover; a hidden table
  gives screen readers the same numbers.
- **Up next:** where you left off, then questions due for review (or the next chapter).
- **Courses:** a card per course with level, summary, size, progress and Start/Continue.
- **Side column:** a call to action for the next part checkpoint, a progress ring for the course,
  and the chapters in progress (then the next ones to start).

### 6.3 Navigation from anywhere

- **Phones (< 900px):** a fixed bottom tab bar on every page: Home · Course · Review · Progress ·
  Notes. The current section is highlighted and marked `aria-current="page"`. The page gets
  bottom padding so the bar never covers content, and toasts sit above it.
- **Tablets and computers:** the same five links in the header.
- **Course page:** a breadcrumb, "Home › course title".
- The dashboard's side list shows only on wide screens (≥ 1100px), where it adds Glossary and
  Certificates.

### 6.4 Landing page (`/`)

Public, static and crawlable. It is built only from facts in the course: counts come from the
manifest, part outcomes from the Index, and the promises from "How to use this book". It makes
no earnings or job guarantees and shows no testimonials until real ones exist (advertising rules
on earnings claims and fake reviews).

- **Hero:** the promise, two calls to action (Chapter 1, which needs no account, and the route),
  and the fifteen parts drawn as a ring with the milestone parts larger. Followed by the real
  counts.
- **Sections:** four finish lines (hired, freelance, own product, lead the decisions), the
  three promises, the four chapter modes, the route (expandable parts with "coming soon"
  marked honestly), the capstone in layers, the app features, centres, FAQ and a final call to
  action.
- **SEO:**
  - title, description and canonical link;
  - Open Graph and Twitter cards with a generated 1200×630 image;
  - JSON-LD `Course` (syllabus = the 15 parts) and `FAQPage`;
  - `sitemap.xml` with public pages only, and `robots.txt` excluding personal and admin pages.
- **Absolute URLs** come from `APP_URL` at build time, so set it to the real domain before
  `pnpm build`.
- **Signed-in learners** visiting `/` go straight to `/home`.
