import { beforeEach, describe, expect, it, vi } from "vitest";
import examples from "../contracts/examples.json" with { type: "json" };
import { PublicApiError } from "../src/api/client.js";

const api = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), geojson: vi.fn() }));
vi.mock("../src/lib/public-api", () => ({ publicApi: () => api }));
vi.mock("../src/lib/config", () => ({ siteUrl: () => new URL("https://obras.example.org") }));

import { GET } from "../src/app/api/public/[...path]/route";
import { GET as sitemap } from "../src/app/sitemap.xml/route";

const id = examples.detailPopulated.obraId;
const revision = examples.detailPopulated.revisionId;
const request = (path: string, query = "", init?: RequestInit) => new Request(`https://obras.example.org/api/public/${path}${query}`, init);
const context = (...path: string[]) => ({ params: Promise.resolve({ path }) });
beforeEach(() => vi.resetAllMocks());

describe("BFF de lectura pública", () => {
  it("clasifica la caída de red como 503 sin exponer el diagnóstico interno", async () => {
    api.list.mockRejectedValue(new TypeError("fetch failed: http://private.internal/api secret-private-diagnostic"));
    const response = await GET(request("obras"), context("obras"));
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(body.error.code).toBe("UNAVAILABLE");
    expect(JSON.stringify(body)).not.toMatch(/private\.internal|secret-private-diagnostic|INVALID_QUERY/);
  });

  it.each([
    ["obras", "?admin=true"],
    ["obras", "?vista=mapa"],
    ["obras", "?limit=50000"],
    ["obras", "?fuente=constructor"],
    ["obras", "?estado=IN_PROGRESS&estado=COMPLETED"],
    ["geojson", ""],
    ["geojson", "?bbox=-59,-35,-58,-34&tieneGeometria=false"],
  ])("rechaza parámetros no admitidos antes de consultar %s%s", async (path, query) => {
    const response = await GET(request(path, query), context(path));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_QUERY");
    expect(api.list).not.toHaveBeenCalled();
    expect(api.detail).not.toHaveBeenCalled();
    expect(api.geojson).not.toHaveBeenCalled();
  });

  it("reenvía solo filtros públicos normalizados, con su signal y límite fijo", async () => {
    api.list.mockResolvedValue(examples.listEmpty);
    const input = request("obras", "?bbox=-59,-35,-58,-34&fuente=nacion-obras&estado=IN_PROGRESS&territorioEsquema=pba.municipio&municipioCodigo=001&cursor=abc", { headers: { Cookie: "private-session=secret", Authorization: "Bearer secret" } });
    const response = await GET(input, context("obras"));
    expect(response.status).toBe(200);
    expect(api.list).toHaveBeenCalledWith({ limit: 20, bbox: [-59, -35, -58, -34], fuente: "nacion-obras", estado: "IN_PROGRESS", territorioEsquema: "pba.municipio", municipioCodigo: "001", cursor: "abc" }, { signal: input.signal });
    expect(await response.json()).toEqual(examples.listEmpty);
  });

  it("limita GeoJSON a 100 ubicaciones y conserva exactamente el área", async () => {
    api.geojson.mockResolvedValue(examples.geojsonEmpty);
    const input = request("geojson", "?bbox=-58.45678,-35,-58,-34&sector=educacion");
    const response = await GET(input, context("geojson"));
    expect(response.status).toBe(200);
    expect(api.geojson).toHaveBeenCalledWith({ limit: 100, bbox: [-58.45678, -35, -58, -34], sector: "educacion" }, { signal: input.signal });
  });

  it("consulta la revisión elegida sin propagar cookies ni autorización entrantes", async () => {
    api.detail.mockResolvedValue(examples.detailPopulated);
    const input = request(`obras/${id}`, `?revisionId=${revision}`, { headers: { Cookie: "private-session=secret", Authorization: "Bearer secret" } });
    const response = await GET(input, context("obras", id));
    expect(response.status).toBe(200);
    expect(api.detail).toHaveBeenCalledWith(id, revision, { signal: input.signal });
    expect((await response.json()).revisionId).toBe(revision);
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });

  it("rechaza parámetros extra y revisiones repetidas en una ficha", async () => {
    for (const query of [`?revisionId=${revision}&secret=x`, `?revisionId=${revision}&revisionId=${revision}`]) {
      const response = await GET(request(`obras/${id}`, query), context("obras", id));
      expect(response.status).toBe(400);
    }
    expect(api.detail).not.toHaveBeenCalled();
  });

  it("preserva el 409 de catálogo sin filtrar detalles de diagnóstico", async () => {
    api.list.mockRejectedValue(new PublicApiError(409, { code: "CATALOG_CHANGED", message: "private-diagnostic", details: { internal: "private-diagnostic" }, requestId: "private-diagnostic" }));
    const response = await GET(request("obras", "?cursor=abc"), context("obras"));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "CATALOG_CHANGED", message: "El catálogo cambió. Reiniciá la consulta." } });
  });

  it("no convierte rutas administrativas en solicitudes al backend", async () => {
    const response = await GET(request("admin/accesos"), context("admin", "accesos"));
    expect(response.status).toBe(404);
    expect(api.list).not.toHaveBeenCalled();
    expect(api.detail).not.toHaveBeenCalled();
    expect(api.geojson).not.toHaveBeenCalled();
  });
});

describe("sitemap acotado y consistente", () => {
  it("incluye fichas canónicas solo al terminar todas las páginas", async () => {
    api.list.mockResolvedValueOnce({ ...examples.listPopulated, nextCursor: "next" }).mockResolvedValueOnce({ ...examples.listEmpty, catalogoVersion: examples.listPopulated.catalogoVersion });
    const response = await sitemap();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/xml");
    const xml = await response.text();
    expect(xml).toContain(`<loc>https://obras.example.org/obras/${id}</loc>`);
    expect(xml).not.toContain("revisionId");
    const signal = api.list.mock.calls[0]![1].signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(api.list).toHaveBeenNthCalledWith(2, { limit: 200, cursor: "next" }, { signal });
  });

  it("devuelve 503 si cambia el catálogo, sin entregar un XML parcial", async () => {
    api.list.mockResolvedValueOnce({ ...examples.listPopulated, nextCursor: "next" }).mockResolvedValueOnce({ ...examples.listEmpty, catalogoVersion: "8" });
    const response = await sitemap();
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("300");
    expect(await response.text()).not.toContain(id);
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it("detiene un cursor repetido y anuncia indisponibilidad temporal", async () => {
    api.list.mockResolvedValue({ ...examples.listPopulated, nextCursor: "repeated" });
    const response = await sitemap();
    expect(response.status).toBe(503);
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it("acota a diez páginas y no publica un catálogo truncado", async () => {
    let page = 0;
    api.list.mockImplementation(async () => ({ ...examples.listPopulated, nextCursor: `next-${++page}` }));
    const response = await sitemap();
    expect(response.status).toBe(503);
    expect(api.list).toHaveBeenCalledTimes(10);
  });
});
