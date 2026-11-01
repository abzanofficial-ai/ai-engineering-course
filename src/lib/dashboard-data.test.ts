import { describe, expect, it } from "vitest";
import { generated } from "@generated/index";
import { courseConfigSchema } from "@/content/config";
import { dashboardCourse } from "./dashboard-data";
import { applyLocal, courseProgress, emptyState } from "./learner-state";

const manifest = generated["ai-engineering-handbook"]!.manifest;
const entry = courseConfigSchema.parse({
  slug: "ai-engineering-handbook",
  source: "content/handbook.md",
  product: "course-ai-engineering-handbook",
  level: "Beginner → Job Ready",
});

describe("dashboardCourse", () => {
  const c = dashboardCourse(entry, manifest);

  it("summarises the course from its manifest and config", () => {
    expect(c).toMatchObject({
      title: "The AI Engineering Handbook",
      level: "Beginner → Job Ready",
      summary: null,
      icon: "route", // default when the config names none
      firstSlug: "how-to-use-this-book",
      counts: { chapters: 29, comingSoon: 20 },
    });
    expect(c.slugs["ch-1"]).toBe("1-python-for-ai-engineering");
    expect(c.parts.flat()).toHaveLength(31); // every published page, grouped by part
  });

  it("course progress averages parts and moves when the learner reads", () => {
    expect(courseProgress(c.parts, emptyState())).toBe(0);
    let s = emptyState();
    const ch1 = c.parts.flat().find((p) => p.key === "ch-1")!;
    for (const section of ch1.learn)
      s = applyLocal(s, { type: "section_read", page: "ch-1", section, ts: 1 });
    expect(courseProgress(c.parts, s)).toBeGreaterThan(0);
    expect(courseProgress([], s)).toBe(0);
  });
});
