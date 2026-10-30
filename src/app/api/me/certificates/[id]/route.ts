import { requireContext } from "@/server/context";
import { deleteCertificate } from "@/server/repo/certificate";
import { errorResponse, HttpError, requireSameOriginJson } from "@/server/session";

/** DELETE /api/me/certificates/:id — remove one of your own certificates (its link stops working). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOriginJson(req);
    const { ctx } = await requireContext(req, "own:progress");
    const { id } = await params;
    if (!(await deleteCertificate(ctx, id))) throw new HttpError(404, "Not found.");
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
