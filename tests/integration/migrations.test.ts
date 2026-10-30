// Proves migration 0001 (ADR-0023) keeps every existing row and assigns it to the default
// tenant. Runs against a throwaway database created and dropped by this test.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const base = new URL(process.env.DATABASE_URL!);
const name = `lms_migrate_${process.pid}`;
const admin = postgres(base.toString(), { max: 1, onnotice: () => {} });
const target = new URL(base);
target.pathname = `/${name}`;
let sql: postgres.Sql;

/** A copy of drizzle/ containing only the first `n` migrations. */
function firstMigrations(n: number): string {
  const dir = mkdtempSync(path.join(tmpdir(), "mig-"));
  cpSync("drizzle", dir, { recursive: true });
  const journalFile = path.join(dir, "meta/_journal.json");
  const journal = JSON.parse(readFileSync(journalFile, "utf8"));
  journal.entries = journal.entries.slice(0, n);
  writeFileSync(journalFile, JSON.stringify(journal));
  return dir;
}

beforeAll(async () => {
  await admin.unsafe(`drop database if exists ${name}`);
  await admin.unsafe(`create database ${name}`);
  sql = postgres(target.toString(), { max: 1, onnotice: () => {} });
  await migrate(drizzle(sql), { migrationsFolder: firstMigrations(1) });
  // Synthetic data in the pre-tenancy shape.
  await sql`insert into "user" (id, name, email, email_verified, role) values
    ('u-admin', 'Admin', 'admin@example.test', true, 'admin'),
    ('u-learner', 'Learner', 'learner@example.test', true, 'learner')`;
  await sql`insert into xp_event (user_id, course, event_id, points, label) values
    ('u-learner', 'c', 'read:ch-1:what-it-is', 5, 'Section read'),
    ('u-learner', 'c', 'step:ch-1:lab:step-1', 10, 'Lab step done')`;
  await sql`insert into lab_step (user_id, course, page_key, lab_key, step_key, done, client_ts) values
    ('u-learner', 'c', 'ch-1', 'lab', 'step-1', true, 1)`;
  await sql`insert into user_settings (user_id, weekly_goal) values ('u-learner', 5)`;
  await sql`insert into activity_day (user_id, day) values ('u-learner', '2026-10-29')`;
  await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
}, 60_000);

afterAll(async () => {
  await sql?.end();
  await admin.unsafe(`drop database if exists ${name}`);
  await admin.end();
});

describe("migration 0001 tenancy", () => {
  it("creates exactly one default tenant offering the course", async () => {
    expect(await sql`select id, slug from tenant`).toEqual([
      { id: "tnt_default", slug: "default" },
    ]);
    expect(await sql`select tenant_id, course, enabled from tenant_course`).toEqual([
      { tenant_id: "tnt_default", course: "ai-engineering-handbook", enabled: true },
    ]);
  });

  it("keeps every row and assigns it to the default tenant", async () => {
    const xp = await sql`select tenant_id, event_id, points from xp_event order by event_id`;
    expect(xp).toEqual([
      { tenant_id: "tnt_default", event_id: "read:ch-1:what-it-is", points: 5 },
      { tenant_id: "tnt_default", event_id: "step:ch-1:lab:step-1", points: 10 },
    ]);
    expect(await sql`select tenant_id, step_key, done from lab_step`).toEqual([
      { tenant_id: "tnt_default", step_key: "step-1", done: true },
    ]);
    expect(await sql`select tenant_id, weekly_goal from user_settings`).toEqual([
      { tenant_id: "tnt_default", weekly_goal: 5 },
    ]);
    expect(await sql`select tenant_id, day::text from activity_day`).toEqual([
      { tenant_id: "tnt_default", day: "2026-10-29" },
    ]);
  });

  it("gives every existing user a learner membership and moves admins to platform_owner", async () => {
    expect(await sql`select user_id, tenant_id, role from membership order by user_id`).toEqual([
      { user_id: "u-admin", tenant_id: "tnt_default", role: "learner" },
      { user_id: "u-learner", tenant_id: "tnt_default", role: "learner" },
    ]);
    expect(await sql`select id, platform_role from "user" order by id`).toEqual([
      { id: "u-admin", platform_role: "platform_owner" },
      { id: "u-learner", platform_role: null },
    ]);
    const cols =
      await sql`select column_name from information_schema.columns where table_name = 'user' and column_name = 'role'`;
    expect(cols).toHaveLength(0);
  });

  it("puts tenant_id first in every personal primary key and requires it", async () => {
    const rows = await sql`
      select tc.table_name, kcu.column_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
      where tc.constraint_type = 'PRIMARY KEY' and kcu.ordinal_position = 1
        and tc.table_name in ('section_progress','lab_step','lab_completion','drill_answer','card_review','last_position','xp_event','activity_day','user_settings')`;
    expect(rows).toHaveLength(9);
    expect(rows.every((r) => r.column_name === "tenant_id")).toBe(true);
    await expect(
      sql`insert into xp_event (user_id, course, event_id, points, label) values ('u-learner', 'c', 'x', 1, 'x')`,
    ).rejects.toThrow(/tenant_id/);
  });

  it("rejects roles outside the model", async () => {
    await expect(sql`update membership set role = 'superuser'`).rejects.toThrow(
      /membership_role_check/,
    );
  });
});
