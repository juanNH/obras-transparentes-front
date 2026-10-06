/** @file Política de rastreo configurable; la indexación requiere una habilitación explícita del despliegue. */
import type { MetadataRoute } from "next";
import { indexableSiteUrl } from "../lib/config";
/** Permite rastrear únicamente cuando la configuración habilita indexación y publica el sitemap del origen validado. */
export default function robots(): MetadataRoute.Robots {
  const origin = indexableSiteUrl();
  if (!origin) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: "/api/" }, sitemap: new URL("/sitemap.xml", origin).href };
}
