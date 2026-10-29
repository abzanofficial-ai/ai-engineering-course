import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { buildCourse, classifySection, parseMinutes } from "./build-course";
import type { CourseBuild, Page } from "./types";

const fixture = readFileSync(
  new URL("../../tests/fixtures/mini-handbook.md", import.meta.url),
  "utf8",
);
let build: CourseBuild;
const htmlOf = (p: Page): string =>
  p.content.flatMap((s) => s.blocks.map((b) => ("html" in b ? b.html : ""))).join("\n");
const page = (key: string): Page => {
  const p = build.pages.find((x) => x.key === key);
  if (!p) throw new Error(`no page ${key}`);
  return p;
};

beforeAll(async () => {
  build = await buildCourse(fixture, { slug: "mini" });
});

describe("structure", () => {
  it("reads the book title and ignores `#` comment lines inside code", () => {
    expect(build.manifest.title).toBe("Mini Handbook");
    expect(build.manifest.warnings).toEqual([]);
    expect(build.manifest.parts.map((p) => p.title)).toEqual([
      "Start here",
      "Foundations",
      "Later Part",
    ]);
  });

  it("turns front matter into start pages and the Index into data, not a page", () => {
    const start = build.manifest.pages.filter((p) => p.kind === "start").map((p) => p.key);
    expect(start).toEqual(["start-how-to-use-this-book", "start-the-capstone-what-you-build"]);
    expect(build.manifest.pages.some((p) => /index/i.test(p.title))).toBe(false);
  });

  it("marks Index entries without a chapter body as coming soon, matched by number not anchor", () => {
    const status = Object.fromEntries(build.manifest.pages.map((p) => [p.key, p.status]));
    expect(status).toMatchObject({
      "ch-0": "coming-soon",
      "appendix-a": "coming-soon",
      "ch-1": "published",
      "ch-2": "published",
      "ch-3": "coming-soon",
      "ch-4": "coming-soon",
    });
    const ch3 = build.manifest.pages.find((p) => p.key === "ch-3")!;
    expect(ch3.title).toBe("Not written yet");
    expect(ch3.partNumber).toBe(2);
  });

  it("orders pages: start, then parts by number, chapters by number", () => {
    expect(build.manifest.pages.map((p) => p.key)).toEqual([
      "start-how-to-use-this-book",
      "start-the-capstone-what-you-build",
      "ch-0",
      "appendix-a",
      "ch-1",
      "ch-2",
      "ch-3",
      "ch-4",
    ]);
  });

  it("keeps part intros", () => {
    expect(build.manifest.parts[1]!.introHtml).toContain("Part one intro paragraph");
  });
});

describe("chapter sections", () => {
  it("lifts the inline Definition paragraph out as the lede", () => {
    expect(page("ch-1").definitionHtml).toContain("the language every AI library is written for");
    expect(JSON.stringify(page("ch-1").content)).not.toContain("the language every AI library");
  });

  it("classifies template sections and keys the rest by heading slug", () => {
    expect(page("ch-1").sections.map((s) => s.key)).toEqual([
      "jargon",
      "what-it-is",
      "interview",
      "lab",
      "judgment",
      "stuck",
      "drill",
    ]);
    expect(page("ch-2").sections.map((s) => s.key)).toEqual(["jargon", "lab", "lab-2", "drill"]);
  });

  it("renders code as highlighted figures and never treats `# comment` as a heading", () => {
    const html = htmlOf(page("ch-1"));
    expect(html).toContain('<figure class="code"');
    expect(html).not.toMatch(/<pre[^>]*tabindex[^>]*tabindex/);
    expect(html).toContain("Wrong: each call blocks the next");
    expect(html).not.toMatch(/<h\d[^>]*>Wrong: each call/);
  });

  it("marks shell blocks with prompts for prompt-stripping copy", () => {
    expect(htmlOf(page("ch-1"))).toContain('data-copy-mode="shell"');
  });
});

describe("labs", () => {
  it("extracts numbered steps, time, troubleshooting and the paragraph-style commit block", () => {
    const lab = page("ch-1").sections.find((s) => s.key === "lab")!;
    expect(lab.steps!.map((s) => s.key)).toEqual(["step-1", "step-2"]);
    expect(lab.labMinutes).toBe(45);
    expect(lab.hasCommit).toBe(true);
    const kinds = page("ch-1")
      .content.find((s) => s.key === "lab")!
      .blocks.map((b) => b.kind);
    expect(kinds).toEqual([
      "html",
      "lab-step",
      "lab-step",
      "lab-troubleshoot",
      "html",
      "lab-commit",
    ]);
  });

  it("supports step labels like 7b, a second lab, and a lab without a commit marker", () => {
    const [lab1, lab2] = page("ch-2").sections.filter((s) => s.type === "lab");
    expect(lab1!.steps!.map((s) => s.key)).toEqual(["step-1", "step-7b"]);
    expect(lab1!.hasCommit).toBe(false); // "Commit it:" inside a step is not the lab's commit block
    expect(lab2!.key).toBe("lab-2");
    expect(lab2!.hasCommit).toBe(true);
  });

  it("parses lab durations", () => {
    expect(parseMinutes("about 45 minutes.")).toBe(45);
    expect(parseMinutes("about 2.5 hours, of which an hour")).toBe(150);
    expect(parseMinutes("no time given")).toBe(0);
  });
});

describe("drills", () => {
  it("hides everything from 'How an experienced engineer reasons' onwards", () => {
    const drill = page("ch-1").content.find((s) => s.key === "drill")!;
    expect(drill.blocks.map((b) => b.kind)).toEqual(["html", "drill-reveal"]);
    expect(drill.blocks[0]!.kind === "html" && drill.blocks[0]!.html).not.toContain("Batch it");
    const reveal = drill.blocks[1]!;
    expect(reveal.kind === "drill-reveal" && reveal.html).toContain("What to tell the client");
  });

  it("recognises the 'cheapest first' variant", () => {
    const drill = page("ch-2").content.find((s) => s.key === "drill")!;
    expect(drill.blocks.at(-1)!.kind).toBe("drill-reveal");
  });
});

describe("interview questions and prompts", () => {
  it("makes one card per question with hashed stable keys", () => {
    expect(build.cards.map((c) => c.text)).toEqual([
      "How would you handle 100 concurrent requests?",
      "What happens on a 429?",
    ]);
    expect(build.cards[0]!.key).toMatch(/^ch-1:q-[0-9a-f]{8}$/);
  });

  it("highlights [placeholders] in prompts and copies them without wrapping quotes", () => {
    const stuck = page("ch-1").content.find((s) => s.key === "stuck")!;
    const prompts = stuck.blocks.filter((b) => b.kind === "prompt");
    expect(prompts).toHaveLength(2);
    expect(prompts[0]!.kind === "prompt" && prompts[0]!.html).toContain(
      '<mark class="placeholder">[paste full error]</mark>',
    );
    expect(prompts[0]!.kind === "prompt" && prompts[0]!.text).toBe(
      "I got [paste full error] on [OS]. What's wrong?",
    );
  });
});

describe("glossary", () => {
  it("collects terms across chapters, merging duplicates with every definition", () => {
    const pkg = build.glossary.find((g) => g.term === "Package / dependency")!;
    expect(pkg.definitions.map((d) => d.pageKey)).toEqual(["ch-1", "ch-2"]);
    expect(pkg.forms).toEqual(["dependency", "package"]);
    expect(build.glossary.find((g) => g.term === "Asynchronous (async)")!.forms).toEqual([
      "asynchronous",
      "async",
    ]);
    expect(build.glossary.find((g) => g.term === "Array (NumPy)")!.forms).toEqual(["array"]);
  });
});

describe("diagrams and links", () => {
  it("collects diagrams with generated alt text and falls back to source when not rendered", () => {
    expect(build.diagrams).toHaveLength(1);
    expect(build.diagrams[0]!.alt).toMatch(/^Flowchart, top to bottom, 3 steps/);
    const html = htmlOf(page("start-the-capstone-what-you-build"));
    expect(html).toContain("diagram-source");
    expect(html).toContain("Diagram as text");
  });

  it("uses rendered SVGs with explicit dimensions when available", async () => {
    const id = build.diagrams[0]!.hash;
    const withRenders = await buildCourse(
      fixture,
      { slug: "mini" },
      { [id]: { width: 300, height: 200 } },
    );
    const html = htmlOf(
      withRenders.pages.find((p) => p.key === "start-the-capstone-what-you-build")!,
    );
    expect(html).toContain(`/diagrams/${id}-light.svg`);
    expect(html).toContain('width="300"');
  });

  it("never emits raw HTML from the source", async () => {
    const evil = await buildCourse(
      `# T\n\n## Chapter 1: X\n\n### What it is\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n`,
      { slug: "x" },
    );
    const html = JSON.stringify(evil.pages);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
  });
});

describe("classification", () => {
  it.each([
    ["Practice lab, part 2: hardening the gateway", "lab"],
    ["Stuck? Ask Claude", "stuck"],
    ["Real-world example — Harbour & Finch", "prose"],
    ['Decision drill: "just use ChatGPT"', "drill"],
  ])("%s → %s", (title, type) => expect(classifySection(title)).toBe(type));
});
