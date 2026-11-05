import { describe, expect, it } from "vitest";
import { generated } from "@generated/index";
import { applyLocal, emptyState, pageProgress, specOf } from "./learner-state";
import { enqueue, GUEST_PROMPT_TYPES, GUEST_TYPES } from "./guest-progress";
import type { Op } from "./ops-schema";

const read = (section: string, ts = 1): Op => ({ type: "section_read", page: "p", section, ts });
const pos = (index: number, ts = 1): Op => ({
  type: "position",
  page: "p",
  mode: "learn",
  index,
  ts,
});

describe("guest progress queue", () => {
  it("keeps every action in order, but only the latest position", () => {
    let q: Op[] = [];
    q = enqueue(q, pos(0));
    q = enqueue(q, read("a"));
    q = enqueue(q, pos(3));
    q = enqueue(q, read("b"));
    expect(q).toEqual([read("a"), pos(3), read("b")]);
  });

  it("is capped, dropping the oldest actions first", () => {
    let q: Op[] = [];
    for (let i = 0; i < 12; i++) q = enqueue(q, read(`s${i}`, i), 10);
    expect(q).toHaveLength(10);
    expect(q[0]).toEqual(read("s2", 2));
    expect(q.at(-1)).toEqual(read("s11", 11));
  });

  it("reading every section of a public page makes it 100% complete; re-reading counts once", () => {
    const page = generated["ai-engineering-handbook"]!.manifest.pages.find(
      (p) => p.key === "start-how-to-use-this-book",
    )!;
    const spec = specOf(page);
    const r = (section: string): Op => ({ type: "section_read", page: page.key, section, ts: 1 });
    const all = spec.learn.map(r);
    const once = all.reduce(applyLocal, emptyState());
    const twice = [...all, ...all].reduce(applyLocal, emptyState());
    expect(pageProgress(spec, all.slice(0, -1).reduce(applyLocal, emptyState()))).toBeLessThan(100);
    expect(pageProgress(spec, once)).toBe(100);
    expect(twice.read[page.key]).toEqual(spec.learn);
  });

  it("visitors keep reading, ticks and answers; ratings, notes, bookmarks and goals need an account", () => {
    expect([...GUEST_TYPES].sort()).toEqual([
      "commit",
      "drill",
      "position",
      "section_read",
      "step",
    ]);
    expect([...GUEST_PROMPT_TYPES].sort()).toEqual(["commit", "drill", "step"]);
    for (const t of ["card", "note_save", "note_delete", "bookmark", "goal"] as const)
      expect(GUEST_TYPES.has(t)).toBe(false);
  });
});
