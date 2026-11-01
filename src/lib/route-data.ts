// Compact course summary for the route map (sent to the browser; no page bodies).
import type { CourseManifest } from "@/content/types";
import { specOf, type PageSpec } from "./learner-state";

export interface RoutePage {
  key: string;
  slug: string;
  title: string;
  label: string;
  number?: number;
  kind: string;
  status: string;
  readingMinutes: number;
  labMinutes: number;
  spec: PageSpec;
}

export interface RoutePart {
  number: number;
  title: string;
  outcomeHtml: string;
  milestone: boolean;
  pages: RoutePage[];
}

export interface RouteData {
  course: string;
  title: string;
  parts: RoutePart[];
  counts: { chapters: number; steps: number; drills: number; questions: number };
}

export function routeData(course: string, m: CourseManifest): RouteData {
  const byKey = new Map(m.pages.map((p) => [p.key, p]));
  const published = m.pages.filter((p) => p.status === "published");
  return {
    course,
    title: m.title,
    parts: m.parts.map((part) => ({
      number: part.number,
      title: part.title,
      outcomeHtml: part.outcomeHtml,
      milestone: part.milestone,
      pages: part.pages.map((k) => {
        const p = byKey.get(k)!;
        return {
          key: p.key,
          slug: p.slug,
          title: p.title,
          label: p.label,
          number: p.number,
          kind: p.kind,
          status: p.status,
          readingMinutes: p.readingMinutes,
          labMinutes: p.labMinutes,
          spec: specOf(p),
        };
      }),
    })),
    counts: {
      chapters: published.filter((p) => p.kind === "chapter").length,
      steps: published.reduce(
        (n, p) => n + p.sections.reduce((k, s) => k + (s.steps?.length ?? 0), 0),
        0,
      ),
      drills: published.reduce(
        (n, p) => n + p.sections.filter((s) => s.type === "drill").length,
        0,
      ),
      questions: published.reduce((n, p) => n + p.cards.length, 0),
    },
  };
}

export function formatLab(minutes: number): string {
  return minutes >= 90 ? `${Math.round(minutes / 30) / 2} h` : `${minutes} min`;
}
