import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders() },
      {
        // The service worker must always be revalidated so updates reach learners.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
      {
        source: "/diagrams/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default config;
