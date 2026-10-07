/** @file Comprueba el contrato, alcance global, fallo independiente y consistencia de catálogo de cobertura municipal con fixtures sintéticos. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import examples from "../contracts/examples.json" with { type: "json" };
import { createPublicApi, PublicApiError, type MunicipalCoverage } from "../src/api/client";
import { MunicipalCoveragePanel } from "../src/components/municipal-coverage";

const api = vi.hoisted(() => ({ list: vi.fn(), parties: vi.fn(), provinces: vi.fn(), organizations: vi.fn(), municipalCoverage: vi.fn() }));
vi.mock("../src/lib/public-api", () => ({ publicApi: () => api }));
vi.mock("../src/lib/config", () => ({ mapStyleUrl: () => "https://example.test/style.json", indexableSiteUrl: () => null }));
vi.mock("../src/components/explorer", () => ({ Explorer: () => null }));
import MapPage from "../src/app/mapa/page";
import { GET } from "../src/app/api/public/[...path]/route";

const coverage: MunicipalCoverage = { catalogoVersion: examples.listPopulated.catalogoVersion, fuentes: [
  { fuenteId: "70000000-0000-4000-8000-000000000001", codigo: "bahia-obras", nombre: "EJEMPLO SINTÉTICO — Bahía Blanca", obrasPublicadas: 1, obrasConGeometria: 1, obrasSinGeometria: 0 },
  { fuenteId: "70000000-0000-4000-8000-000000000002", codigo: "olavarria-obras", nombre: "EJEMPLO SINTÉTICO — Olavarría", obrasPublicadas: 0, obrasConGeometria: 0, obrasSinGeometria: 0 },
  { fuenteId: "70000000-0000-4000-8000-000000000003", codigo: "pergamino-obras", nombre: "EJEMPLO SINTÉTICO — Pergamino", obrasPublicadas: 2, obrasConGeometria: 0, obrasSinGeometria: 2 },
] };
beforeEach(() => { vi.resetAllMocks(); api.list.mockResolvedValue(examples.listPopulated); api.municipalCoverage.mockResolvedValue(coverage); });

/** Recupera el panel HTML de la página sin ejecutar navegación ni clientes de mapa. */
function panel(page: ReactElement) {
  const heading = (page.props as { children: ReactElement[] }).children[0]!;
  return (heading.props as { children: ReactElement[] }).children.at(-1)! as ReactElement<Parameters<typeof MunicipalCoveragePanel>[0]>;
}

describe("cobertura municipal pública", () => {
  it("lee totales sin filtros ni credenciales y valida el esquema del backend", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(coverage)));
    const controller = new AbortController();
    await expect(createPublicApi({ fetch: request }).municipalCoverage({ signal: controller.signal })).resolves.toEqual(coverage);
    expect(request).toHaveBeenCalledWith("/api/v1/obras/cobertura-municipal", expect.objectContaining({ credentials: "omit", redirect: "error", signal: controller.signal }));
    for (const body of [{ ...coverage, fuentes: coverage.fuentes.slice(1) }, { ...coverage, fuentes: coverage.fuentes.map((source, index) => index === 2 ? { ...source, obrasPublicadas: 3 } : source) }, { ...coverage, fuentes: [coverage.fuentes[0], coverage.fuentes[0], coverage.fuentes[2]] }]) {
      request.mockResolvedValueOnce(new Response(JSON.stringify(body)));
      await expect(createPublicApi({ fetch: request }).municipalCoverage()).rejects.toMatchObject({ name: "ApiContractError" });
    }
  });
  it("conserva el alcance global aunque lista tenga filtros por área, estado y fuente", async () => {
    const page = await MapPage({ searchParams: Promise.resolve({ fuente: "pergamino-obras", estado: "IN_PROGRESS", bbox: "-61,-35,-60,-33", vista: "lista" }) });
    expect(api.municipalCoverage).toHaveBeenCalledExactlyOnceWith();
    expect(panel(page).props.coverage).toEqual(coverage);
    expect(panel(page).props.error).toBeNull();
    const html = renderToStaticMarkup(MunicipalCoveragePanel(panel(page).props));
    expect(html).toContain("no cambian con los filtros ni el área");
    expect(html).toContain("fuente=pergamino-obras&amp;vista=lista");
    expect(html).not.toContain("bbox=");
    expect(html).toContain("todavía no tiene obras publicadas");
    expect(html).toContain("Sus obras están publicadas");
  });
  it("no mezcla cifras de distintas publicaciones y conserva las obras iniciales", async () => {
    api.municipalCoverage.mockResolvedValue({ ...coverage, catalogoVersion: "987654321" });
    const page = await MapPage({ searchParams: Promise.resolve({ vista: "lista" }) });
    expect(panel(page).props).toEqual({ coverage: null, error: "CATALOG_CHANGED" });
    const explorer = (page.props as { children: ReactElement[] }).children[1]!;
    expect((explorer.props as { initial: unknown }).initial).toEqual(examples.listPopulated);
    expect(renderToStaticMarkup(MunicipalCoveragePanel(panel(page).props))).toContain("El catálogo cambió");
  });
  it("conserva la exploración ante fallo de totales sin convertir desconocido en cero", async () => {
    api.municipalCoverage.mockRejectedValue(new TypeError("private-internal-diagnostic"));
    const page = await MapPage({ searchParams: Promise.resolve({}) });
    expect(panel(page).props).toEqual({ coverage: null, error: "UNAVAILABLE" });
    const html = renderToStaticMarkup(MunicipalCoveragePanel(panel(page).props));
    expect(html).toContain("no significa que sean cero");
    expect(html).not.toContain("private-internal-diagnostic");
    expect(html).not.toContain("<dd>");
  });
  it("admite cobertura BFF anónima, sin caché y rechaza todos los filtros", async () => {
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
