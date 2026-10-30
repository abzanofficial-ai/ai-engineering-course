// Request gate (Next.js proxy). A cheap cookie-presence check keeps content pages static
// and cacheable; real authorisation happens server-side on every /api/me call (ADR-0015).
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { generated } from "@generated/index";
import coursesFile from "../content/courses.json";
import { needsSession, paidCourse, type CourseAccess } from "@/lib/access";
import { PASS_COOKIE, verifyPass } from "@/lib/access-pass";
import { defaultBranding } from "@/lib/branding";
import { authSecret } from "@/server/env";

const courses: CourseAccess[] = coursesFile.courses.map((c) => ({
  slug: c.slug,
  manifest: generated[c.slug]!.manifest,
  // Which pages are public is a tenant decision (ADR-0024); per-host tenants arrive in Phase 2.
  publicPages: defaultBranding.access.publicPages,
}));

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = getSessionCookie(request);
  if (needsSession(pathname, courses) && !session) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  // Paid pages once billing launches (ADR-0030): a short-lived signed pass, issued by /access
  // after a database check. Off while every signed-in learner has the full course.
  if (session && !defaultBranding.access.launchOpenToAllSignedIn) {
    const course = paidCourse(pathname, courses, defaultBranding.access.freeTier);
    if (course) {
      const pass = await verifyPass(authSecret(), session, request.cookies.get(PASS_COOKIE)?.value);
      if (!pass?.courses.includes(course)) {
        const url = new URL("/access", request.url);
        url.searchParams.set("next", pathname + search);
        return NextResponse.redirect(url);
      }
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/learn/:path*",
    "/account/:path*",
    "/account",
    "/progress",
    "/review",
    "/notes",
    "/certificates",
    "/join",
    "/admin/:path*",
  ],
};
