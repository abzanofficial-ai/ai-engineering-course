// The learner's state for one course as the client sees it, the progress maths (ADR-0019),
// and the optimistic reducer the client applies before the server confirms.
import type { PageMeta, SectionType } from "@/content/types";
import type { Op } from "./ops-schema";

export interface LearnerState {
  read: Record<string, string[]>; // pageKey → section keys
  steps: Record<string, Record<string, string[]>>; // pageKey → labKey → done step keys
  commits: Record<string, string[]>; // pageKey → committed lab keys
  drills: Record<string, { answer: string; revealed: boolean }>;
  cards: Record<string, "confident" | "unsure">; // cardKey → rating
  last: { pageKey: string; mode: string; sectionIndex: number } | null;
  xp: { total: number; week: number; recent: { label: string; points: number; at: string }[] };
  streak: { streak: number; activeToday: boolean; freezesLeft: number };
  week: { days: { day: string; active: boolean; xp: number }[]; active: number; goal: number };
  /** Part number → checkpoint results (ADR-0021). */
  checkpoints: Record<string, { attempts: number; best: number; passed: boolean }>;
  /** Card keys due for spaced-repetition review now (ADR-0016). */
  due: string[];
  bookmarks: Record<string, string[]>; // pageKey → bookmarked section keys
  /** The learner's own notes, newest first (ADR-0027). Shown as text, never as HTML. */
  notes: Note[];
}

export interface Note {
  id: string;
  page: string;
  section: string;
  body: string;
  ts: number;
}

export const emptyState = (): LearnerState => ({
  read: {},
  steps: {},
  commits: {},
  drills: {},
  cards: {},
  last: null,
  xp: { total: 0, week: 0, recent: [] },
  streak: { streak: 0, activeToday: false, freezesLeft: 0 },
  week: { days: [], active: 0, goal: 3 },
  checkpoints: {},
  due: [],
  bookmarks: {},
  notes: [],
});

const PRACTICE_TYPES: SectionType[] = ["lab", "stuck", "drill", "interview"];
export const isLearnSection = (type: SectionType) => !PRACTICE_TYPES.includes(type);

/** What a page contributes to progress — small enough to ship to the browser for every page. */
export interface PageSpec {
  key: string;
  learn: string[];
  labs: { key: string; steps: string[] }[];
  drill: boolean;
  cards: string[];
}

export function specOf(page: PageMeta): PageSpec {
  return {
    key: page.key,
    learn: page.sections.filter((s) => isLearnSection(s.type)).map((s) => s.key),
    labs: page.sections
      .filter((s) => s.type === "lab")
      .map((s) => ({ key: s.key, steps: (s.steps ?? []).map((st) => st.key) })),
    drill: page.sections.some((s) => s.type === "drill"),
    cards: page.cards,
  };
}

export interface PageCounts {
  learn: [number, number];
  steps: [number, number];
  drill: boolean | null;
  cards: [number, number];
}

export function pageCounts(spec: PageSpec, s: LearnerState): PageCounts {
  const read = new Set(s.read[spec.key] ?? []);
  let done = 0;
  let total = 0;
  for (const lab of spec.labs) {
    const ticked = new Set(s.steps[spec.key]?.[lab.key] ?? []);
    total += lab.steps.length;
    done += lab.steps.filter((k) => ticked.has(k)).length;
  }
  return {
    learn: [spec.learn.filter((k) => read.has(k)).length, spec.learn.length],
    steps: [done, total],
    drill: spec.drill ? Boolean(s.drills[spec.key]?.revealed) : null,
    cards: [spec.cards.filter((c) => s.cards[c]).length, spec.cards.length],
  };
}

/** Chapter %: the average of its components (Learn read, lab steps + commit, drill, cards). */
export function pageProgress(spec: PageSpec, s: LearnerState): number {
  const parts: number[] = [];
  const c = pageCounts(spec, s);
  if (c.learn[1]) parts.push(c.learn[0] / c.learn[1]);
  if (spec.labs.length) {
    const commits = spec.labs.filter((l) => (s.commits[spec.key] ?? []).includes(l.key)).length;
    parts.push((c.steps[0] + commits) / (c.steps[1] + spec.labs.length));
  }
  if (c.drill !== null) parts.push(c.drill ? 1 : 0);
  if (c.cards[1]) parts.push(c.cards[0] / c.cards[1]);
  if (!parts.length) return 0;
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
}

export function averageProgress(specs: PageSpec[], s: LearnerState): number | null {
  if (!specs.length) return null;
  return Math.round(specs.reduce((n, p) => n + pageProgress(p, s), 0) / specs.length);
}

/** Course %: the average of its parts, so a long part does not swamp a short one. */
export function courseProgress(parts: PageSpec[][], s: LearnerState): number {
  const vals = parts.map((p) => averageProgress(p, s)).filter((v): v is number => v !== null);
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
}

const uniq = (xs: string[]) => [...new Set(xs)];

/** Applies an action locally (optimistic UI). The server's response replaces it later. */
export function applyLocal(state: LearnerState, op: Op): LearnerState {
  const s: LearnerState = structuredClone(state);
  switch (op.type) {
    case "section_read":
      s.read[op.page] = uniq([...(s.read[op.page] ?? []), op.section]);
      break;
    case "step": {
      const labs = (s.steps[op.page] ??= {});
      const cur = labs[op.lab] ?? [];
      labs[op.lab] = op.done ? uniq([...cur, op.step]) : cur.filter((k) => k !== op.step);
      break;
    }
    case "commit": {
      const cur = s.commits[op.page] ?? [];
      s.commits[op.page] = op.done ? uniq([...cur, op.lab]) : cur.filter((k) => k !== op.lab);
      break;
    }
    case "drill":
      s.drills[op.page] = { answer: op.answer, revealed: op.revealed };
      break;
    case "card":
      s.cards[op.card] = op.rating;
      s.due = s.due.filter((k) => k !== op.card); // rated now, so not due until its next interval
      break;
    case "position":
      s.last = { pageKey: op.page, mode: op.mode, sectionIndex: op.index };
      break;
    case "goal":
      s.week = { ...s.week, goal: Math.min(7, Math.max(1, op.weeklyGoal)) };
      break;
    case "bookmark": {
      const cur = s.bookmarks[op.page] ?? [];
      s.bookmarks[op.page] = op.on
        ? uniq([...cur, op.section])
        : cur.filter((k) => k !== op.section);
      break;
    }
    case "note_save": {
      const note: Note = {
        id: op.id,
        page: op.page,
        section: op.section,
        body: op.body.trim(),
        ts: op.ts,
      };
      s.notes = [note, ...s.notes.filter((n) => n.id !== op.id)];
      break;
    }
    case "note_delete":
      s.notes = s.notes.filter((n) => n.id !== op.id);
      break;
  }
  return s;
}
