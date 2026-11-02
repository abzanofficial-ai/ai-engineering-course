import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import { PASS_COOKIE, PASS_SECONDS, signPass } from "@/lib/access-pass";
import { listCourses } from "@/lib/content";
import { safeNext } from "@/lib/safe-next";
import { requireContext } from "@/server/context";
import { authSecret } from "@/server/env";
import { loadAccess, pageAccess } from "@/server/repo/commerce";

/**
 * GET /access?next=/learn/… — the proxy sends learners here when a paid page needs a fresh access
 * pass (ADR-0030). Checks the database, issues the pass and returns them, or shows the plans.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  try {
    const { ctx } = await requireContext(req, "own:progress");
    const courses: string[] = [];
    for (const c of listCourses())
      if (pageAccess(await loadAccess(ctx, c.slug), null).allowed) courses.push(c.slug);
    const course = next.match(/^\/learn\/([^/]+)/)?.[1];
    if (course && !courses.includes(course))
      return NextResponse.redirect(new URL(`/plans?next=${encodeURIComponent(next)}`, url));
    const res = NextResponse.redirect(new URL(next, url));
    const session = getSessionCookie(req) ?? "";
    res.cookies.set(PASS_COOKIE, await signPass(authSecret(), session, courses), {
      httpOnly: true,
      sameSite: "lax",
      secure: url.protocol === "https:",
      path: "/",
      maxAge: PASS_SECONDS,
    });
    return res;
  } catch {
    return NextResponse.redirect(new URL(`/sign-in?next=${encodeURIComponent(next)}`, url));
  }
}
