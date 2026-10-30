import { sql } from "drizzle-orm";
import { afterAll, beforeEach } from "vitest";
import { closeDb, db } from "@/server/db/client";

// Every test starts from an empty database (migrations are applied once by `pnpm db:migrate`).
beforeEach(async () => {
  await db().execute(
    sql`truncate table "user", rate_limit, rate_limit_bucket, verification restart identity cascade`,
  );
});

afterAll(async () => {
  await closeDb();
});
