import { describe, expect, it } from "vitest";
import { diffManifests, formatDiff } from "./diff";
import type { CourseManifest, PageMeta } from "./types";

const page = (key: string, over: Partial<PageMeta> = {}): PageMeta => ({
  key,
  kind: "chapter",
  number: Number(key.slice(3)),
  label: `Chapter ${key.slice(3)}`,
  title: `Title ${key}`,
  slug: `${key.slice(3)}-title`,
  partNumber: 1,
  status: "published",
  readingMinutes: 5,
  labMinutes: 30,
  sections: [
    { key: "what-it-is", type: "prose", title: "What it is", hash: "a" },
    {
      key: "lab",
      type: "lab",
      title: "Lab",
      hash: "b",
      steps: [
        { key: "step-1", label: "1", title: "Go" },
        { key: "step-2", label: "2", title: "Go" },
      ],
    },
  ],
  cards: ["ch-1:q-1"],
  hash: "h",
  ...over,
});
const manifest = (pages: PageMeta[], sourceHash = "s"): CourseManifest => ({
  slug: "c",
  title: "C",
  sourceHash,
  parts: [],
  pages,
  warnings: [],
});

describe("diffManifests", () => {
  it("reports identical sources", () => {
    const m = manifest([page("ch-1")]);
    expect(diffManifests(m, m).identical).toBe(true);
    expect(formatDiff(diffManifests(m, m))).toMatch(/No changes/);
  });

  it("reports removed steps and cards as keys that learner data may reference", () => {
    const before = manifest([page("ch-1")]);
    const after = manifest(
      [
        page("ch-1", {
          hash: "h2",
          cards: [],
          sections: [
            { key: "what-it-is", type: "prose", title: "What it is", hash: "a2" },
            {
              key: "lab",
              type: "lab",
              title: "Lab",
              hash: "b2",
              steps: [{ key: "step-1", label: "1", title: "Go" }],
            },
          ],
        }),
      ],
      "s2",
    );
    const d = diffManifests(before, after);
    expect(d.changedPages[0]).toMatchObject({
      changedSections: ["what-it-is", "lab"],
      removedSteps: ["lab/step-2"],
      removedCards: 1,
    });
    expect(d.removedKeys).toEqual([
      { pageKey: "ch-1", kind: "step", key: "lab/step-2" },
      { pageKey: "ch-1", kind: "card", key: "ch-1:q-1" },
    ]);
  });

  it("reports coming-soon chapters that became published and slug changes", () => {
    const before = manifest([
      page("ch-1"),
      page("ch-2", { status: "coming-soon", sections: [], cards: [] }),
    ]);
    const after = manifest([page("ch-1", { slug: "1-new-title" }), page("ch-2")], "s2");
    const d = diffManifests(before, after);
    expect(d.nowPublished.map((p) => p.key)).toEqual(["ch-2"]);
    expect(d.renamedSlugs).toEqual([{ key: "ch-1", from: "1-title", to: "1-new-title" }]);
    expect(formatDiff(d)).toContain("Coming soon → published");
  });
});
