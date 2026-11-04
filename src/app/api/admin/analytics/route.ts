// GET /api/admin/analytics?tenant=…&days=7|30|90&course=… — aggregate analytics (ADR-0032).
// Needs platform:analytics:read. Counts only; no learner is identified.
import { z } from "zod";
import { listCourses } from "@/lib/content";
import { requireContext } from "@/server/context";
import { analyticsOverview } from "@/server/repo/analytics";
import { listTenants } from "@/server/repo/tenant";
import { errorResponse, HttpError } from "@/server/session";

const query = z.object({
  days: z.enum(["7", "30", "90"]).default("30"),
  course: z.string().optional(),
  tenant: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    await requireContext(req, "platform:analytics:read");
    const q = query.parse(Object.fromEntries(new URL(req.url).searchParams));
    const tenants = await listTenants();
    const tenantId = q.tenant ?? tenants[0]!.id;
    if (!tenants.some((t) => t.id === tenantId)) throw new HttpError(400, "Unknown tenant.");
    const courses = listCourses().map((c) => c.slug);
    const course = q.course ?? courses[0]!;
    if (!courses.includes(course)) throw new HttpError(400, "Unknown course.");
    // Whole UTC days: today is included, and the range starts `days` days back.
    const to = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    to.setUTCDate(to.getUTCDate() + 1);
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - Number(q.days));
    return Response.json(
      {
        tenants,
        tenantId,
        courses,
        days: Number(q.days),
        ...(await analyticsOverview(tenantId, course, from, to)),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
