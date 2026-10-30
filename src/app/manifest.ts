import type { MetadataRoute } from "next";
import { defaultBranding as brand } from "@/lib/branding";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.shortName,
    description: brand.tagline,
    start_url: `/learn/${brand.defaultCourse}`,
    scope: "/",
    display: "standalone",
    background_color: brand.colors.themeLight,
    theme_color: brand.colors.themeDark,
    icons: [
      { src: brand.logo.icon192, sizes: "192x192", type: "image/png" },
      { src: brand.logo.icon512, sizes: "512x512", type: "image/png" },
      { src: brand.logo.maskable512, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
