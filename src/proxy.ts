// Request gate (Next.js proxy). A cheap cookie-presence check keeps content pages static
// and cacheable; real authorisation happens server-side on every /api/me call (ADR-0015).
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { generated } from "@generated/index";
import coursesFile from "../content/courses.json";
import { needsSession, type CourseAccess } from "@/lib/access";
import { defaultBranding } from "@/lib/branding";

const courses: CourseAccess[] = coursesFile.courses.map((c) => ({
  slug: c.slug,
  manifest: generated[c.slug]!.manifest,
  // Which pages are public is a tenant decision (ADR-0024); per-host tenants arrive in Phase 2.
  publicPages: defaultBranding.access.publicPages,
}));

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (needsSession(pathname, courses) && !getSessionCookie(request)) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
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
    "/admin/:path*",
  ],
};
