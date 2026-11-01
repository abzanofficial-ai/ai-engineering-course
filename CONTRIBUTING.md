# Contributing

## Branches

```
work branch  ──PR──▶  develop  ──release PR──▶  main  ──▶  deploy
```

- **Work branches** hold one change each (a feature, a fix, a docs update). Start them from
  the latest `develop`.
- **`develop`** is the integration branch. Every change reaches it through a pull request with
  green CI. Nobody pushes to it directly.
- **`main`** is what is live. It only receives a release pull request from `develop`, after
  the changes have been checked together. Deploys run from `main` only (`.github/workflows/ci.yml`).
- **Hotfix:** branch from `main`, open a pull request into `main`, then merge `main` back into
  `develop` so the fix isn't lost.

CI (lint, typecheck, unit and integration tests, build, end-to-end and accessibility tests)
runs on every pull request and on every push to `develop` and `main`.

## Recommended GitHub settings (repository owner)

- Settings → General: make `develop` the default branch, so new pull requests target it.
- Settings → Branches: protect `develop` and `main`, require pull requests, and require the CI
  checks to pass before merging.

## Every change

- Keep it small, reviewed and reversible. Record decisions in `docs/adr/`, and note changes in
  `CHANGELOG.md`.
- Never skip, disable or quarantine a test to get green. Never commit secrets. Never put real
  learner data in seeds or fixtures (synthetic `@example.test` accounts only).
- Run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e`
  before opening a pull request.
