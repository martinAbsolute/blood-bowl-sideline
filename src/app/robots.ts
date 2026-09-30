import type { MetadataRoute } from "next";
import { isPreview, siteUrl } from "@/lib/site-metadata";

export default function robots(): MetadataRoute.Robots {
  if (isPreview) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/"],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).href,
  };
}
