// What the learner dashboard shows for each course (ADR-0028). Built at build time from the
// course config and manifests, so adding a course to content/courses.json lists it here.
import type { CourseEntry } from "@/content/config";
import type { CourseManifest } from "@/content/types";
import { specOf, type PageSpec } from "./learner-state";

export interface DashboardCourse {
  slug: string;
  title: string;
  level: string | null;
  summary: string | null;
  icon: CourseEntry["icon"];
  /** Published pages' progress specs, grouped by part (for the course %). */
  parts: PageSpec[][];
  /** The part number of each group in `parts` (for checkpoints). */
  partNumbers: number[];
  /** Published pages in course order, for "Up next" and the chapter list. */
  pages: { key: string; slug: string; label: string; title: string }[];
  /** Page key → slug, to resume where the learner left off. */
  slugs: Record<string, string>;
  firstSlug: string | null;
  counts: { chapters: number; comingSoon: number; labs: number };
}

export function dashboardCourse(entry: CourseEntry, m: CourseManifest): DashboardCourse {
  const published = m.pages.filter((p) => p.status === "published");
  const groups = m.parts
    .map((part) => ({
      number: part.number,
      specs: published.filter((p) => p.partNumber === part.number).map((p) => specOf(p)),
    }))
    .filter((g) => g.specs.length > 0);
  return {
    slug: entry.slug,
    title: entry.title ?? m.title,
    level: entry.level ?? null,
    summary: entry.summary ?? null,
    icon: entry.icon,
    parts: groups.map((g) => g.specs),
    partNumbers: groups.map((g) => g.number),
    pages: published.map((p) => ({ key: p.key, slug: p.slug, label: p.label, title: p.title })),
    slugs: Object.fromEntries(published.map((p) => [p.key, p.slug])),
    firstSlug: published[0]?.slug ?? null,
    counts: {
      chapters: published.filter((p) => p.kind === "chapter").length,
      comingSoon: m.pages.filter((p) => p.status === "coming-soon").length,
      labs: published.reduce((n, p) => n + p.sections.filter((s) => s.type === "lab").length, 0),
    },
  };
}
