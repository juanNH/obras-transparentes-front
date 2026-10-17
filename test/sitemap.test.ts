/** @file Verifica índices completos de más de dos mil fichas, particiones acotadas y cortes consistentes sin red. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import examples from "../contracts/examples.json" with { type: "json" };
import type { WorkList } from "../src/api/client";
import { SITEMAP_MAX_PARTITIONS, sitemapIndex, sitemapWorkPartition } from "../src/lib/sitemap";
const api = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../src/lib/public-api", () => ({ publicApi: () => api }));
import { GET as indexRoute } from "../src/app/sitemap.xml/route";
import { GET as worksRoute } from "../src/app/sitemap-obras.xml/route";
import { GET as pagesRoute } from "../src/app/sitemap-paginas.xml/route";

const origin = new URL("https://www.argentina.gob.ar");
const signal = new AbortController().signal;

/** Página sintética de una fuente sin inferir frescura ni ubicación a partir de sus IDs. */
function page(offset: number, count: number, nextCursor: string | null, version = "49"): WorkList {
  return { ...examples.listPopulated, catalogoVersion: version, limit: 200, nextCursor, items: Array.from({ length: count }, (_, index) => ({ ...examples.listPopulated.items[0]!, obraId: `00000000-0000-4000-8000-${String(offset + index).padStart(12, "0")}` })) } as WorkList;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SITE_URL", origin.origin);
  vi.stubEnv("SITE_ENVIRONMENT", "production");
  vi.stubEnv("SITE_INDEXABLE", "true");
});
afterEach(() => vi.unstubAllEnvs());

describe("sitemap particionado", () => {
  it("descubre las 2.083 fichas en once particiones completas, sin omitir las últimas 83", async () => {
    api.list.mockImplementation(async ({ cursor }: { cursor?: string }) => {
      const offset = cursor ? Number(cursor.slice(5)) : 0;
      const count = Math.min(200, 2083 - offset);
      return page(offset, count, offset + count < 2083 ? `page-${offset + count}` : null);
    });
    const response = await indexRoute();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const xml = await response.text();
    expect(xml).toContain("<sitemapindex");
    const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]!.replaceAll("&amp;", "&"));
    expect(urls).toHaveLength(12);
    expect(urls[0]).toBe(new URL("/sitemap-paginas.xml", origin).href);
    expect(api.list).toHaveBeenCalledTimes(11);
    const ids: string[] = [];
    for (const url of urls.slice(1)) {
      const partition = await worksRoute(new Request(url));
      expect(partition.status).toBe(200);
      ids.push(...[...(await partition.text()).matchAll(/\/obras\/([^<]+)<\/loc>/g)].map((match) => match[1]!));
    }
    expect(ids).toHaveLength(2083);
    expect(new Set(ids).size).toBe(2083);
    expect(ids.at(-1)).toBe("00000000-0000-4000-8000-000000002082");
    expect(api.list).toHaveBeenCalledTimes(22);
  });

  it("publica sólo las páginas generales cuando el catálogo está vacío", async () => {
    api.list.mockResolvedValue(page(0, 0, null));
    const xml = await sitemapIndex(origin, api, signal);
    expect(xml.match(/<sitemap>/g)).toHaveLength(1);
    const pages = await pagesRoute().text();
    expect(pages.match(/<url>/g)).toHaveLength(4);
  });

  it.each(["local", "staging"])("no consulta la API ni sirve particiones en %s", async (environment) => {
    vi.stubEnv("SITE_ENVIRONMENT", environment);
    for (const response of [await indexRoute(), await worksRoute(new Request(origin)), pagesRoute()]) {
      expect(response.status).toBe(404);
      expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    }
    expect(api.list).not.toHaveBeenCalled();
  });

  it("escapa el cursor público en XML y conserva su valor exacto al leer una partición", async () => {
    const cursor = "signed+cursor/&part=2";
    api.list.mockResolvedValueOnce(page(0, 1, cursor)).mockResolvedValueOnce(page(1, 1, null));
    const xml = await sitemapIndex(origin, api, signal);
    expect(xml).toContain("&amp;cursor=signed%2Bcursor%2F%26part%3D2");
    api.list.mockResolvedValueOnce(page(1, 1, null));
    await sitemapWorkPartition(origin, api, new URLSearchParams({ catalogoVersion: "49", cursor }), signal);
    expect(api.list).toHaveBeenLastCalledWith({ limit: 200, cursor }, { signal });
  });

  it.each(["catalogoVersion=49&bbox=x", "catalogoVersion=49&catalogoVersion=49", "catalogoVersion=49&cursor=", "catalogoVersion=49&cursor=a&cursor=b", "catalogoVersion=049", "cursor=a"])("rechaza parámetros de partición inválidos sin consultar datos: %s", async (query) => {
    const response = await worksRoute(new Request(`${origin}sitemap-obras.xml?${query}`));
    expect(response.status).toBe(400);
    expect(api.list).not.toHaveBeenCalled();
  });

  it("no mezcla versiones entre páginas ni sirve particiones de un índice obsoleto", async () => {
    api.list.mockResolvedValueOnce(page(0, 1, "next")).mockResolvedValueOnce(page(1, 1, null, "50"));
    expect((await indexRoute()).status).toBe(503);
    api.list.mockResolvedValueOnce(page(0, 1, null, "50"));
    const response = await worksRoute(new Request(`${origin}sitemap-obras.xml?catalogoVersion=49`));
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("300");
  });

  it.each(["cursor", "work", "empty"])("rechaza recorridos incompletos por %s", async (failure) => {
    api.list.mockResolvedValueOnce(page(0, 1, "same"));
    api.list.mockResolvedValueOnce(failure === "cursor" ? page(1, 1, "same") : failure === "work" ? page(0, 1, null) : page(1, 0, "next"));
    await expect(sitemapIndex(origin, api, signal)).rejects.toThrow();
  });

  it("falla explícitamente al exceder su presupuesto sin devolver un índice truncado", async () => {
    let offset = 0;
    api.list.mockImplementation(async () => page(offset++, 1, `next-${offset}`));
    await expect(sitemapIndex(origin, api, signal)).rejects.toThrow("SITEMAP_INDEX_BUDGET");
    expect(api.list).toHaveBeenCalledTimes(SITEMAP_MAX_PARTITIONS);
  });
});
