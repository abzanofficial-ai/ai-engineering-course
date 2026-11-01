// Read-only access to generated course content (.content/, built by `pnpm content:build`).
// Manifests are imported statically so server code works on any runtime; page bodies are
// read from disk and only at build time, because every content page is prerendered.
import { readFileSync } from "node:fs";
import path from "node:path";
import { generated } from "@generated/index";
import coursesFile from "../../content/courses.json";
import { coursesFileSchema, isPublicPage, type CourseEntry } from "@/content/config";
import { defaultBranding } from "@/lib/branding";
import type { CourseManifest, Page, PageMeta } from "@/content/types";

const { courses } = coursesFileSchema.parse(coursesFile);

export function listCourses(): CourseEntry[] {
  return courses;
}

export function getCourseEntry(slug: string): CourseEntry | undefined {
  return courses.find((c) => c.slug === slug);
}

export function getManifest(slug: string): CourseManifest | undefined {
  return generated[slug]?.manifest;
}

export function getGlossary(slug: string) {
  return generated[slug]?.glossary ?? [];
}

export function getCards(slug: string) {
  return generated[slug]?.cards ?? [];
}

export function publishedPages(manifest: CourseManifest): PageMeta[] {
  return manifest.pages.filter((p) => p.status === "published");
}

export function findPageBySlug(manifest: CourseManifest, slug: string): PageMeta | undefined {
  return manifest.pages.find((p) => p.slug === slug && p.status === "published");
}

export function loadPage(courseSlug: string, pageKey: string): Page {
  const file = path.join(process.cwd(), ".content", courseSlug, "pages", `${pageKey}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as Page;
}

export function isPagePublic(pageKey: string): boolean {
  return isPublicPage(defaultBranding.access.publicPages, pageKey);
}

/** Previous/next published pages in reading order. */
export function neighbours(manifest: CourseManifest, pageKey: string) {
  const pages = publishedPages(manifest);
  const i = pages.findIndex((p) => p.key === pageKey);
  return { prev: i > 0 ? pages[i - 1] : undefined, next: i >= 0 ? pages[i + 1] : undefined };
}

export function pageHref(courseSlug: string, page: Pick<PageMeta, "slug">): string {
  return `/learn/${courseSlug}/${page.slug}`;
}
