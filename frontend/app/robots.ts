import type { MetadataRoute } from "next";
import { PUBLIC_PATHS, SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: [...PUBLIC_PATHS], disallow: ["/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
