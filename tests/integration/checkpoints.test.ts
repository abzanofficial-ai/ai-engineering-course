import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as checkpoints from "@/app/api/me/checkpoints/route";
import * as stateRoute from "@/app/api/me/state/route";
import { generated } from "@generated/index";
import { partContent, seedFor, selectQuestions } from "@/lib/checkpoint";
import { db } from "@/server/db/client";
import { req, signIn } from "./auth-helpers";
import { COURSE, TODAY } from "./helpers";

const manifest = generated[COURSE]!.manifest;
const ANSWER = "I would ask whether it runs once or every week, then batch it overnight.";
const setFor = (attempt: number) =>
  selectQuestions(partContent(manifest, 1).cards, seedFor(1, attempt));
const ratings = (keys: string[], unsure: number) =>
  Object.fromEntries(keys.map((k, i) => [k, i < unsure ? "unsure" : "confident"]));
const submit = (cookie: string, body: unknown) =>
  checkpoints.POST(req("/api/me/checkpoints", cookie, { method: "POST", json: body }));
const state = async (cookie: string) =>
  (await (await stateRoute.GET(req(`/api/me/state?course=${COURSE}&day=${TODAY}`, cookie))).json())
    .state;

describe("part checkpoints", () => {
  it("passing awards 200 XP once; unsure answers join review", async () => {
    const a = await signIn("checkpoint@example.test");
    const first = setFor(1);
    const res = await submit(a, {
      course: COURSE,
      part: 1,
      day: TODAY,
      ratings: ratings(first, 1),
      answer: ANSWER,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result).toEqual({ ok: true, attempt: 1, score: 90, passed: true, xp: 200 });
    expect(body.state.checkpoints["1"]).toEqual({ attempts: 1, best: 90, passed: true });
    expect(body.state.cards[first[0]!]).toBe("unsure");

    const again = await (
      await submit(a, {
        course: COURSE,
        part: 1,
        day: TODAY,
        ratings: ratings(setFor(2), 0),
        answer: ANSWER,
      })
    ).json();
    expect(again.result).toMatchObject({ attempt: 2, score: 100, passed: true, xp: 0 });
  });

  it("rejects a question set that isn't the one drawn for this attempt", async () => {
    const a = await signIn("cheat@example.test");
    const wrong = partContent(manifest, 1).cards.slice(0, 10);
    const res = await submit(a, {
      course: COURSE,
      part: 1,
      day: TODAY,
      ratings: ratings(wrong, 0),
      answer: ANSWER,
    });
    expect(setFor(1)).not.toEqual(wrong);
    expect(res.status).toBe(400);
    expect((await state(a)).checkpoints).toEqual({});
  });

  it("records a fail with the best score, and a short drill answer fails", async () => {
    const a = await signIn("fail@example.test");
    const r1 = await (
      await submit(a, {
        course: COURSE,
        part: 1,
        day: TODAY,
        ratings: ratings(setFor(1), 3),
        answer: ANSWER,
      })
    ).json();
    expect(r1.result).toMatchObject({ score: 70, passed: false, xp: 0 });
    const r2 = await (
      await submit(a, {
        course: COURSE,
        part: 1,
        day: TODAY,
        ratings: ratings(setFor(2), 0),
        answer: "short",
      })
    ).json();
    expect(r2.result).toMatchObject({ score: 100, passed: false });
    expect((await state(a)).checkpoints["1"]).toEqual({ attempts: 2, best: 100, passed: false });
  });

  it("refuses parts with no published chapters", async () => {
    const a = await signIn("soon@example.test");
    expect(
      (await submit(a, { course: COURSE, part: 11, day: TODAY, ratings: {}, answer: ANSWER }))
        .status,
    ).toBe(400);
  });

  it("lists cards in the review queue once they are due, and another learner sees none of it", async () => {
    const a = await signIn("due@example.test");
    const b = await signIn("due-other@example.test");
    await submit(a, {
      course: COURSE,
      part: 1,
      day: TODAY,
      ratings: ratings(setFor(1), 2),
      answer: ANSWER,
    });
    expect((await state(a)).due).toEqual([]); // due tomorrow
    await db().execute(sql`update card_review set due_at = now() - interval '1 hour'`);
    expect((await state(a)).due.sort()).toEqual(setFor(1).slice(0, 2).sort());
    const bs = await state(b);
    expect(bs.due).toEqual([]);
    expect(bs.checkpoints).toEqual({});
  });

  it("refuses requests without a session", async () => {
    expect(
      (await submit("", { course: COURSE, part: 1, day: TODAY, ratings: {}, answer: "" })).status,
    ).toBe(401);
  });
});
