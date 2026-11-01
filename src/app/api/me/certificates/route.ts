import { z } from "zod";
import { parseScope } from "@/lib/certificates";
import { requireContext } from "@/server/context";
import { allow } from "@/server/rate-limit";
import { claimCertificate, listCertificates } from "@/server/repo/certificate";
import { errorResponse, HttpError, requireSameOriginJson } from "@/server/session";

const NO_STORE = { "Cache-Control": "private, no-store" };
const claimSchema = z.object({ course: z.string().min(1).max(200), scope: z.string().max(20) });
const MESSAGES = {
  "unknown course": "That course isn't available.",
  "name required": "Add your name on the Account page first. It appears on the certificate.",
  "not eligible": "Not yet: finish every chapter in this part and pass its checkpoint.",
} as const;

/** GET /api/me/certificates — the learner's certificates (ADR-0029). */
export async function GET(req: Request) {
  try {
    const { ctx } = await requireContext(req, "own:progress");
    return Response.json({ certificates: await listCertificates(ctx) }, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST /api/me/certificates — claim a certificate; the server re-checks eligibility. */
export async function POST(req: Request) {
  try {
    requireSameOriginJson(req);
    const { ctx } = await requireContext(req, "own:progress");
    if (!(await allow(`certificate:${ctx.tenantId}:${ctx.userId}`, 30, 3600)))
      throw new HttpError(429, "Too many requests. Try again later.");
    const input = claimSchema.parse(await req.json());
    const scope = parseScope(input.scope);
    if (!scope) throw new HttpError(400, "Unknown certificate.");
    const result = await claimCertificate(ctx, input.course, scope);
    if (!result.ok)
      throw new HttpError(result.error === "not eligible" ? 403 : 400, MESSAGES[result.error]);
    return Response.json(
      { certificate: result.certificate, created: result.created },
      { status: result.created ? 201 : 200, headers: NO_STORE },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
