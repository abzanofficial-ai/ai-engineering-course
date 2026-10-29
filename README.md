# The AI Engineering Handbook — LMS

A learning platform for _The AI Engineering Handbook_. The course content lives in
[`content/handbook.md`](content/handbook.md) (the single source of truth); the app presents it,
tracks progress and adds interactivity around it.

- Architecture: [`docs/architecture.md`](docs/architecture.md) · decisions: [`docs/adr/`](docs/adr/)
- Test strategy: [`docs/test-strategy.md`](docs/test-strategy.md) · design system: [`docs/design-system.md`](docs/design-system.md)
- Changes: [`CHANGELOG.md`](CHANGELOG.md)

## Run it locally (about 10 minutes)

**You need:** Node.js 22+, pnpm 10 (`corepack enable`), and Docker (from milestone M2, for Postgres and email).

```bash
git clone https://github.com/abzanofficial-ai/ai-engineering-course.git
cd ai-engineering-course
corepack enable            # provides pnpm
pnpm install
cp .env.example .env.local # placeholders are fine for local use
pnpm content:build         # parse the handbook, render diagrams (first run ~20 s)
pnpm dev                   # http://localhost:3000
```

From M2 onwards also run `docker compose up -d` (Postgres on 5432, Mailpit on http://localhost:8025).

`pnpm content:build` renders Mermaid diagrams with headless Chromium. If it says rendering is
unavailable, run `pnpm exec playwright install chromium` once, or use
`pnpm content:build --no-diagrams` (diagrams then show as text).

## Everyday commands

| Command                                        | What it does                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm dev`                                     | Dev server with hot reload                                                  |
| `pnpm build` / `pnpm start`                    | Production build (includes `content:build`) / serve it                      |
| `pnpm content:build`                           | Re-import every course in `content/courses.json` into `.content/`           |
| `pnpm content:diff <file.md>`                  | Preview what publishing a new handbook export would change                  |
| `pnpm test`                                    | Unit and integration tests (Vitest)                                         |
| `pnpm test:e2e`                                | End-to-end + accessibility tests (Playwright + axe); run `pnpm build` first |
| `pnpm lint` / `pnpm typecheck` / `pnpm format` | Static checks                                                               |

## Updating the course content

1. Export the book to Markdown and replace `content/handbook.md`.
2. `pnpm content:diff path/to/new.md` shows added chapters, edited sections and any keys whose
   learner data would be orphaned. Re-imports never delete learner data.
3. Commit on a branch and open a PR. CI posts the same diff in the job summary; merging to
   `main` publishes.

Chapters listed in the book's Index but not yet written show as **Coming soon** automatically.

## Adding a second course

Add a Markdown file under `content/` and an entry to `content/courses.json`. No code changes
(ADR-0017).

## Project layout

```
content/            course sources + courses.json
docs/               architecture, ADRs, test strategy, design system
scripts/            CLI entry points (content build/diff)
src/content/        importer: Markdown → typed course model (pure, unit-tested)
src/app/            Next.js routes
src/components/     UI components
src/lib/            shared helpers (content loader, security headers)
tests/fixtures/     synthetic Markdown fixtures (never real learner data)
tests/e2e/          Playwright journeys and accessibility checks
```

## Environment variables

See [`.env.example`](.env.example). Every external service (Resend, Google OAuth, Sentry,
Cloudflare, Stripe) is a placeholder: the app runs locally without any of them.
