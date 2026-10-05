import { siteUrl } from "../../lib/config";
import { publicApi } from "../../lib/public-api";
export const dynamic = "force-dynamic";
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
export async function GET() {
  try {
    const api = publicApi(); const urls = ["/", "/proyecto", "/privacidad"]; const seen = new Set<string>();
    const signal = AbortSignal.timeout(15000);
    let cursor: string | undefined; let version: string | undefined;
    for (let page = 0; page < 10; page++) {
      const data = await api.list({ limit: 200, ...(cursor ? { cursor } : {}) }, { signal });
      if (version !== undefined && version !== data.catalogoVersion) throw new Error("CATALOG_CHANGED");
      version = data.catalogoVersion;
      urls.push(...data.items.map(work => "/obras/" + work.obraId));
      if (!data.nextCursor) return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...new Set(urls)].map(path => `<url><loc>${escape(new URL(path, siteUrl()).href)}</loc></url>`).join("")}</urlset>`, { headers: { "Content-Type": "application/xml", "Cache-Control": "no-store" } });
      if (seen.has(data.nextCursor)) throw new Error("REPEATED_CURSOR");
      seen.add(data.nextCursor); cursor = data.nextCursor;
    }
    throw new Error("SITEMAP_REQUIRES_PARTITIONING");
  } catch { return new Response("Sitemap temporalmente no disponible.", { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "300" } }); }
}
