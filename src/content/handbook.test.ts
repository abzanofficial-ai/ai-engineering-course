// Structural assertions against the real content/handbook.md, plus idempotency and key
// stability — the guarantees that keep learner progress safe across re-imports.
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { buildCourse } from "./build-course";
import { diffManifests } from "./diff";
import type { CourseBuild } from "./types";

const source = readFileSync(new URL("../../content/handbook.md", import.meta.url), "utf8");
const config = { slug: "ai-engineering-handbook" };
let build: CourseBuild;

beforeAll(async () => {
  build = await buildCourse(source, config);
}, 60_000);

describe("content/handbook.md", () => {
  it("parses without warnings", () => {
    expect(build.manifest.warnings).toEqual([]);
  });

  it("has 15 parts plus Start here, Chapters 1–29 published and 20 entries coming soon", () => {
    const m = build.manifest;
    expect(m.parts.map((p) => p.number)).toEqual([...Array(16).keys()]);
    const chapters = m.pages.filter((p) => p.kind === "chapter" && p.status === "published");
    expect(chapters.map((p) => p.number)).toEqual(Array.from({ length: 29 }, (_, i) => i + 1));
    const soon = m.pages.filter((p) => p.status === "coming-soon").map((p) => p.key);
    expect(soon).toEqual([
      "ch-0",
      "appendix-a",
      ...Array.from({ length: 18 }, (_, i) => `ch-${i + 30}`),
    ]);
  });

  it("reads each part's 'You can now' outcome and its milestones", () => {
    const parts = build.manifest.parts;
    expect(parts[1]!.outcomeHtml).toBe("Build and ship working software");
    expect(parts.filter((p) => p.milestone).map((p) => p.number)).toEqual([8, 13]);
    expect(parts[8]!.outcomeHtml).toContain("<strong>First sellable product</strong>");
  });

  it("finds every interactive element in every chapter", () => {
    const chapters = build.pages.filter((p) => p.kind === "chapter");
    for (const ch of chapters) {
      const types = new Set(ch.sections.map((s) => s.type));
      for (const t of ["jargon", "interview", "lab", "drill", "stuck", "judgment"]) {
        expect(types.has(t as never), `${ch.key} missing ${t}`).toBe(true);
      }
      expect(ch.definitionHtml, `${ch.key} definition`).toBeTruthy();
      const drill = ch.content.find((s) => s.type === "drill")!;
      expect(
        drill.blocks.some((b) => b.kind === "drill-reveal"),
        `${ch.key} drill reveal`,
      ).toBe(true);
    }
  });

  it("extracts 231 lab steps, 75 diagrams and every chapter's questions", () => {
    const steps = build.manifest.pages.flatMap((p) => p.sections.flatMap((s) => s.steps ?? []));
    expect(steps).toHaveLength(231);
    expect(build.diagrams).toHaveLength(75);
    expect(build.cards.length).toBeGreaterThanOrEqual(200);
  });

  it("finds commit blocks in every lab except Chapter 2's (which has none in the source)", () => {
    const missing = build.manifest.pages.flatMap((p) =>
      p.sections.filter((s) => s.type === "lab" && !s.hasCommit).map((s) => `${p.key}/${s.key}`),
    );
    expect(missing).toEqual(["ch-2/lab"]);
  });

  it("is idempotent: the same input produces byte-identical output", async () => {
    const again = await buildCourse(source, config);
    expect(JSON.stringify(again)).toBe(JSON.stringify(build));
  }, 60_000);

  it("keeps every existing key when a new chapter is added and prose is edited", async () => {
    const newChapter =
      "\n## Chapter 30: AI Product, UX & Feedback Loops\n\n### Jargon decoder\n\n| Term | Plain meaning |\n| --- | --- |\n| **Feedback loop** | Corrections that improve the system |\n\n**Definition:** designing AI products people trust.\n\n### Interview questions\n\n- How do you design for uncertainty?\n";
    const edited = source
      .replace("A readable, forgiving language", "A readable, very forgiving language")
      .replace("\n# Part 11", `${newChapter}\n# Part 11`);
    const next = await buildCourse(
      edited.includes("# Part 11") ? edited : edited + newChapter,
      config,
    );
    const diff = diffManifests(build.manifest, next.manifest);

    expect(diff.removedKeys).toEqual([]);
    expect(diff.nowPublished.map((p) => p.key)).toEqual(["ch-30"]);
    expect(diff.changedPages.map((c) => c.key)).toEqual(["ch-1"]);
    expect(diff.changedPages[0]!.changedSections).toEqual(["what-it-is"]);

    const oldSteps = build.manifest.pages.flatMap((p) =>
      p.sections.flatMap((s) => (s.steps ?? []).map((st) => `${p.key}/${s.key}/${st.key}`)),
    );
    const newSteps = new Set(
      next.manifest.pages.flatMap((p) =>
        p.sections.flatMap((s) => (s.steps ?? []).map((st) => `${p.key}/${s.key}/${st.key}`)),
      ),
    );
    expect(oldSteps.every((k) => newSteps.has(k))).toBe(true);
    expect(build.cards.every((c) => next.cards.some((n) => n.key === c.key))).toBe(true);
  }, 120_000);
});
