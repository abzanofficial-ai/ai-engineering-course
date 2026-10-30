import { db } from "@/server/db/client";
import { applyOps, batchSchema } from "@/server/ops";
import { allow } from "@/server/rate-limit";
import { errorResponse, HttpError, requireSameOriginJson, requireUser } from "@/server/session";
import { loadState } from "@/server/state";

/** POST /api/me/ops — a batch of learner actions from the client outbox (idempotent). */
export async function POST(req: Request) {
  try {
    requireSameOriginJson(req);
    const user = await requireUser(req);
    if (!(await allow(db(), `ops:${user.id}`, 120, 60)))
      throw new HttpError(429, "Too many requests. Slow down a little.");
    const batch = batchSchema.parse(await req.json());
    const results = await applyOps(db(), user.id, batch);
    const state = await loadState(db(), user.id, batch.course, batch.day);
    return Response.json({ results, state }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
