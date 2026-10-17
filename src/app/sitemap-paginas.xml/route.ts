/** @file Publica las páginas generales en una partición independiente, cerrada en local y staging. */
import { indexableSiteUrl } from "../../lib/config";
import { SITEMAP_STATIC_PATHS, sitemapDisabled, sitemapResponse, sitemapUrlSet } from "../../lib/sitemap";
/** Conserva el control de indexación vigente del entorno en cada lectura. */
export const dynamic = "force-dynamic";
/** Devuelve las páginas generales sin acceder al catálogo de obras ni a datos privados. */
export function GET() {
  const origin = indexableSiteUrl();
  return origin ? sitemapResponse(sitemapUrlSet(origin, SITEMAP_STATIC_PATHS)) : sitemapDisabled();
}
