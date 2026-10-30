// Applies committed SQL migrations in drizzle/ (idempotent). Usage: pnpm db:migrate
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "postgres://lms:lms_local_only@localhost:5432/lms";
const sql = postgres(url, { max: 1, onnotice: () => {} });
await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
await sql.end();
console.log(`✓ migrations applied to ${new URL(url).pathname.slice(1)}`);
