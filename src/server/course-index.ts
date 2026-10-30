// Server-side lookup of valid content keys per course, built once from the generated
// manifests. Every write is validated against it, so a client cannot store progress for
// (or earn XP from) keys that do not exist.
import { generated } from "@generated/index";
import { isLearnSection } from "@/lib/learner-state";
import type { CourseManifest } from "@/content/types";

export interface CourseIndex {
  manifest: CourseManifest;
  learnSections: Map<string, Set<string>>; // pageKey → learn section keys
  sections: Map<string, Set<string>>; // pageKey → every section key
  labSteps: Map<string, Map<string, Set<string>>>; // pageKey → labKey → step keys
  drills: Set<string>; // pageKeys with a drill
  cards: Map<string, string>; // cardKey → pageKey
  pages: Set<string>;
}

const cache = new Map<string, CourseIndex>();

export function courseIndex(course: string): CourseIndex | null {
  const hit = cache.get(course);
  if (hit) return hit;
  const g = generated[course];
  if (!g) return null;
  const idx: CourseIndex = {
    manifest: g.manifest,
    learnSections: new Map(),
    sections: new Map(),
    labSteps: new Map(),
    drills: new Set(),
    cards: new Map(),
    pages: new Set(),
  };
  for (const page of g.manifest.pages) {
    if (page.status !== "published") continue;
    idx.pages.add(page.key);
    idx.learnSections.set(
      page.key,
      new Set(page.sections.filter((s) => isLearnSection(s.type)).map((s) => s.key)),
    );
    idx.sections.set(page.key, new Set(page.sections.map((s) => s.key)));
    const labs = new Map<string, Set<string>>();
    for (const s of page.sections)
      if (s.type === "lab") labs.set(s.key, new Set((s.steps ?? []).map((st) => st.key)));
    idx.labSteps.set(page.key, labs);
    if (page.sections.some((s) => s.type === "drill")) idx.drills.add(page.key);
    for (const c of page.cards) idx.cards.set(c, page.key);
  }
  cache.set(course, idx);
  return idx;
}

export function cardText(course: string, cardKey: string): string | undefined {
  return generated[course]?.cards.find((c) => c.key === cardKey)?.text;
}
