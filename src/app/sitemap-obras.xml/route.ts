/** @file Lee una sola partición de obras con cursor público y versión del catálogo explicitados por el índice. */
import { indexableSiteUrl } from "../../lib/config";
import { publicApi } from "../../lib/public-api";
import { sitemapDisabled, sitemapResponse, sitemapUnavailable, sitemapWorkPartition } from "../../lib/sitemap";
/** Impide almacenar respuestas de fichas pertenecientes a otro corte. */
export const dynamic = "force-dynamic";
/** Devuelve una partición completa; parámetros inválidos no consultan el backend y un corte obsoleto produce 503. */
export async function GET(request: Request) {
  const origin = indexableSiteUrl();
  if (!origin) return sitemapDisabled();
  try {
    return sitemapResponse(await sitemapWorkPartition(origin, publicApi(), new URL(request.url).searchParams, AbortSignal.timeout(15000)));
  } catch (error) {
    if (error instanceof TypeError && error.message === "INVALID_SITEMAP_PARTITION") return new Response("Partición de sitemap inválida.", { status: 400, headers: { "Cache-Control": "no-store" } });
    return sitemapUnavailable();
  }
}
