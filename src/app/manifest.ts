import type { MetadataRoute } from "next";
import { listCourses } from "@/lib/content";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The AI Engineering Handbook",
    short_name: "AI Handbook",
    description: "A practical route from beginner to job-ready AI engineer.",
    start_url: `/learn/${listCourses()[0]!.slug}`,
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0e1116",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
