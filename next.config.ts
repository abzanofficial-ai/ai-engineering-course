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
        source: "/diagrams/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default config;
