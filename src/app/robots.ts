import type { MetadataRoute } from "next";
import { siteUrl } from "../lib/config";
export default function robots(): MetadataRoute.Robots {
  return { rules: process.env.SITE_INDEXABLE === "true" ? { userAgent: "*", allow: "/", disallow: "/api/" } : { userAgent: "*", disallow: "/" }, sitemap: new URL("/sitemap.xml", siteUrl()).href };
}
