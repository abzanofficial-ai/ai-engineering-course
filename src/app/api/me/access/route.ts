import { requireContext } from "@/server/context";
import { myAccess } from "@/server/repo/commerce";
import { errorResponse, HttpError } from "@/server/session";

/** GET /api/me/access?course=… — how the learner has access to a course, and until when. */
export async function GET(req: Request) {
  try {
    const { ctx } = await requireContext(req, "own:progress");
    const course = new URL(req.url).searchParams.get("course") ?? "";
    if (!course) throw new HttpError(400, "Name a course.");
    return Response.json(await myAccess(ctx, course), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
