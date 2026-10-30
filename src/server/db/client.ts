import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

let instance: { db: Db; sql: postgres.Sql } | null = null;

/** One pooled connection set per process (Hyperdrive pools in front of it on Workers). */
export function db(): Db {
  if (!instance) {
    const sql = postgres(env().DATABASE_URL, { max: 10, prepare: false, onnotice: () => {} });
    instance = { sql, db: drizzle(sql, { schema }) };
  }
  return instance.db;
}

export async function closeDb(): Promise<void> {
  if (instance) await instance.sql.end({ timeout: 5 });
  instance = null;
}
