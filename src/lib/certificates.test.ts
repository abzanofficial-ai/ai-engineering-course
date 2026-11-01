import { describe, expect, it } from "vitest";
import { generated } from "@generated/index";
import { eligibility, isEligible, parseScope, scopeLabel } from "./certificates";
import { emptyState, specOf, type LearnerState } from "./learner-state";

const m = generated["ai-engineering-handbook"]!.manifest;

/** A learner who finished every published chapter of a part (synthetic state, no real data). */
function finished(part: number, passed: boolean): LearnerState {
  const s = emptyState();
  for (const p of m.pages.filter((x) => x.partNumber === part && x.status === "published")) {
    const spec = specOf(p);
    s.read[p.key] = spec.learn;
    s.steps[p.key] = Object.fromEntries(spec.labs.map((l) => [l.key, l.steps]));
    s.commits[p.key] = spec.labs.map((l) => l.key);
    if (spec.drill) s.drills[p.key] = { answer: "A considered answer.", revealed: true };
    for (const c of spec.cards) s.cards[c] = "confident";
  }
  if (passed) s.checkpoints[String(part)] = { attempts: 1, best: 90, passed: true };
  return s;
}

describe("certificate eligibility", () => {
  it("needs every chapter in the part complete and the checkpoint passed", () => {
    const none = eligibility(m, emptyState());
    expect(none.parts[0]).toMatchObject({ part: 1, done: 0, eligible: false });
    expect(none.parts.map((p) => p.part)).not.toContain(0); // Start here has no certificate

    const noCheckpoint = eligibility(m, finished(1, false));
    expect(noCheckpoint.parts[0]).toMatchObject({ checkpointPassed: false, eligible: false });
    expect(noCheckpoint.parts[0]!.done).toBe(noCheckpoint.parts[0]!.total);

    const ok = eligibility(m, finished(1, true));
    expect(isEligible(ok, "part:1")).toBe(true);
    expect(isEligible(ok, "part:2")).toBe(false);
  });

  it("never offers the course certificate while chapters are still coming soon", () => {
    const e = eligibility(m, finished(1, true));
    expect(e.comingSoon).toBeGreaterThan(0);
    expect(isEligible(e, "course")).toBe(false);
  });

  it("parses scopes strictly and labels them", () => {
    expect(["course", "part:3", "part:0", "part:x", "part:03", "Course"].map(parseScope)).toEqual([
      "course",
      "part:3",
      null,
      null,
      null,
      null,
    ]);
    expect(scopeLabel(m, "part:1")).toBe("Part 1: Programming Foundation");
    expect(scopeLabel(m, "course")).toBe("the whole course");
  });
});
