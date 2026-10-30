import { describe, expect, it } from "vitest";
import { addDays, isDay, weekStart } from "./dates";
import { clampGoal, streakFrom, weekFrom } from "./engagement";
import { nextReview } from "./srs";

const T = "2026-10-29"; // a Thursday
const run = (end: string, n: number) => Array.from({ length: n }, (_, i) => addDays(end, -i));

describe("dates", () => {
  it("adds days across months and finds Monday", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(weekStart(T)).toBe("2026-10-26");
    expect(weekStart("2026-10-26")).toBe("2026-10-26");
    expect(weekStart("2026-11-01")).toBe("2026-10-26"); // Sunday belongs to the week before
    expect(isDay("2026-02-30")).toBe(true); // JS rolls over; server clamps against UTC anyway
    expect(isDay("29/10/2026")).toBe(false);
  });
});

describe("streakFrom", () => {
  it("is zero with no activity", () => {
    expect(streakFrom(new Set(), T)).toEqual({ streak: 0, activeToday: false, freezesLeft: 0 });
  });
  it("counts consecutive days including today", () => {
    expect(streakFrom(new Set(run(T, 3)), T)).toMatchObject({ streak: 3, activeToday: true });
  });
  it("keeps yesterday's streak alive until today ends", () => {
    expect(streakFrom(new Set(run(addDays(T, -1), 4)), T)).toMatchObject({
      streak: 4,
      activeToday: false,
    });
  });
  it("breaks on a missed day when no freeze has been earned", () => {
    const days = new Set([...run(T, 2), ...run(addDays(T, -3), 3)]);
    expect(streakFrom(days, T).streak).toBe(2);
  });
  it("uses an earned freeze to bridge a single missed day", () => {
    // 8 days ending today, one missed day, then 5 more: the 8-day run has earned a freeze.
    const days = new Set([...run(T, 8), ...run(addDays(T, -9), 5)]);
    const s = streakFrom(days, T);
    expect(s.streak).toBe(13);
    expect(s.freezesLeft).toBe(0);
  });
  it("does not bridge two missed days", () => {
    const days = new Set([...run(T, 8), ...run(addDays(T, -10), 5)]);
    expect(streakFrom(days, T).streak).toBe(8);
  });
});

describe("weekFrom and goals", () => {
  it("lists Monday to Sunday with active days", () => {
    const w = weekFrom(new Set(["2026-10-26", T, "2026-10-20"]), T, 3);
    expect(w.days.map((d) => d.day)[0]).toBe("2026-10-26");
    expect(w.days).toHaveLength(7);
    expect(w.active).toBe(2);
  });
  it("clamps the goal to 1–7", () => {
    expect([0, 3, 9, 2.6].map(clampGoal)).toEqual([1, 3, 7, 3]);
  });
});

describe("nextReview (Leitner)", () => {
  const now = new Date("2026-10-29T12:00:00Z");
  it("sends unsure cards back to box 1, due tomorrow", () => {
    const r = nextReview(4, "unsure", now);
    expect(r.box).toBe(1);
    expect(r.dueAt.toISOString()).toBe("2026-10-30T12:00:00.000Z");
  });
  it("moves confident cards up a box, capped at 5 (30 days)", () => {
    expect(nextReview(null, "confident", now).box).toBe(1);
    expect(nextReview(2, "confident", now).box).toBe(3);
    const top = nextReview(5, "confident", now);
    expect(top.box).toBe(5);
    expect(top.dueAt.toISOString()).toBe("2026-11-28T12:00:00.000Z");
  });
});
