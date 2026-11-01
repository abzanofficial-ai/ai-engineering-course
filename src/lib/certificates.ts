// Who may claim which certificate (ADR-0029). Pure, so the browser shows progress towards a
// certificate and the server re-checks the same rules against the database before issuing.
import type { CourseManifest } from "@/content/types";
import { pageProgress, specOf, type LearnerState, type PageSpec } from "./learner-state";

export type Scope = `part:${number}` | "course";

export interface PartStatus {
  part: number;
  title: string;
  /** Published chapters in the part that are 100% complete, of all published ones. */
  done: number;
  total: number;
  checkpointPassed: boolean;
  eligible: boolean;
}

export interface Eligibility {
  parts: PartStatus[];
  /** Chapters still "coming soon" anywhere in the course (block the course certificate). */
  comingSoon: number;
  courseEligible: boolean;
}

/** What a part's certificate depends on: its published pages' progress specs. */
export interface PartSpec {
  part: number;
  title: string;
  pages: PageSpec[];
}

export function certificateParts(m: CourseManifest): { parts: PartSpec[]; comingSoon: number } {
  const parts: PartSpec[] = [];
  for (const part of m.parts) {
    if (part.number < 1) continue; // "Start here" has no checkpoint or certificate
    const pages = m.pages
      .filter((p) => p.partNumber === part.number && p.status === "published")
      .map((p) => specOf(p));
    if (pages.length) parts.push({ part: part.number, title: part.title, pages });
  }
  return { parts, comingSoon: m.pages.filter((p) => p.status === "coming-soon").length };
}

export function eligibilityFrom(
  specs: { parts: PartSpec[]; comingSoon: number },
  s: LearnerState,
): Eligibility {
  const parts = specs.parts.map(({ part, title, pages }) => {
    const done = pages.filter((p) => pageProgress(p, s) === 100).length;
    const checkpointPassed = Boolean(s.checkpoints[String(part)]?.passed);
    return {
      part,
      title,
      done,
      total: pages.length,
      checkpointPassed,
      eligible: done === pages.length && checkpointPassed,
    };
  });
  return {
    parts,
    comingSoon: specs.comingSoon,
    courseEligible: specs.comingSoon === 0 && parts.length > 0 && parts.every((p) => p.eligible),
  };
}

export function eligibility(m: CourseManifest, s: LearnerState): Eligibility {
  return eligibilityFrom(certificateParts(m), s);
}

export function isEligible(e: Eligibility, scope: Scope): boolean {
  if (scope === "course") return e.courseEligible;
  const n = Number(scope.slice(5));
  return e.parts.some((p) => p.part === n && p.eligible);
}

export function parseScope(value: string): Scope | null {
  if (value === "course") return "course";
  const m = value.match(/^part:([1-9]\d?)$/);
  return m ? (`part:${Number(m[1])}` as Scope) : null;
}

/** "Part 3: Retrieval and RAG" or "the whole course", for certificates and buttons. */
export function scopeLabel(m: CourseManifest, scope: string): string {
  if (scope === "course") return "the whole course";
  const n = Number(scope.slice(5));
  const part = m.parts.find((p) => p.number === n);
  return part ? `Part ${n}: ${part.title}` : `Part ${n}`;
}
