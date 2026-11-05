// A visitor's progress on the public pages (bug fix, 2026-11-05): kept on their device until
// they sign in, then moved into their account, where the server validates and scores it.
import type { Op } from "./ops-schema";

/**
 * What a visitor's progress on the public pages may hold, kept on this device until they sign
 * in and then moved into their account (the server validates and scores it as usual).
 */
export const GUEST_TYPES = new Set<Op["type"]>([
  "section_read",
  "step",
  "commit",
  "drill",
  "position",
]);
/** Ticks and answers show the "save your progress" prompt (once per page view); reading doesn't. */
export const GUEST_PROMPT_TYPES = new Set<Op["type"]>(["step", "commit", "drill"]);
export const GUEST_MAX_OPS = 500;

/** Adds an action to a queue; only the latest position is kept, and the queue is capped. */
export function enqueue(queue: Op[], op: Op, max = Infinity): Op[] {
  const rest = op.type === "position" ? queue.filter((o) => o.type !== "position") : queue;
  const next = [...rest, op];
  return next.length > max ? next.slice(next.length - max) : next;
}
