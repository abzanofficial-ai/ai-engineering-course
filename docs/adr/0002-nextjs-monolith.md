# ADR-0002: One Next.js (App Router) + TypeScript application

- Status: accepted · Date: 2026-10-29 · Decider: Chief Architect

## Context
We need static content pages, a small personal-data API, auth and an admin area. "Simple: minimal moving parts."

## Decision
A single Next.js 16 App Router app in strict TypeScript. Content pages are statically generated (`generateStaticParams`, `dynamicParams = false`); personal data goes through route handlers / server actions in the same app. No separate backend service.

## Consequences
- One deploy, one codebase, one set of tests.
- The content importer is plain TypeScript in the same repo, runnable as a CLI (`pnpm content:build`) and as a library (admin diff preview).

## Alternatives considered
Separate API service (more ops, no benefit at this scale); Astro (great for static, weaker for the authenticated app half).
