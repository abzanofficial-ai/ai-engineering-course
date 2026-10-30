import { z } from "zod";
import { requireContext } from "@/server/context";
import { allow } from "@/server/rate-limit";
import { redeemJoinCode } from "@/server/repo/commerce";
import { errorResponse, HttpError, requireSameOriginJson } from "@/server/session";

const schema = z.object({ code: z.string().min(1).max(40) });
const MESSAGES = {
  invalid: "That code isn't valid. Check it with your training centre.",
  expired: "That code has expired. Ask your training centre for a new one.",
  full: "All places on that code have been taken. Ask your training centre for more.",
} as const;

/** POST /api/me/join — redeem a training centre's join code (ADR-0030). */
export async function POST(req: Request) {
  try {
    requireSameOriginJson(req);
    const { ctx } = await requireContext(req, "own:progress");
    // Codes have ~59 bits, and attempts are limited per learner, so guessing is hopeless.
    if (!(await allow(`join:${ctx.tenantId}:${ctx.userId}`, 10, 3600)))
      throw new HttpError(429, "Too many attempts. Try again in an hour.");
    const { code } = schema.parse(await req.json());
    const r = await redeemJoinCode(ctx, code);
    if (!r.ok) throw new HttpError(400, MESSAGES[r.error]);
    return Response.json(r, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
