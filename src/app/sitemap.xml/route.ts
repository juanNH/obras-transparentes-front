/** @file Descubre particiones de fichas actuales bajo una misma versión del catálogo público. */
import { indexableSiteUrl } from "../../lib/config";
import { publicApi } from "../../lib/public-api";
import { sitemapDisabled, sitemapIndex, sitemapResponse, sitemapUnavailable } from "../../lib/sitemap";
/** Impide servir un índice almacenado después de cambiar el catálogo. */
export const dynamic = "force-dynamic";
/** Responde un índice completo, 404 sin indexación habilitada o 503 ante un corte inconsistente. */
export async function GET() {
  const origin = indexableSiteUrl();
  if (!origin) return sitemapDisabled();
  try {
    return sitemapResponse(await sitemapIndex(origin, publicApi(), AbortSignal.timeout(15000)));
  } catch {
    return sitemapUnavailable();
  }
}
