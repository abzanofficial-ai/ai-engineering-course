import { sql } from "drizzle-orm";
import { afterAll, beforeEach } from "vitest";
import { closeDb, db } from "@/server/db/client";
import { clearTenantCaches } from "@/server/repo/tenant";

// Every test starts from an empty database (migrations are applied once by `pnpm db:migrate`).
beforeEach(async () => {
  await db().execute(
    sql`truncate table "user", rate_limit, rate_limit_bucket, verification, entitlement, seat_pack, tenant_licence restart identity cascade`,
  );
  // Tenants other than the default exist only inside a test.
  await db().execute(sql`delete from tenant_course where tenant_id <> 'tnt_default'`);
  await db().execute(sql`delete from tenant where id <> 'tnt_default'`);
  await db().execute(sql`update tenant_course set enabled = true, disabled_modules = '[]'::jsonb`);
  clearTenantCaches();
});

afterAll(async () => {
  await closeDb();
});
