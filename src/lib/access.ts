// Which URLs need an account (ADR-0015). Pure, so the proxy and tests share it.
import { isPublicPage } from "@/content/config";
import type { CourseManifest } from "@/content/types";

export interface CourseAccess {
  slug: string;
  manifest: CourseManifest;
  publicPages: string[];
}

/** Paths that always require a session. */
const PRIVATE_PREFIXES = ["/account", "/progress", "/review", "/admin"];

export function needsSession(pathname: string, courses: CourseAccess[]): boolean {
  if (PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  if (/^\/learn\/[^/]+\/checkpoint\//.test(pathname)) return true; // checkpoints are personal
  const m = pathname.match(/^\/learn\/([^/]+)\/([^/]+)\/?$/);
  if (!m) return false; // course home and everything else is public
  const course = courses.find((c) => c.slug === m[1]);
  if (!course) return false; // unknown course → let the page 404
  const page = course.manifest.pages.find((p) => p.slug === m[2]);
  if (!page) return false;
  return !isPublicPage(course.publicPages, page.key);
}
