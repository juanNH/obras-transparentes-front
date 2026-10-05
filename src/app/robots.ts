/** @file Política de rastreo configurable; la indexación requiere una habilitación explícita del despliegue. */
import type { MetadataRoute } from "next";
import { siteUrl } from "../lib/config";
/** Permite rastrear únicamente cuando la configuración habilita indexación y publica el sitemap del origen validado. */
export default function robots(): MetadataRoute.Robots {
  return { rules: process.env.SITE_INDEXABLE === "true" ? { userAgent: "*", allow: "/", disallow: "/api/" } : { userAgent: "*", disallow: "/" }, sitemap: new URL("/sitemap.xml", siteUrl()).href };
}
