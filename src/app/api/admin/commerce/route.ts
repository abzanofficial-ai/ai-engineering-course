// Platform administration of the commercial model (ADR-0030): seat packs, access grants and
// centre licences. Every call needs platform:entitlements:manage.
import { z } from "zod";
import { listCourses } from "@/lib/content";
import { plans } from "@/lib/plans";
import { requireContext } from "@/server/context";
import {
  createSeatPack,
  grantEntitlement,
  licenceUsage,
  listEntitlements,
  listSeatPacks,
  regenerateSeatCode,
  revokeEntitlement,
  revokeSeatPack,
  setTenantLicence,
  userIdByEmail,
} from "@/server/repo/commerce";
import { listTenants } from "@/server/repo/tenant";
import { errorResponse, HttpError, requireSameOriginJson } from "@/server/session";

const NO_STORE = { "Cache-Control": "private, no-store" };
const id = z.string().min(1).max(100);
const course = z.string().refine((c) => listCourses().some((x) => x.slug === c), "unknown course");
const date = z.iso.date().nullish();
const pence = z.number().int().min(0).max(10_000_000);

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create-pack"),
    tenantId: id,
    course,
    orgName: z.string().trim().min(2).max(120),
    seats: z.number().int().min(1).max(10_000),
    accessMonths: z.number().int().min(1).max(60),
    redeemBy: date,
  }),
  z.object({ action: z.literal("regenerate-pack"), packId: id }),
  z.object({ action: z.literal("revoke-pack"), packId: id }),
  z.object({
    action: z.literal("grant"),
    tenantId: id,
    course,
    email: z.email(),
    endsAt: date,
    note: z.string().max(200).nullish(),
  }),
  z.object({ action: z.literal("revoke-grant"), entitlementId: id }),
  z.object({
    action: z.literal("set-licence"),
    tenantId: id,
    basePence: pence,
    includedLearners: z.number().int().min(0).max(100_000),
    extraLearnerPence: pence,
    status: z.enum(["active", "suspended"]),
    endsAt: date,
  }),
]);

async function tenantExists(tenantId: string) {
  if (!(await listTenants()).some((t) => t.id === tenantId))
    throw new HttpError(400, "Unknown tenant.");
}

/** GET /api/admin/commerce?tenant=…&month=YYYY-MM — packs, grants and licence usage for a tenant. */
export async function GET(req: Request) {
  try {
    await requireContext(req, "platform:entitlements:manage");
    const url = new URL(req.url);
    const tenants = await listTenants();
    const tenantId = url.searchParams.get("tenant") ?? tenants[0]!.id;
    await tenantExists(tenantId);
    const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new HttpError(400, "Month must be YYYY-MM.");
    const [packs, grants, usage] = await Promise.all([
      listSeatPacks(tenantId),
      listEntitlements(tenantId),
      licenceUsage(tenantId, month),
    ]);
    return Response.json(
      {
        tenants,
        tenantId,
        month,
        courses: listCourses().map((c) => c.slug),
        defaults: { seatPack: plans.seatPack, centreLicence: plans.centreLicence },
        packs,
        grants,
        usage,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST /api/admin/commerce — one administrative action. */
export async function POST(req: Request) {
  try {
    requireSameOriginJson(req);
    await requireContext(req, "platform:entitlements:manage");
    const a = actionSchema.parse(await req.json());
    const day = (d: string | null | undefined) => (d ? new Date(`${d}T23:59:59Z`) : null);
    switch (a.action) {
      case "create-pack": {
        await tenantExists(a.tenantId);
        const pack = await createSeatPack({ ...a, redeemBy: day(a.redeemBy) });
        return Response.json(pack, { status: 201, headers: NO_STORE });
      }
      case "regenerate-pack": {
        const code = await regenerateSeatCode(a.packId);
        if (!code) throw new HttpError(404, "Not found, or the pack is revoked.");
        return Response.json({ code }, { headers: NO_STORE });
      }
      case "revoke-pack":
        if (!(await revokeSeatPack(a.packId))) throw new HttpError(404, "Not found.");
        return Response.json({ ok: true });
      case "grant": {
        await tenantExists(a.tenantId);
        const userId = await userIdByEmail(a.email);
        if (!userId)
          throw new HttpError(404, "No account with that email. Ask them to sign in once first.");
        const g = await grantEntitlement({
          tenantId: a.tenantId,
          userId,
          course: a.course,
          source: "admin",
          endsAt: day(a.endsAt),
          note: a.note ?? null,
        });
        return Response.json(g, { status: 201 });
      }
      case "revoke-grant":
        if (!(await revokeEntitlement(a.entitlementId))) throw new HttpError(404, "Not found.");
        return Response.json({ ok: true });
      case "set-licence":
        await tenantExists(a.tenantId);
        await setTenantLicence(a.tenantId, {
          plan: plans.centreLicence.code,
          basePence: a.basePence,
          includedLearners: a.includedLearners,
          extraLearnerPence: a.extraLearnerPence,
          status: a.status,
          endsAt: day(a.endsAt),
        });
        return Response.json({ ok: true });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
