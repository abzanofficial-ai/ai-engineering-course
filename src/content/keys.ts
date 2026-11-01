import { createHash } from "node:crypto";

/** URL-safe slug: lower-case ASCII words joined by hyphens. */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function hash(text: string, length = 12): string {
  return createHash("sha256").update(text).digest("hex").slice(0, length);
}

export function chapterKey(n: number): string {
  return `ch-${n}`;
}

export function appendixKey(letter: string): string {
  return `appendix-${letter.toLowerCase()}`;
}

export function startKey(title: string): string {
  return `start-${slugify(title)}`;
}

export function stepKey(label: string): string {
  return `step-${label.toLowerCase()}`;
}

/**
 * Card keys hash the normalised question so reordering questions keeps keys stable;
 * editing a question's wording deliberately creates a new card.
 */
export function cardKey(pageKey: string, question: string): string {
  const normalised = question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return `${pageKey}:q-${hash(normalised, 8)}`;
}
