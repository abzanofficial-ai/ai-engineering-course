// Leitner spaced repetition (ADR-0016): unsure → box 1; confident → next box.
export const INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;
export type Rating = "confident" | "unsure";

export function nextReview(
  prevBox: number | null,
  rating: Rating,
  now: Date,
): { box: number; dueAt: Date } {
  const box = rating === "unsure" ? 1 : Math.min(5, (prevBox ?? 0) + 1);
  const dueAt = new Date(now.getTime() + INTERVAL_DAYS[box - 1]! * 86_400_000);
  return { box, dueAt };
}
