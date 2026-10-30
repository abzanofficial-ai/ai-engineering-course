import { isDay } from "@/lib/dates";
import { db } from "@/server/db/client";
import { courseIndex } from "@/server/course-index";
import { clampDay } from "@/server/ops";
import { errorResponse, HttpError, requireUser } from "@/server/session";
import { loadState } from "@/server/state";

export const dynamic = "force-dynamic";

/** GET /api/me/state?course=…&day=YYYY-MM-DD — the signed-in learner's state for a course. */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const url = new URL(req.url);
    const course = url.searchParams.get("course") ?? "";
    if (!courseIndex(course)) throw new HttpError(404, "Unknown course.");
    const dayParam = url.searchParams.get("day") ?? "";
    const day = clampDay(isDay(dayParam) ? dayParam : new Date().toISOString().slice(0, 10));
    const state = await loadState(db(), user.id, course, day);
    return Response.json(
      { user: { name: user.name, email: user.email, role: user.role }, state },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
