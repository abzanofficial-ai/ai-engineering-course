import { isDay } from "@/lib/dates";
import { requireContext } from "@/server/context";
import { courseIndex } from "@/server/course-index";
import { clampDay } from "@/server/repo/progress";
import { loadState } from "@/server/repo/state";
import { errorResponse, HttpError } from "@/server/session";

export const dynamic = "force-dynamic";

/** GET /api/me/state?course=…&day=YYYY-MM-DD — the signed-in learner's state for a course. */
export async function GET(req: Request) {
  try {
    const { ctx, user } = await requireContext(req, "own:progress");
    const url = new URL(req.url);
    const course = url.searchParams.get("course") ?? "";
    if (!courseIndex(course)) throw new HttpError(404, "Unknown course.");
    const dayParam = url.searchParams.get("day") ?? "";
    const day = clampDay(isDay(dayParam) ? dayParam : new Date().toISOString().slice(0, 10));
    const state = await loadState(ctx, course, day);
    return Response.json(
      { user: { name: user.name, email: user.email, platformRole: user.platformRole }, state },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
