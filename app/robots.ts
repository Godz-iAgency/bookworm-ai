import type { MetadataRoute } from "next";
import { PRIVATE_PATHS, SITE_URL } from "@/lib/site";

/**
 * Tells crawlers what to leave alone and where the sitemap is.
 *
 * /go/ matters most. A guest link signs its visitor in as a new guest the moment
 * the page loads, so a crawler that followed one would use up places on the
 * link. Keeping crawlers out of it is what stops that.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...PRIVATE_PATHS] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
