/** @file Construye índices y particiones XML acotadas desde un mismo corte público, sin caché ni datos administrativos. */
import type { WorkList } from "../api/client";

/** Tamaño de una partición, igual al máximo de una página admitida por la API. */
export const SITEMAP_PARTITION_SIZE = 200;
/** Presupuesto finito para el índice; excederlo produce error en vez de omitir fichas. */
export const SITEMAP_MAX_PARTITIONS = 500;
/** Páginas públicas generales, independientes de los cursores de obras. */
export const SITEMAP_STATIC_PATHS = ["/", "/proyecto", "/privacidad", "/terminos"] as const;

/** Lectura pública inyectable para verificar paginación sin consultar un entorno activo. */
export interface SitemapApi {
  list(query: { limit: number; cursor?: string }, options: { signal: AbortSignal }): Promise<WorkList>;
}

/** Escapa caracteres reservados de XML, incluidos los parámetros del cursor público. */
function xmlText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
}

/** Produce un documento XML de URLs deduplicadas que conservan el origen configurado. */
export function sitemapUrlSet(origin: URL, paths: readonly string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...new Set(paths)].map((path) => `<url><loc>${xmlText(new URL(path, origin).href)}</loc></url>`).join("")}</urlset>`;
}

/** Recorre todas las páginas para descubrir cursores, sin truncar un catálogo mayor de dos mil obras. */
export async function sitemapIndex(origin: URL, api: SitemapApi, signal: AbortSignal): Promise<string> {
  const urls = [new URL("/sitemap-paginas.xml", origin).href];
  const cursors = new Set<string>();
  const works = new Set<string>();
  let cursor: string | undefined;
  let version: string | undefined;
  for (let page = 0; page < SITEMAP_MAX_PARTITIONS; page++) {
    const data = await api.list({ limit: SITEMAP_PARTITION_SIZE, ...(cursor ? { cursor } : {}) }, { signal });
    if (version !== undefined && version !== data.catalogoVersion) throw new Error("CATALOG_CHANGED");
    version = data.catalogoVersion;
    if (data.items.length === 0 && data.nextCursor) throw new Error("EMPTY_SITEMAP_PAGE");
    for (const work of data.items) {
      if (works.has(work.obraId)) throw new Error("REPEATED_SITEMAP_WORK");
      works.add(work.obraId);
    }
    if (data.items.length > 0) {
      const partition = new URL("/sitemap-obras.xml", origin);
      partition.searchParams.set("catalogoVersion", version);
      if (cursor) partition.searchParams.set("cursor", cursor);
      urls.push(partition.href);
    }
    if (!data.nextCursor) return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<sitemap><loc>${xmlText(url)}</loc></sitemap>`).join("")}</sitemapindex>`;
    if (cursors.has(data.nextCursor)) throw new Error("REPEATED_CURSOR");
    cursors.add(data.nextCursor);
    cursor = data.nextCursor;
  }
  throw new Error("SITEMAP_INDEX_BUDGET");
}

/** Lee sólo la partición pedida y rechaza una revisión de catálogo distinta a la descubierta por el índice. */
export async function sitemapWorkPartition(origin: URL, api: SitemapApi, query: URLSearchParams, signal: AbortSignal): Promise<string> {
  const version = query.get("catalogoVersion");
  const cursor = query.get("cursor");
  if (!version || !/^(?:0|[1-9][0-9]{0,19})$/.test(version) || [...query.keys()].some((key) => !["catalogoVersion", "cursor"].includes(key)) || query.getAll("catalogoVersion").length !== 1 || query.getAll("cursor").length > 1 || (cursor !== null && (!cursor || cursor.length > 4096))) throw new TypeError("INVALID_SITEMAP_PARTITION");
  const data = await api.list({ limit: SITEMAP_PARTITION_SIZE, ...(cursor ? { cursor } : {}) }, { signal });
  if (data.catalogoVersion !== version) throw new Error("CATALOG_CHANGED");
  if (new Set(data.items.map((work) => work.obraId)).size !== data.items.length) throw new Error("REPEATED_SITEMAP_WORK");
  return sitemapUrlSet(origin, data.items.map((work) => "/obras/" + work.obraId));
}

/** Respuesta común de indexación cerrada por entorno; no consulta la API. */
export function sitemapDisabled(): Response {
  return new Response("Sitemap no habilitado para este entorno.", { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

/** Documento XML completo y sin caché para evitar mezclar publicaciones de catálogos diferentes. */
export function sitemapResponse(xml: string): Response {
  return new Response(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "no-store" } });
}

/** Error recuperable del catálogo o su presupuesto sin divulgar cursores ni diagnósticos internos. */
export function sitemapUnavailable(): Response {
  return new Response("Sitemap temporalmente no disponible.", { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "300" } });
}
