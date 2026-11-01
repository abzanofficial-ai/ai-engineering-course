// Notes and bookmarks (ADR-0027): last-write-wins sync, final deletes, and isolation between
// learners and tenants. Note ids are chosen by the client, so the tests attack them directly.
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as exportRoute from "@/app/api/me/export/route";
import * as ops from "@/app/api/me/ops/route";
import * as stateRoute from "@/app/api/me/state/route";
import { db } from "@/server/db/client";
import { deleteUser } from "@/server/repo/account";
import { applyOps, type Op } from "@/server/repo/progress";
import { loadState } from "@/server/repo/state";
import { DEFAULT_TENANT_ID } from "@/server/repo/tenant";
import { req, signIn } from "./auth-helpers";
import { COURSE, makeUser, TODAY } from "./helpers";

const ctx = (userId: string, tenantId = DEFAULT_TENANT_ID) => ({ tenantId, userId });
const run = (userId: string, list: Op[], tenantId?: string) =>
  applyOps(ctx(userId, tenantId), { course: COURSE, day: TODAY, ops: list });
const state = (userId: string, tenantId?: string) =>
  loadState(ctx(userId, tenantId), COURSE, TODAY);
const save = (id: string, body: string, ts: number, section = "what-it-is"): Op => ({
  type: "note_save",
  id,
  page: "ch-1",
  section,
  body,
  ts,
});

describe("notes", () => {
  it("saves, edits with last-write-wins and lists newest first, earning no XP or streak", async () => {
    const u = await makeUser();
    const [n1, n2] = [randomUUID(), randomUUID()];
    const res = await run(u, [save(n1, "First thought", 1), save(n2, "Lab idea", 2, "lab")]);
    expect(res).toEqual([{ ok: true }, { ok: true }]);
    await run(u, [save(n1, "Edited on phone", 5)]);
    await run(u, [save(n1, "Stale edit from laptop", 3)]); // older: loses
    const s = await state(u);
    expect(s.notes.map((n) => [n.id, n.section, n.body])).toEqual([
      [n1, "what-it-is", "Edited on phone"],
      [n2, "lab", "Lab idea"],
    ]);
    expect(s.xp.total).toBe(0);
    expect(s.streak.activeToday).toBe(false);
  });

  it("deletes for good: the text is erased and a later save cannot bring it back", async () => {
    const u = await makeUser();
    const id = randomUUID();
    await run(u, [save(id, "Delete me", 1)]);
    await run(u, [{ type: "note_delete", id, ts: 2 }]);
    await run(u, [save(id, "Resurrected?", 9)]);
    expect((await state(u)).notes).toEqual([]);
    const rows = await db().execute(sql`select body, deleted from note where id = ${id}`);
    expect([...rows]).toEqual([{ body: "", deleted: true }]);
  });

  it("rejects unknown sections, empty bodies and non-UUID ids", async () => {
    const u = await makeUser();
    expect(await run(u, [save(randomUUID(), "x", 1, "no-such-section")])).toEqual([
      { ok: false, error: "unknown section" },
    ]);
    const b = await signIn("notes-validate@example.test");
    for (const bad of [save(randomUUID(), "   ", 1), save("not-a-uuid", "x", 1)]) {
      const r = await ops.POST(
        req("/api/me/ops", b, { method: "POST", json: { course: COURSE, day: TODAY, ops: [bad] } }),
      );
      expect(r.status).toBe(400);
    }
  });
});

describe("bookmarks", () => {
  it("toggles with last-write-wins", async () => {
    const u = await makeUser();
    const mark = (on: boolean, ts: number): Op => ({
      type: "bookmark",
      page: "ch-1",
      section: "lab",
      on,
      ts,
    });
    await run(u, [mark(true, 1)]);
    expect((await state(u)).bookmarks).toEqual({ "ch-1": ["lab"] });
    await run(u, [mark(false, 3), mark(true, 2)]); // the older "on" arrives late and loses
    expect((await state(u)).bookmarks).toEqual({});
  });
});

describe("notes and bookmarks isolation", () => {
  const SECRET = "A's private note: ask the team lead about the deadline";
  const idOf = async (email: string) =>
    String([...(await db().execute(sql`select id from "user" where email = ${email}`))][0]!.id);

  async function seed() {
    const a = await signIn("notes-a@example.test");
    const b = await signIn("notes-b@example.test");
    const id = randomUUID();
    await ops.POST(
      req("/api/me/ops", a, {
        method: "POST",
        json: {
          course: COURSE,
          day: TODAY,
          ops: [
            save(id, SECRET, 1),
            { type: "bookmark", page: "ch-1", section: "lab", on: true, ts: 1 },
          ],
        },
      }),
    );
    return { a, b, id, aId: await idOf("notes-a@example.test") };
  }

  it("B cannot read, overwrite or delete A's note even with its id, nor see A's bookmarks", async () => {
    const { a, b, id, aId } = await seed();
    const attack = await ops.POST(
      req("/api/me/ops", b, {
        method: "POST",
        json: {
          course: COURSE,
          day: TODAY,
          userId: aId,
          ops: [save(id, "Overwritten by B", 99), { type: "note_delete", id, ts: 100 }],
        },
      }),
    );
    expect(attack.status).toBe(200);

    const bodyA = await (
      await stateRoute.GET(req(`/api/me/state?course=${COURSE}&day=${TODAY}`, a))
    ).json();
    expect(bodyA.state.notes.map((n: { body: string }) => n.body)).toEqual([SECRET]);
    expect(bodyA.state.bookmarks).toEqual({ "ch-1": ["lab"] });

    const textB = await (
      await stateRoute.GET(req(`/api/me/state?course=${COURSE}&day=${TODAY}`, b))
    ).text();
    expect(textB).not.toContain(SECRET);
    expect(JSON.parse(textB).state.bookmarks).toEqual({});
    const exportB = await (await exportRoute.GET(req("/api/me/export", b))).text();
    expect(exportB).not.toContain(SECRET);
  });

  it("A's export includes the note and bookmark; deleting the account removes them", async () => {
    const { a, aId } = await seed();
    const exp = await (await exportRoute.GET(req("/api/me/export", a))).json();
    expect(exp.notes.map((n: { body: string }) => n.body)).toEqual([SECRET]);
    expect(exp.bookmarks).toHaveLength(1);
    await deleteUser(ctx(aId));
    const left = await db().execute(
      sql`select (select count(*) from note)::int as notes, (select count(*) from bookmark)::int as marks`,
    );
    expect([...left]).toEqual([{ notes: 0, marks: 0 }]);
  });

  it("the same learner's notes are separate per tenant", async () => {
    const OTHER = "tnt_test_notes";
    await db().execute(
      sql`insert into tenant (id, slug, config) values (${OTHER}, 'notes-centre', '{}'::jsonb) on conflict do nothing`,
    );
    await db().execute(
      sql`insert into tenant_course (tenant_id, course) values (${OTHER}, ${COURSE}) on conflict do nothing`,
    );
    const u = await makeUser();
    const id = randomUUID();
    await run(u, [save(id, "Default tenant note", 1)]);
    await run(u, [save(id, "Other tenant note", 2)], OTHER);
    expect((await state(u)).notes.map((n) => n.body)).toEqual(["Default tenant note"]);
    expect((await state(u, OTHER)).notes.map((n) => n.body)).toEqual(["Other tenant note"]);
  });
});
