// Fixed-window rate limiting in Postgres (ADR-0012). One upsert per check.
import { sql } from "drizzle-orm";
import type { Db } from "./db/client";
import { rateLimitBucket } from "./db/schema";

export async function allow(
  db: Db,
  key: string,
  max: number,
  windowSeconds: number,
  now = Date.now(),
): Promise<boolean> {
  const windowStart = Math.floor(now / 1000 / windowSeconds) * windowSeconds;
  const [row] = await db
    .insert(rateLimitBucket)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimitBucket.key, rateLimitBucket.windowStart],
      set: { count: sql`${rateLimitBucket.count} + 1` },
    })
    .returning({ count: rateLimitBucket.count });
  return (row?.count ?? 1) <= max;
}
