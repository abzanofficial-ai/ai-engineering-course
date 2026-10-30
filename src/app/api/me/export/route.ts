import { requireContext } from "@/server/context";
import { exportUserData } from "@/server/repo/account";
import { errorResponse } from "@/server/session";

export const dynamic = "force-dynamic";

/** GET /api/me/export — everything we hold about the signed-in learner, as JSON. */
export async function GET(req: Request) {
  try {
    const { ctx } = await requireContext(req, "own:account");
    const data = await exportUserData(ctx);
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
