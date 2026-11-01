import { requireContext } from "@/server/context";
import { allow } from "@/server/rate-limit";
import { checkpointSchema, submitCheckpoint } from "@/server/repo/checkpoint";
import { loadState } from "@/server/repo/state";
import { errorResponse, HttpError, requireSameOriginJson } from "@/server/session";

/** POST /api/me/checkpoints — submit a part checkpoint attempt (ADR-0021). */
export async function POST(req: Request) {
  try {
    requireSameOriginJson(req);
    const { ctx } = await requireContext(req, "own:progress");
    if (!(await allow(`checkpoint:${ctx.tenantId}:${ctx.userId}`, 20, 3600)))
      throw new HttpError(429, "Too many attempts. Try again later.");
    const input = checkpointSchema.parse(await req.json());
    const result = await submitCheckpoint(ctx, input);
    if (!result.ok) throw new HttpError(400, result.error);
    const state = await loadState(ctx, input.course, input.day);
    return Response.json({ result, state }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
