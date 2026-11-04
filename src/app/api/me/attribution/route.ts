// POST /api/me/attribution — where a new learner came from (ADR-0032). Sent once by the app
// after the sign-in link brings them back with the source on the URL. Ignored after the first
// day of membership, and never overwritten.
import { sourceSchema } from "@/lib/attribution";
import { requireContext } from "@/server/context";
import { recordSignupSource } from "@/server/repo/analytics";
import { errorResponse, requireSameOriginJson } from "@/server/session";

export async function POST(req: Request) {
  try {
    requireSameOriginJson(req);
    const { ctx } = await requireContext(req, "own:progress");
    const recorded = await recordSignupSource(ctx, sourceSchema.parse(await req.json()));
    return Response.json({ recorded }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
