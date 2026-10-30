// The learner actions the client sends (ADR-0009). Shared by the browser outbox and the API.
import { z } from "zod";
import { isDay } from "./dates";

const key = z.string().min(1).max(200);
const ts = z.number().int().nonnegative();
export const NOTE_MAX = 5_000;
export const MODES = ["learn", "practise", "decide", "review"] as const;
export type Mode = (typeof MODES)[number];

export const opSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("section_read"), page: key, section: key, ts }),
  z.object({ type: z.literal("step"), page: key, lab: key, step: key, done: z.boolean(), ts }),
  z.object({ type: z.literal("commit"), page: key, lab: key, done: z.boolean(), ts }),
  z.object({
    type: z.literal("drill"),
    page: key,
    answer: z.string().max(10_000),
    revealed: z.boolean(),
    ts,
  }),
  z.object({ type: z.literal("card"), card: key, rating: z.enum(["confident", "unsure"]), ts }),
  z.object({
    type: z.literal("position"),
    page: key,
    mode: z.enum(MODES),
    index: z.number().int().min(0).max(500),
    ts,
  }),
  z.object({ type: z.literal("goal"), weeklyGoal: z.number().int(), ts }),
  z.object({ type: z.literal("bookmark"), page: key, section: key, on: z.boolean(), ts }),
  z.object({
    type: z.literal("note_save"),
    id: z.uuid(),
    page: key,
    section: key,
    body: z.string().trim().min(1).max(NOTE_MAX),
    ts,
  }),
  z.object({ type: z.literal("note_delete"), id: z.uuid(), ts }),
]);

export const batchSchema = z.object({
  course: key,
  /** The learner's local calendar date, for streaks. */
  day: z.string().refine(isDay, "day must be YYYY-MM-DD"),
  ops: z.array(opSchema).min(1).max(100),
});

export type Op = z.infer<typeof opSchema>;
export type Batch = z.infer<typeof batchSchema>;
export type OpResult = { ok: true; xp?: number } | { ok: false; error: string };

/** An action before the client stamps its time (distributive, so each variant keeps its fields). */
export type OpInput = Op extends infer T ? (T extends Op ? Omit<T, "ts"> : never) : never;
