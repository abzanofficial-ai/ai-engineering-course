# Runbook

Owner: Senior DevOps Engineer. This document grows with each milestone; M6 completes it
(deploys, rollback, backups, incident response).

## Current state (M1)

- Production hosting: not yet connected (Cloudflare, ADR-0003). The CI `deploy` job is skipped
  until the `CLOUDFLARE_API_TOKEN` GitHub secret is set.
- Content publishing: merge a change to `content/handbook.md` into `main`.
- Content rollback: `git revert` the content commit and merge.

## Rolling back migration 0001 (tenancy)

Only safe while a single tenant exists. Take a backup first, then run in one transaction:

```sql
BEGIN;
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'learner';
UPDATE "user" SET "role" = 'admin' WHERE "platform_role" = 'platform_owner';
-- for each personal table: drop the tenant PK and FK, restore the user PK, drop the column, e.g.
ALTER TABLE "xp_event" DROP CONSTRAINT "xp_event_tenant_id_user_id_course_event_id_pk";
ALTER TABLE "xp_event" DROP CONSTRAINT "xp_event_tenant_id_tenant_id_fk";
ALTER TABLE "xp_event" ADD CONSTRAINT "xp_event_user_id_course_event_id_pk" PRIMARY KEY ("user_id", "course", "event_id");
ALTER TABLE "xp_event" DROP COLUMN "tenant_id";
-- (repeat for section_progress, lab_step, lab_completion, drill_answer, card_review,
--  last_position, activity_day, user_settings — original key columns are in migration 0000)
DROP TABLE "membership"; DROP TABLE "tenant_course"; DROP TABLE "tenant";
ALTER TABLE "user" DROP COLUMN "platform_role";
DELETE FROM "__drizzle_migrations" WHERE id IN (SELECT id FROM "__drizzle_migrations" ORDER BY created_at DESC LIMIT 2);
COMMIT;
```

Then deploy the previous application version.

## Rolling back migration 0004 (notes and bookmarks)

Additive only. Deploy the previous application version first, then (after exporting the tables
if any learner data must be kept):

```sql
BEGIN;
DROP TABLE "note"; DROP TABLE "bookmark";
DELETE FROM "__drizzle_migrations" WHERE id = (SELECT id FROM "__drizzle_migrations" ORDER BY created_at DESC LIMIT 1);
COMMIT;
```
