import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright", "playwright-core", "@sparticuz/chromium"],
  outputFileTracingIncludes: {
    "/api/templates-preview/**/*": [
      "./templates/**/*",
    ],
    "/api/websites/migrate/**/*": [
      "./node_modules/playwright-core/**/*",
      "./node_modules/playwright/**/*",
      "./node_modules/@sparticuz/chromium/**/*",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
