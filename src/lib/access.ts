// Which URLs need an account (ADR-0015). Pure, so the proxy and tests share it.
import { isPublicPage } from "@/content/config";
import type { CourseManifest } from "@/content/types";
import { isFreeTierPage } from "./plans";

export interface CourseAccess {
  slug: string;
  manifest: CourseManifest;
  publicPages: string[];
}

/** Paths that always require a session. */
const PRIVATE_PREFIXES = ["/account", "/progress", "/review", "/notes", "/join", "/admin"];

export function needsSession(pathname: string, courses: CourseAccess[]): boolean {
  if (PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  if (/^\/learn\/[^/]+\/checkpoint\//.test(pathname)) return true; // checkpoints are personal
  if (pathname === "/certificates") return true; // your list; /certificates/<id> verifies publicly
  const m = pathname.match(/^\/learn\/([^/]+)\/([^/]+)\/?$/);
  if (!m) return false; // course home and everything else is public
  const course = courses.find((c) => c.slug === m[1]);
  if (!course) return false; // unknown course → let the page 404
  const page = course.manifest.pages.find((p) => p.slug === m[2]);
  if (!page) return false;
  return !isPublicPage(course.publicPages, page.key);
}

/**
 * The course a paid page belongs to when it needs an access pass (ADR-0030): any chapter that is
 * neither public nor in the free tier, and every checkpoint outside the free tier. Null otherwise.
 */
export function paidCourse(
  pathname: string,
  courses: CourseAccess[],
  freeTier: string[],
): string | null {
  const cp = pathname.match(/^\/learn\/([^/]+)\/checkpoint\/(\d+)\/?$/);
  if (cp) {
    const course = courses.find((c) => c.slug === cp[1]);
    return course && !isFreeTierPage(freeTier, "", Number(cp[2])) ? course.slug : null;
  }
  const m = pathname.match(/^\/learn\/([^/]+)\/([^/]+)\/?$/);
  const course = m && courses.find((c) => c.slug === m[1]);
  const page = course && course.manifest.pages.find((p) => p.slug === m![2]);
  if (!course || !page || page.status !== "published") return null;
  if (isPublicPage(course.publicPages, page.key)) return null;
  return isFreeTierPage(freeTier, page.key, page.partNumber) ? null : course.slug;
}
