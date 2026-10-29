# Runbook

Owner: Senior DevOps Engineer. This document grows with each milestone; M6 completes it
(deploys, rollback, backups, incident response).

## Current state (M1)

- Production hosting: not yet connected (Cloudflare, ADR-0003). The CI `deploy` job is skipped
  until the `CLOUDFLARE_API_TOKEN` GitHub secret is set.
- Content publishing: merge a change to `content/handbook.md` into `main`.
- Content rollback: `git revert` the content commit and merge.
