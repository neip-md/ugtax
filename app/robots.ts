import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing useful to a crawler, and /api is unauthenticated: no reason to
      // advertise it.
      disallow: ["/api/", "/auth/"],
    },
    sitemap: "https://ugtax.de/sitemap.xml",
  };
}
