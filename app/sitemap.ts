import type { MetadataRoute } from "next";
import { PUBLIC_PATHS, SITE_URL } from "@/lib/site";

/**
 * The pages a search engine should know about. No dates on purpose: a date that
 * changed on every deploy would claim every page was rewritten each time.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    url: path === "/" ? SITE_URL : `${SITE_URL}${path}`,
    priority: path === "/" ? 1 : path === "/pricing" || path === "/signup" ? 0.8 : 0.4,
  }));
}
