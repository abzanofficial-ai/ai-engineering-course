import { describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { applyOps, clampDay, type Op } from "@/server/ops";
import { loadState } from "@/server/state";
import { cardText } from "@/server/course-index";
import { generated } from "@generated/index";
import { COURSE, makeUser, TODAY } from "./helpers";

const manifest = generated[COURSE]!.manifest;
const ch1 = manifest.pages.find((p) => p.key === "ch-1")!;
const lab = ch1.sections.find((s) => s.key === "lab")!;
const firstCard = ch1.cards[0]!;
const run = (userId: string, ops: Op[]) =>
  applyOps(db(), userId, { course: COURSE, day: TODAY, ops });
const state = (userId: string) => loadState(db(), userId, COURSE, TODAY);

describe("applyOps", () => {
  it("saves each kind of progress and awards XP once per item", async () => {
    const u = await makeUser();
    const res = await run(u, [
      { type: "section_read", page: "ch-1", section: "what-it-is", ts: 1 },
      { type: "step", page: "ch-1", lab: "lab", step: lab.steps![0]!.key, done: true, ts: 2 },
      { type: "commit", page: "ch-1", lab: "lab", done: true, ts: 3 },
      {
        type: "drill",
        page: "ch-1",
        answer: "Ask whether it runs once or repeatedly.",
        revealed: true,
        ts: 4,
      },
      { type: "card", card: firstCard, rating: "unsure", ts: 5 },
    ]);
    expect(res.map((r) => (r.ok ? r.xp : r.error))).toEqual([5, 10, 50, 30, 5]);

    // Replaying the same batch (offline retry) earns nothing more.
    const again = await run(u, [
      { type: "section_read", page: "ch-1", section: "what-it-is", ts: 1 },
      { type: "step", page: "ch-1", lab: "lab", step: lab.steps![0]!.key, done: true, ts: 2 },
    ]);
    expect(again).toEqual([{ ok: true }, { ok: true }]);

    const s = await state(u);
    expect(s.read["ch-1"]).toEqual(["what-it-is"]);
    expect(s.steps["ch-1"]!["lab"]).toEqual([lab.steps![0]!.key]);
    expect(s.commits["ch-1"]).toEqual(["lab"]);
    expect(s.drills["ch-1"]).toEqual({
      answer: "Ask whether it runs once or repeatedly.",
      revealed: true,
    });
    expect(s.cards[firstCard]).toBe("unsure");
    expect(s.xp.total).toBe(100);
    expect(s.streak).toMatchObject({ streak: 1, activeToday: true });
    expect(s.week.active).toBe(1);
  });

  it("rejects keys that do not exist, without saving or awarding anything", async () => {
    const u = await makeUser();
    const res = await run(u, [
      { type: "section_read", page: "ch-1", section: "made-up", ts: 1 },
      { type: "section_read", page: "ch-1", section: "lab", ts: 1 }, // not a Learn section
      { type: "step", page: "ch-1", lab: "lab", step: "step-99", done: true, ts: 1 },
      { type: "card", card: "ch-1:q-00000000", rating: "confident", ts: 1 },
      { type: "drill", page: "ch-99", answer: "x".repeat(30), revealed: true, ts: 1 },
    ]);
    expect(res.every((r) => !r.ok)).toBe(true);
    const s = await state(u);
    expect(s.xp.total).toBe(0);
    expect(s.streak.streak).toBe(0);
  });

  it("does not award drill XP for a skipped or too-short answer", async () => {
    const u = await makeUser();
    expect(
      await run(u, [{ type: "drill", page: "ch-1", answer: "too short", revealed: true, ts: 1 }]),
    ).toEqual([{ ok: true }]);
  });

  it("resolves offline replays with last-write-wins on client time", async () => {
    const u = await makeUser();
    const step = lab.steps![1]!.key;
    await run(u, [{ type: "step", page: "ch-1", lab: "lab", step, done: false, ts: 200 }]);
    await run(u, [{ type: "step", page: "ch-1", lab: "lab", step, done: true, ts: 100 }]); // older, arrives late
    expect((await state(u)).steps["ch-1"]?.["lab"] ?? []).not.toContain(step);
    await run(u, [{ type: "step", page: "ch-1", lab: "lab", step, done: true, ts: 300 }]);
    expect((await state(u)).steps["ch-1"]!["lab"]).toContain(step);
  });

  it("unticking keeps earned XP (no punishment for corrections)", async () => {
    const u = await makeUser();
    const step = lab.steps![0]!.key;
    await run(u, [{ type: "step", page: "ch-1", lab: "lab", step, done: true, ts: 1 }]);
    await run(u, [{ type: "step", page: "ch-1", lab: "lab", step, done: false, ts: 2 }]);
    const s = await state(u);
    expect(s.xp.total).toBe(10);
    expect(s.steps["ch-1"]?.["lab"] ?? []).toEqual([]);
  });

  it("remembers the last position and the weekly goal (clamped 1–7)", async () => {
    const u = await makeUser();
    await run(u, [
      { type: "position", page: "ch-3", mode: "practise", index: 2, ts: 5 },
      { type: "goal", weeklyGoal: 12, ts: 5 },
    ]);
    const s = await state(u);
    expect(s.last).toEqual({ pageKey: "ch-3", mode: "practise", sectionIndex: 2 });
    expect(s.week.goal).toBe(7);
    expect(s.streak.streak).toBe(0); // navigation alone is not learning
  });

  it("clamps the client's date to within a day of server time", () => {
    const now = new Date("2026-10-29T12:00:00Z");
    expect(clampDay("2026-10-29", now)).toBe("2026-10-29");
    expect(clampDay("2026-10-30", now)).toBe("2026-10-30");
    expect(clampDay("2030-01-01", now)).toBe("2026-10-30");
    expect(clampDay("2020-01-01", now)).toBe("2026-10-28");
  });

  it("knows the text of every card it accepts", () => {
    expect(cardText(COURSE, firstCard)).toBeTruthy();
  });
});
