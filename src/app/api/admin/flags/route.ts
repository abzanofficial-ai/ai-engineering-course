// Feature flags per tenant (ADR-0031). Every call needs platform:flags:manage.
import { z } from "zod";
import { isFlagKey } from "@/lib/flags";
import { requireContext } from "@/server/context";
import { log } from "@/server/log";
import { listFlags, setFlag } from "@/server/repo/flags";
import { listTenants } from "@/server/repo/tenant";
import { errorResponse, HttpError, requireSameOriginJson } from "@/server/session";

const NO_STORE = { "Cache-Control": "private, no-store" };

const bodySchema = z.object({
  tenantId: z.string().min(1).max(100),
  key: z.string().refine(isFlagKey, "unknown flag"),
  /** true or false stores an override; null removes it, so the default applies again. */
  enabled: z.boolean().nullable(),
});

async function tenantExists(tenantId: string) {
  if (!(await listTenants()).some((t) => t.id === tenantId))
    throw new HttpError(400, "Unknown tenant.");
}

/** GET /api/admin/flags?tenant=… — every flag for a tenant, with its default and override. */
export async function GET(req: Request) {
  try {
    await requireContext(req, "platform:flags:manage");
    const tenants = await listTenants();
    const tenantId = new URL(req.url).searchParams.get("tenant") ?? tenants[0]!.id;
    await tenantExists(tenantId);
    return Response.json(
      { tenants, tenantId, flags: await listFlags(tenantId) },
      { headers: NO_STORE },
    );
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST /api/admin/flags — switch one flag for one tenant, or reset it to its default. */
export async function POST(req: Request) {
  try {
    requireSameOriginJson(req);
    const { ctx } = await requireContext(req, "platform:flags:manage");
    const b = bodySchema.parse(await req.json());
    await tenantExists(b.tenantId);
    if (!isFlagKey(b.key)) throw new HttpError(400, "Unknown flag.");
    await setFlag(b.tenantId, b.key, b.enabled, ctx.userId);
    log.info("flags.changed", { tenantId: b.tenantId, key: b.key, enabled: b.enabled });
    return Response.json({ flags: await listFlags(b.tenantId) }, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
