import { describe, expect, it } from "vitest";
import { generated } from "@generated/index";
import { partContent, pickDrill, scoreCheckpoint, seedFor, selectQuestions } from "./checkpoint";

const manifest = generated["ai-engineering-handbook"]!.manifest;

describe("checkpoint rules", () => {
  it("collects a part's questions and drills from published chapters only", () => {
    const p1 = partContent(manifest, 1);
    expect(p1.drillPages).toEqual(["ch-1", "ch-2", "ch-3", "ch-4"]);
    expect(p1.cards.length).toBeGreaterThan(10);
    expect(p1.cards.every((k) => /^ch-[1-4]:/.test(k))).toBe(true);
    expect(partContent(manifest, 11)).toEqual({ cards: [], drillPages: [] }); // coming soon
  });

  it("draws 10 distinct questions, the same set for the same attempt and a new set for the next", () => {
    const cards = partContent(manifest, 1).cards;
    const a = selectQuestions(cards, seedFor(1, 1));
    expect(a).toHaveLength(10);
    expect(new Set(a).size).toBe(10);
    expect(selectQuestions(cards, seedFor(1, 1))).toEqual(a);
    expect(selectQuestions(cards, seedFor(1, 2))).not.toEqual(a);
    expect(selectQuestions(["x", "y"], 1)).toHaveLength(2); // small parts ask everything
  });

  it("rotates the drill across attempts", () => {
    expect([1, 2, 3, 5].map((n) => pickDrill(["a", "b", "c", "d"], n))).toEqual([
      "a",
      "b",
      "c",
      "a",
    ]);
    expect(pickDrill([], 1)).toBeUndefined();
  });

  it("passes at 80% confident with the drill answered", () => {
    const r = (c: number, u: number) =>
      Object.fromEntries(
        [...Array(c)]
          .map((_, i) => [`c${i}`, "confident"])
          .concat([...Array(u)].map((_, i) => [`u${i}`, "unsure"])),
      );
    const answer = "I would ask whether it runs once or every week.";
    expect(scoreCheckpoint(r(8, 2), answer)).toEqual({ score: 80, passed: true });
    expect(scoreCheckpoint(r(7, 3), answer)).toEqual({ score: 70, passed: false });
    expect(scoreCheckpoint(r(10, 0), "too short")).toEqual({ score: 100, passed: false });
  });
});
