import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://codeaxys.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/dashboard",
          "/dashboard/",
          "/api/",
          "/auth/",
          "/maintenance",
        ],
      },
      {
        userAgent: [
          "Googlebot",
          "Bingbot",
          "OAI-SearchBot",
          "PerplexityBot",
          "ClaudeBot",
          "GPTBot",
          "Google-Extended",
        ],
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/dashboard",
          "/dashboard/",
          "/api/",
          "/auth/",
          "/maintenance",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
