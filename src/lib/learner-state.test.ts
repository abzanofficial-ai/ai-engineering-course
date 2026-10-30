import { describe, expect, it } from "vitest";
import { applyLocal, emptyState } from "./learner-state";

const ID = "6f1c1d1e-8a1b-4c6d-9e2f-0a1b2c3d4e5f";

describe("applyLocal", () => {
  it("toggles bookmarks without duplicates", () => {
    let s = emptyState();
    s = applyLocal(s, { type: "bookmark", page: "ch-1", section: "lab", on: true, ts: 1 });
    s = applyLocal(s, { type: "bookmark", page: "ch-1", section: "lab", on: true, ts: 2 });
    expect(s.bookmarks).toEqual({ "ch-1": ["lab"] });
    s = applyLocal(s, { type: "bookmark", page: "ch-1", section: "lab", on: false, ts: 3 });
    expect(s.bookmarks).toEqual({ "ch-1": [] });
  });

  it("saves a note to the top, edits it in place, and deletes it", () => {
    let s = emptyState();
    const save = (id: string, body: string, ts: number) =>
      applyLocal(s, { type: "note_save", id, page: "ch-1", section: "intro", body, ts });
    s = save(ID, "  first  ", 1);
    s = save("other", "second", 2);
    s = save(ID, "edited", 3);
    expect(s.notes.map((n) => [n.id, n.body])).toEqual([
      [ID, "edited"],
      ["other", "second"],
    ]);
    s = applyLocal(s, { type: "note_delete", id: ID, ts: 4 });
    expect(s.notes.map((n) => n.id)).toEqual(["other"]);
  });

  it("does not mutate the previous state", () => {
    const before = emptyState();
    applyLocal(before, { type: "bookmark", page: "ch-1", section: "lab", on: true, ts: 1 });
    expect(before.bookmarks).toEqual({});
  });
});
