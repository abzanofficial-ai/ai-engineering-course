import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Personal and administrative pages are never useful in search results.
      disallow: [
        "/api/",
        "/admin",
        "/account",
        "/home",
        "/progress",
        "/review",
        "/notes",
        "/join",
        "/access",
        "/certificates",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
