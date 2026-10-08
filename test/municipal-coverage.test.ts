/** @file Comprueba conteos de las siete fuentes, versiones compartidas y lecturas municipales sintéticas sin consultar el catálogo activo. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import examples from "../contracts/examples.json" with { type: "json" };
import { createPublicApi, PublicApiError, type MunicipalCoverage, type WorkCounts } from "../src/api/client";
import { SourceCoveragePanel } from "../src/components/source-coverage";
import type { PublicSourceCoverage } from "../src/lib/source-coverage";

const api = vi.hoisted(() => ({ list: vi.fn(), parties: vi.fn(), provinces: vi.fn(), organizations: vi.fn(), municipalCoverage: vi.fn(), counts: vi.fn() }));
vi.mock("../src/lib/public-api", () => ({ publicApi: () => api }));
vi.mock("../src/lib/config", () => ({ mapStyleUrl: () => "https://example.test/style.json", indexableSiteUrl: () => null }));
vi.mock("../src/components/explorer", () => ({ Explorer: () => null }));
import MapPage from "../src/app/mapa/page";
import { GET } from "../src/app/api/public/[...path]/route";

const version = examples.listPopulated.catalogoVersion;
const coverage: MunicipalCoverage = { catalogoVersion: version, fuentes: [
  { fuenteId: "70000000-0000-4000-8000-000000000001", codigo: "bahia-obras", nombre: "EJEMPLO SINTÉTICO — Bahía Blanca", obrasPublicadas: 1, obrasConGeometria: 1, obrasSinGeometria: 0 },
  { fuenteId: "70000000-0000-4000-8000-000000000002", codigo: "olavarria-obras", nombre: "EJEMPLO SINTÉTICO — Olavarría", obrasPublicadas: 0, obrasConGeometria: 0, obrasSinGeometria: 0 },
  { fuenteId: "70000000-0000-4000-8000-000000000003", codigo: "pergamino-obras", nombre: "EJEMPLO SINTÉTICO — Pergamino", obrasPublicadas: 2, obrasConGeometria: 0, obrasSinGeometria: 2 },
] };
const workCounts: WorkCounts = { catalogoVersion: version, totalPublicadas: 3, totalConGeometria: 1, totalSinGeometria: 2, area: null };
const perSource: Record<string, WorkCounts> = {
  "pba-edificios": { ...workCounts, totalPublicadas: 4, totalConGeometria: 3, totalSinGeometria: 1 },
  "nacion-obras": { ...workCounts, totalPublicadas: 5, totalConGeometria: 4, totalSinGeometria: 1 },
  "caba-actualizado": { ...workCounts, totalPublicadas: 0, totalConGeometria: 0, totalSinGeometria: 0 },
  "vl-obras": { ...workCounts, totalPublicadas: 2, totalConGeometria: 0, totalSinGeometria: 2 },
};
beforeEach(() => {
  vi.resetAllMocks();
  api.list.mockResolvedValue(examples.listPopulated);
  api.municipalCoverage.mockResolvedValue(coverage);
  api.counts.mockImplementation(async (query: Record<string, string> = {}) => Object.keys(query).length === 1 && query.fuente ? perSource[query.fuente] : workCounts);
});

/** Recupera props del explorador sin montar el mapa ni crear conexiones reales. */
function explorer(page: ReactElement) {
  return (page.props as { children: ReactElement[] }).children[1]! as ReactElement<{ sourceCoverage: readonly PublicSourceCoverage[]; initial: { catalogoVersion: string } | null }>;
}

describe("cobertura pública por fuente", () => {
  it("valida el contrato municipal existente y mantiene su lectura anónima", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(coverage)));
    const controller = new AbortController();
    await expect(createPublicApi({ fetch: request }).municipalCoverage({ signal: controller.signal })).resolves.toEqual(coverage);
    expect(request).toHaveBeenCalledWith("/api/v1/obras/cobertura-municipal", expect.objectContaining({ credentials: "omit", redirect: "error", signal: controller.signal }));
    for (const body of [{ ...coverage, fuentes: coverage.fuentes.slice(1) }, { ...coverage, fuentes: coverage.fuentes.map((source, index) => index === 2 ? { ...source, obrasPublicadas: 3 } : source) }, { ...coverage, fuentes: [coverage.fuentes[0], coverage.fuentes[0], coverage.fuentes[2]] }]) {
      request.mockResolvedValueOnce(new Response(JSON.stringify(body)));
      await expect(createPublicApi({ fetch: request }).municipalCoverage()).rejects.toMatchObject({ name: "ApiContractError" });
    }
  });

  it("presenta las siete fuentes en el mismo corte y consulta conteos globales por fuente", async () => {
    const page = await MapPage({ searchParams: Promise.resolve({ fuente: "pergamino-obras", estado: "IN_PROGRESS", bbox: "-61,-35,-60,-33", vista: "lista" }) });
    const props = explorer(page).props;
    expect(props.sourceCoverage).toHaveLength(7);
    expect(props.sourceCoverage.every(source => source.estado === "AVAILABLE")).toBe(true);
    expect(props.sourceCoverage.map(source => source.codigo).slice(0, 2)).toEqual(["pba-edificios", "nacion-obras"]);
    expect(api.municipalCoverage).toHaveBeenCalledExactlyOnceWith();
    for (const fuente of ["pba-edificios", "nacion-obras", "caba-actualizado", "vl-obras"]) expect(api.counts).toHaveBeenCalledWith({ fuente });
    const html = renderToStaticMarkup(SourceCoveragePanel({ coverage: props.sourceCoverage, catalogoVersion: props.initial!.catalogoVersion }));
    expect(html).toContain("globales del catálogo público");
    expect(html).toContain("comparten corte con el listado y las fichas");
    expect(html).toContain("Provincia de Buenos Aires · edificios escolares");
    expect(html).toContain("Nación · obras");
    expect(html).toContain("Fuente sin publicaciones");
    expect(html).toContain("Publicadas; sin ubicación en el mapa");
    expect(html).toContain("Las publicaciones siguen disponibles en lista y ficha");
    for (const source of props.sourceCoverage) expect(html).toContain(`href="/mapa?fuente=${source.codigo}&amp;vista=lista"`);
    expect(html).not.toContain("bbox=");
  });

  it("marca como desconocida una fuente cuyo conteo no coincide con el listado", async () => {
    api.counts.mockImplementation(async (query: Record<string, string> = {}) => {
      if (Object.keys(query).length === 1 && query.fuente === "nacion-obras") return { ...perSource[query.fuente], catalogoVersion: "987654321" };
      return Object.keys(query).length === 1 && query.fuente ? perSource[query.fuente] : workCounts;
    });
    const page = await MapPage({ searchParams: Promise.resolve({ vista: "lista" }) });
    const items = explorer(page).props.sourceCoverage;
    expect(items.find(source => source.codigo === "nacion-obras")).toMatchObject({ estado: "UNKNOWN", obrasPublicadas: null });
    expect(items.find(source => source.codigo === "pba-edificios")).toMatchObject({ estado: "AVAILABLE", obrasPublicadas: 4 });
    const html = renderToStaticMarkup(SourceCoveragePanel({ coverage: items, catalogoVersion: version }));
    expect(html).toContain("No hay un conteo verificable para el mismo corte");
    const nationCard = html.split("<li>").find(card => card.includes("Nación · obras"))!;
    expect(nationCard).not.toContain("<dd>");
  });

  it("distingue una diferencia de versión del error de lectura y conserva la lista", async () => {
    api.municipalCoverage.mockResolvedValue({ ...coverage, catalogoVersion: "987654321" });
    api.counts.mockRejectedValue(new TypeError("private-internal-diagnostic"));
    const page = await MapPage({ searchParams: Promise.resolve({ vista: "lista" }) });
    const props = explorer(page).props;
    expect(props.initial).toEqual(examples.listPopulated);
    expect(props.sourceCoverage.filter(source => ["bahia-obras", "olavarria-obras", "pergamino-obras"].includes(source.codigo)).every(source => source.estado === "UNKNOWN")).toBe(true);
    expect(props.sourceCoverage.filter(source => ["pba-edificios", "nacion-obras", "caba-actualizado", "vl-obras"].includes(source.codigo)).every(source => source.estado === "ERROR")).toBe(true);
    const html = renderToStaticMarkup(SourceCoveragePanel({ coverage: props.sourceCoverage, catalogoVersion: version }));
    expect(html).toContain("Desconocido");
    expect(html).toContain("Error de lectura");
    expect(html).not.toContain("private-internal-diagnostic");
  });

  it("admite cobertura municipal BFF anónima, sin caché y rechaza filtros", async () => {
    const input = new Request("https://example.test/api/public/obras/cobertura-municipal", { headers: { Cookie: "private-session=secret", Authorization: "Bearer secret" } });
    const context = { params: Promise.resolve({ path: ["obras", "cobertura-municipal"] }) };
    const response = await GET(input, context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(coverage);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(api.municipalCoverage).toHaveBeenCalledExactlyOnceWith({ signal: input.signal });
    expect((await GET(new Request(input.url + "?fuente=pergamino-obras"), context)).status).toBe(400);
    expect(api.municipalCoverage).toHaveBeenCalledTimes(1);
    api.municipalCoverage.mockRejectedValue(new PublicApiError(413, { code: "RESPONSE_BUDGET", message: "private-diagnostic", requestId: null }));
    expect(await (await GET(input, context)).json()).toEqual({ error: { code: "RESPONSE_BUDGET", message: "No se pudieron cargar los totales municipales dentro del límite de lectura." } });
  });
});
