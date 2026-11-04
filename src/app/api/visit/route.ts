// POST /api/visit — counts one visit by source (ADR-0032). Anonymous by design: no cookies are
// set or read beyond checking whether a session exists, and nothing about the visitor is
// stored. Signed-in learners are not counted. A short-lived, keyed hash of the address limits
// how fast one client can add visits; the address itself is never stored.
import { createHmac } from "node:crypto";
import { getSessionCookie } from "better-auth/cookies";
import { sourceSchema } from "@/lib/attribution";
import { authSecret } from "@/server/env";
import { allow } from "@/server/rate-limit";
import { recordVisit } from "@/server/repo/analytics";
import { resolveTenant } from "@/server/tenant";
import { errorResponse, requireSameOriginJson } from "@/server/session";

const clientKey = (req: Request) => {
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  return createHmac("sha256", authSecret()).update(`visit:${ip}`).digest("base64url").slice(0, 22);
};

export async function POST(req: Request) {
  try {
    requireSameOriginJson(req);
    if (getSessionCookie(req)) return new Response(null, { status: 204 });
    const s = sourceSchema.parse(await req.json());
    if (!(await allow(`visit:${clientKey(req)}`, 60, 3600)))
      return new Response(null, { status: 204 });
    const tenant = await resolveTenant(req);
    await recordVisit(tenant.id, new Date().toISOString().slice(0, 10), s);
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
