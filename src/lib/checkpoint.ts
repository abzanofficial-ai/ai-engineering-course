// Part checkpoints (ADR-0021): up to 10 interview questions from the part plus one decision
// drill. Pass = at least 80% rated confident and the drill answered. Pure, shared by the
// client (to draw the set) and the server (to validate and score it).
import type { CourseManifest } from "@/content/types";
import { DRILL_MIN_CHARS } from "./engagement";

export const CHECKPOINT_QUESTIONS = 10;
export const CHECKPOINT_PASS_MARK = 80;

/** Deterministic PRNG so each attempt gets a fresh but reproducible set. */
function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFor(part: number, attempt: number): number {
  return part * 1000 + attempt;
}

export function selectQuestions<T>(
  items: readonly T[],
  seed: number,
  n = CHECKPOINT_QUESTIONS,
): T[] {
  const rnd = mulberry32(seed);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, n);
}

export function pickDrill<T>(drills: readonly T[], attempt: number): T | undefined {
  return drills.length ? drills[(attempt - 1) % drills.length] : undefined;
}

export interface PartContent {
  /** Card keys in reading order. */
  cards: string[];
  /** Pages with a decision drill, in reading order. */
  drillPages: string[];
}

export function partContent(manifest: CourseManifest, part: number): PartContent {
  const pages = (manifest.parts.find((p) => p.number === part)?.pages ?? [])
    .map((k) => manifest.pages.find((p) => p.key === k))
    .filter((p) => p && p.status === "published");
  return {
    cards: pages.flatMap((p) => p!.cards),
    drillPages: pages.filter((p) => p!.sections.some((s) => s.type === "drill")).map((p) => p!.key),
  };
}

export function scoreCheckpoint(
  ratings: Record<string, "confident" | "unsure">,
  answer: string,
): { score: number; passed: boolean } {
  const values = Object.values(ratings);
  const score = values.length
    ? Math.round((values.filter((r) => r === "confident").length / values.length) * 100)
    : 0;
  return {
    score,
    passed: score >= CHECKPOINT_PASS_MARK && answer.trim().length >= DRILL_MIN_CHARS,
  };
}
