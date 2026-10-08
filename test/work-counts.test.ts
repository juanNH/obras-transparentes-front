/** @file Comprueba particiones, transporte anónimo, coherencia SSR y enlaces municipales sin paginación ni API real. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import examples from "../contracts/examples.json" with { type: "json" };
import { createPublicApi, type WorkCounts } from "../src/api/client";
import { countsQuery, sourceListHref } from "../src/lib/explorer-query";
import { WorkCountsPanel } from "../src/components/work-counts";

const api = vi.hoisted(() => ({ list: vi.fn(), parties: vi.fn(), provinces: vi.fn(), organizations: vi.fn(), municipalCoverage: vi.fn(), counts: vi.fn() }));
vi.mock("../src/lib/public-api", () => ({ publicApi: () => api }));
vi.mock("../src/lib/config", () => ({ mapStyleUrl: () => "https://example.test/style.json", indexableSiteUrl: () => null }));
vi.mock("../src/components/explorer", () => ({ Explorer: () => null }));
import MapPage from "../src/app/mapa/page";
import { GET } from "../src/app/api/public/[...path]/route";

const counts: WorkCounts = { catalogoVersion: examples.listPopulated.catalogoVersion, totalPublicadas: 31, totalConGeometria: 21, totalSinGeometria: 10, area: { bbox: [-59, -35, -58, -34], obrasEnMapa: 7, obrasFueraDelArea: 14 } };
beforeEach(() => { vi.resetAllMocks(); api.list.mockResolvedValue(examples.listPopulated); api.counts.mockResolvedValue(counts); api.municipalCoverage.mockRejectedValue(new Error("Synthetic coverage unavailable")); });

/** Recupera props del explorador sin montar el mapa o crear conexiones reales. */
function explorer(page: ReactElement) { return (page.props as { children: ReactElement[] }).children[1]! as ReactElement<{ counts: WorkCounts | null; countsError: string | null }> ; }

describe("conteos y navegación por fuente públicos", () => {
  it("abre un listado directo por fuente sin filtros incompatibles", () => {
    const query = { fuente: "pergamino-obras", estado: "IN_PROGRESS", bbox: [-59, -35, -58, -34], tieneGeometria: true, cursor: "synthetic-page", limit: 20 } as const;
    expect(countsQuery(query)).toEqual({ fuente: "pergamino-obras", estado: "IN_PROGRESS", bbox: query.bbox });
    expect(sourceListHref("bahia-obras")).toBe("/mapa?fuente=bahia-obras&vista=lista");
    expect(sourceListHref("nacion-obras")).toBe("/mapa?fuente=nacion-obras&vista=lista");
    expect(sourceListHref()).toBe("/mapa?vista=lista");
    expect(query.cursor).toBe("synthetic-page");
  });
  it("valida totales y partición por obras únicas, sin credenciales ni paginación", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(counts)));
    const signal = new AbortController().signal;
    await expect(createPublicApi({ fetch: request }).counts({ fuente: "pergamino-obras", bbox: [-59, -35, -58, -34] }, { signal })).resolves.toEqual(counts);
    const params = new URL(String(request.mock.calls[0]![0]), "https://example.test").searchParams;
    expect(params.get("fuente")).toBe("pergamino-obras"); expect(params.has("cursor")).toBe(false); expect(params.has("limit")).toBe(false);
    expect(request.mock.calls[0]![1]).toMatchObject({ credentials: "omit", redirect: "error", signal });
    for (const body of [{ ...counts, totalPublicadas: 32 }, { ...counts, area: { ...counts.area!, obrasFueraDelArea: 15 } }, { ...counts, area: null }, { ...counts, area: { ...counts.area!, bbox: [-60, -35, -58, -34] } }]) {
      request.mockResolvedValueOnce(new Response(JSON.stringify(body)));
      await expect(createPublicApi({ fetch: request }).counts({ bbox: [-59, -35, -58, -34] })).rejects.toMatchObject({ name: "ApiContractError" });
    }
  });
  it("SSR consulta los demás filtros y oculta cifras si su catálogo difiere de la lista", async () => {
    const input = { fuente: "pergamino-obras", tieneGeometria: "true", bbox: "-59,-35,-58,-34", cursor: "synthetic-page" };
    const page = await MapPage({ searchParams: Promise.resolve(input) });
    expect(api.counts).toHaveBeenCalledTimes(5);
    expect(api.counts).toHaveBeenCalledWith({ fuente: "pergamino-obras", bbox: [-59, -35, -58, -34] });
    for (const fuente of ["pba-edificios", "nacion-obras", "caba-actualizado", "vl-obras"]) expect(api.counts).toHaveBeenCalledWith({ fuente });
    expect(explorer(page).props.counts).toEqual(counts);
    api.counts.mockResolvedValue({ ...counts, catalogoVersion: "9876" });
    expect(explorer(await MapPage({ searchParams: Promise.resolve(input) })).props).toMatchObject({ counts: null, countsError: "CATALOG_CHANGED" });
    api.list.mockRejectedValue(new Error("Synthetic list unavailable"));
    expect(explorer(await MapPage({ searchParams: Promise.resolve(input) })).props).toMatchObject({ counts: null, countsError: "UNAVAILABLE" });
  });
  it("BFF admite sólo filtros sin páginas y conserva cancelación sin credenciales", async () => {
    const input = new Request("https://example.test/api/public/obras/conteos?fuente=pergamino-obras&bbox=-59,-35,-58,-34", { headers: { Cookie: "private=secret", Authorization: "Bearer secret" } });
    const context = { params: Promise.resolve({ path: ["obras", "conteos"] }) };
    const response = await GET(input, context);
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(api.counts).toHaveBeenCalledExactlyOnceWith({ fuente: "pergamino-obras", bbox: [-59, -35, -58, -34] }, { signal: input.signal });
    for (const query of ["cursor=synthetic-page", "limit=20", "unknown=true", "fuente=pergamino-obras&fuente=bahia-obras"]) expect((await GET(new Request("https://example.test/api/public/obras/conteos?" + query), context)).status).toBe(400);
    expect(api.counts).toHaveBeenCalledTimes(1);
    const unlocated = new Request(input.url + "&tieneGeometria=false");
    expect((await GET(unlocated, context)).status).toBe(200);
    expect(api.counts).toHaveBeenLastCalledWith({ fuente: "pergamino-obras", bbox: [-59, -35, -58, -34], tieneGeometria: false }, { signal: unlocated.signal });
    expect((await GET(new Request(unlocated.url + "&tieneGeometria=true"), context)).status).toBe(400);
    expect(api.counts).toHaveBeenCalledTimes(2);
  });
  it("explica obras sin ubicación como no asignables al área y conserva acceso textual", () => {
    const html = renderToStaticMarkup(WorkCountsPanel({ counts, error: null, query: { fuente: "pergamino-obras", bbox: [-59, -35, -58, -34], cursor: "synthetic-page" } }));
    expect(html).toContain("10 obras sin ubicación no pueden asignarse");
    expect(html).toContain("fuente=pergamino-obras&amp;tieneGeometria=false&amp;vista=lista");
    expect(html).toContain("Cada obra se cuenta una vez");
    const unknown = renderToStaticMarkup(WorkCountsPanel({ counts: null, error: "UNAVAILABLE", query: {} }));
    expect(unknown).not.toContain("<dd>"); expect(unknown).toContain("totales son desconocidos");
  });
});
