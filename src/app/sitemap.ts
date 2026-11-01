import type { MetadataRoute } from "next";
import { getManifest, isPagePublic, listCourses, pageHref } from "@/lib/content";

// Only pages anyone can read: the landing page, plans, each course's route and glossary, and the
// chapters that are public without an account.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const urls: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/plans`, changeFrequency: "monthly", priority: 0.6 },
  ];
  for (const c of listCourses()) {
    const m = getManifest(c.slug);
    if (!m) continue;
    urls.push(
      { url: `${base}/learn/${c.slug}`, changeFrequency: "weekly", priority: 0.9 },
      { url: `${base}/learn/${c.slug}/glossary`, changeFrequency: "monthly", priority: 0.5 },
    );
    for (const p of m.pages)
      if (p.status === "published" && isPagePublic(p.key))
        urls.push({
          url: `${base}${pageHref(c.slug, p)}`,
          changeFrequency: "monthly",
          priority: 0.8,
        });
  }
  return urls;
}
