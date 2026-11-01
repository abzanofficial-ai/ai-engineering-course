// XP, streaks and weekly goals (ADR-0019). Pure functions shared by server and client.
import { addDays, weekStart } from "./dates";

export const XP = {
  sectionRead: 5,
  labStep: 10,
  labCommitted: 50,
  drillAnswered: 30,
  cardRated: 5,
  checkpointPassed: 200,
} as const;

/** Minimum characters for a drill answer to count (and earn XP). */
export const DRILL_MIN_CHARS = 20;

export interface StreakInfo {
  streak: number;
  activeToday: boolean;
  freezesLeft: number;
}

/**
 * Consecutive active days ending today (or yesterday, if today has no activity yet).
 * One streak freeze is earned per 7 days of streak (max 2) and silently covers a single
 * missed day.
 */
export function streakFrom(days: ReadonlySet<string>, today: string): StreakInfo {
  const activeToday = days.has(today);
  let cursor = activeToday ? today : addDays(today, -1);
  let run = 0;
  let used = 0;
  for (;;) {
    if (days.has(cursor)) {
      run++;
      cursor = addDays(cursor, -1);
      continue;
    }
    const earned = Math.min(2, Math.floor(run / 7));
    if (run > 0 && used < earned && days.has(addDays(cursor, -1))) {
      used++;
      cursor = addDays(cursor, -1);
      continue;
    }
    break;
  }
  return {
    streak: run,
    activeToday,
    freezesLeft: Math.max(0, Math.min(2, Math.floor(run / 7)) - used),
  };
}

export interface WeekInfo {
  /** Monday to Sunday; `xp` is points earned that day (UTC date of the event). */
  days: { day: string; active: boolean; xp: number }[];
  active: number;
  goal: number;
}

export function weekFrom(
  days: ReadonlySet<string>,
  today: string,
  goal: number,
  xpByDay: ReadonlyMap<string, number> = new Map(),
): WeekInfo {
  const start = weekStart(today);
  const list = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i);
    return { day, active: days.has(day), xp: xpByDay.get(day) ?? 0 };
  });
  return { days: list, active: list.filter((d) => d.active).length, goal };
}

export function clampGoal(goal: number): number {
  return Math.min(7, Math.max(1, Math.round(goal)));
}
