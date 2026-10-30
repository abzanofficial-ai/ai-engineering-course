// The typed course model produced by the importer and consumed by the app.
// Everything here is JSON-serialisable and deterministic for a given input.

export type SectionType =
  "jargon" | "interview" | "lab" | "drill" | "stuck" | "judgment" | "further-reading" | "prose";

export type Block =
  | { kind: "html"; html: string }
  | { kind: "lab-step"; key: string; label: string; title: string; anchor: string; html: string }
  | { kind: "lab-troubleshoot"; title: string; html: string }
  | { kind: "lab-commit"; html: string }
  | { kind: "drill-reveal"; html: string }
  | { kind: "prompt"; html: string; text: string }
  | { kind: "card"; key: string; html: string; text: string };

export interface Section {
  key: string;
  type: SectionType;
  title: string;
  blocks: Block[];
}

export interface SectionMeta {
  key: string;
  type: SectionType;
  title: string;
  /** Lab sections only: ordered step keys. */
  steps?: { key: string; label: string; title: string }[];
  /** Lab sections only: estimated minutes from the "Time:" line. */
  labMinutes?: number;
  /** Lab sections only: whether the source has an explicit commit block. */
  hasCommit?: boolean;
  /** Hash of the section's rendered content, for diffs. */
  hash: string;
}

export type PageKind = "start" | "chapter" | "appendix";
export type PageStatus = "published" | "coming-soon";

export interface PageMeta {
  key: string;
  kind: PageKind;
  /** Chapter number; undefined for start pages and appendices. */
  number?: number;
  /** "Chapter 21", "Appendix A", or "" for start pages. */
  label: string;
  title: string;
  /** URL segment; cosmetic — `key` is the identity. */
  slug: string;
  /** 0 = "Start here". */
  partNumber: number;
  status: PageStatus;
  readingMinutes: number;
  labMinutes: number;
  sections: SectionMeta[];
  /** Interview question card keys. */
  cards: string[];
  hash: string;
}

export interface Page extends PageMeta {
  definitionHtml: string | null;
  content: Section[];
}

export interface Part {
  number: number;
  key: string;
  title: string;
  introHtml: string;
  /** "You can now…" from the Index; bold text marks a milestone. Empty if absent. */
  outcomeHtml: string;
  milestone: boolean;
  pages: string[];
}

export interface GlossaryEntry {
  slug: string;
  term: string;
  /** Lower-case forms matched in running text. */
  forms: string[];
  definitions: { pageKey: string; html: string; text: string }[];
}

export interface Card {
  key: string;
  pageKey: string;
  text: string;
  html: string;
}

export interface Diagram {
  hash: string;
  source: string;
  alt: string;
  description: string;
}

export interface SearchRecord {
  url: string;
  pageKey: string;
  sectionKey: string;
  title: string;
  pageTitle: string;
  text: string;
}

export interface CourseManifest {
  slug: string;
  title: string;
  sourceHash: string;
  parts: Part[];
  pages: PageMeta[];
  warnings: string[];
}

export interface CourseBuild {
  manifest: CourseManifest;
  pages: Page[];
  glossary: GlossaryEntry[];
  cards: Card[];
  diagrams: Diagram[];
  search: SearchRecord[];
}

/** Rendered diagram dimensions keyed by diagram hash. */
export type DiagramRenders = Record<string, { width: number; height: number }>;
