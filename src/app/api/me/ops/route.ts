import { requireContext } from "@/server/context";
import { allow } from "@/server/rate-limit";
import { applyOps, batchSchema } from "@/server/repo/progress";
import { loadState } from "@/server/repo/state";
import { errorResponse, HttpError, requireSameOriginJson } from "@/server/session";

/** POST /api/me/ops — a batch of learner actions from the client outbox (idempotent). */
export async function POST(req: Request) {
  try {
    requireSameOriginJson(req);
    const { ctx } = await requireContext(req, "own:progress");
    if (!(await allow(`ops:${ctx.tenantId}:${ctx.userId}`, 120, 60)))
      throw new HttpError(429, "Too many requests. Slow down a little.");
    const batch = batchSchema.parse(await req.json());
    const results = await applyOps(ctx, batch);
    const state = await loadState(ctx, batch.course, batch.day);
    return Response.json({ results, state }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
