import { exportUserData } from "@/server/account";
import { db } from "@/server/db/client";
import { errorResponse, requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

/** GET /api/me/export — everything we hold about the signed-in learner, as JSON. */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const data = await exportUserData(db(), user.id);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="my-handbook-data.json"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
