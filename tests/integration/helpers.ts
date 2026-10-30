import { randomUUID } from "node:crypto";
import { db } from "@/server/db/client";
import { user } from "@/server/db/schema";

/** Synthetic learners only — never real data (test-strategy §7). */
export async function makeUser(name = "learner"): Promise<string> {
  const id = randomUUID();
  await db()
    .insert(user)
    .values({ id, name, email: `${name}-${id.slice(0, 8)}@example.test`, emailVerified: true });
  return id;
}

export const COURSE = "ai-engineering-handbook";
export const TODAY = new Date().toISOString().slice(0, 10);
