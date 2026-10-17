/** @file Verifica SSR con API sintética mockeada: contadores separados, independencia de catálogos y recuperación sin cifras inventadas. */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reportedRecordFixtures } from "../tools/reported-record-fixtures.mjs";
import { PublicApiError } from "../src/api/client";

const api = vi.hoisted(() => ({ reportedRecords: vi.fn(), reportedRecordCounts: vi.fn(), counts: vi.fn(), sourceCoverage: vi.fn(), provinces: vi.fn(), parties: vi.fn(), localities: vi.fn() }));
vi.mock("../src/lib/public-api", () => ({ publicApi: () => api }));
vi.mock("../src/lib/config", () => ({ indexableSiteUrl: () => null }));
import Page from "../src/app/registros/page";

beforeEach(() => {
  vi.resetAllMocks();
  api.reportedRecords.mockResolvedValue({ items: [reportedRecordFixtures[0]], nextCursor: "next+token", limit: 1, catalogoVersion: "13" });
  api.reportedRecordCounts.mockResolvedValue({ catalogoVersion: "13", totalRegistros: 3, porFuente: [{ codigo: "bahia-obras", cantidad: 3 }], porTipo: [{ tipo: "WORK_RECORD", cantidad: 2 }, { tipo: "COMPLETED_SCHOOL_BUILDING_RECORD", cantidad: 1 }], partidosConRegistros: 1, localidadesConRegistros: 0 });
  api.counts.mockResolvedValue({ catalogoVersion: "7", totalPublicadas: 28 });
  api.sourceCoverage.mockResolvedValue({ fuentes: [{ codigo: "bahia-obras", nombre: "Nombre declarado por backend" }] });
  api.provinces.mockResolvedValue({ items: [{ codigo: "06", nombre: "Buenos Aires" }, { codigo: "78", nombre: "Santa Cruz" }] });
  api.parties.mockResolvedValue({ items: [{ partidoId: "fixture-bahia", nombre: "Bahía Blanca", codigos: { indecDepartamento: "06056" } }] });
  api.localities.mockResolvedValue({ items: [{ codigo: "060560001", nombre: "Bahía Blanca", provinciaCodigo: "06", departamentoCodigo: "06056", departamentoNombre: "Bahía Blanca" }] });
});

describe("lista SSR de registros", () => {
  it("mantiene obras y registros separados aunque los catálogos tengan versiones diferentes", async () => {
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ fuente: "bahia-obras", limit: "1" }) }));
    expect(html).toContain("Registros informados con estos filtros");
    expect(html).toContain(">3</dd>");
    expect(html).toContain(">28</dd>");
    expect(html).not.toContain(">31</dd>");
    expect(html).toContain("Nombre declarado por backend");
    expect(html).toContain("cursor=next%2Btoken");
    expect(html).toContain("Identidad pendiente");
    expect(html).toContain('method="get"');
    expect(api.reportedRecordCounts).toHaveBeenCalledWith({ fuente: "bahia-obras" });
  });

  it("una lectura de conteos obsoleta no reemplaza el total desconocido por cero", async () => {
    api.reportedRecordCounts.mockResolvedValueOnce({ catalogoVersion: "14", totalRegistros: 99 });
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Cantidad desconocida");
    expect(html).not.toContain(">99</dd>");
    expect(html).toContain("EJEMPLO SINTÉTICO");
  });

  it("un cursor obsoleto reinicia conservando filtros sin exhibir resultados de otra página", async () => {
    api.reportedRecords.mockRejectedValueOnce(new PublicApiError(409, { code: "CATALOG_CHANGED", message: "private", requestId: null }));
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ fuente: "bahia-obras", cursor: "old" }) }));
    expect(html).toContain("Reiniciá la consulta");
    expect(html).toContain("/registros?fuente=bahia-obras&amp;limit=25");
    expect(html).not.toContain("EJEMPLO SINTÉTICO");
    expect(html).not.toContain("private");
  });

  it("un filtro privado se rechaza antes de leer la API", async () => {
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ actorId: "secret" }) }));
    expect(html).toContain("Revisá los filtros de registros");
    expect(api.reportedRecords).not.toHaveBeenCalled();
  });

  it("ofrece nombres territoriales sin pedir códigos y mantiene las identidades sólo en la URL", async () => {
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ provinciaCodigo: "06", partidoCodigo: "06056" }) }));
    expect(html).toContain('value="06" selected="">Buenos Aires');
    expect(html).toContain('value="06056" selected="">Bahía Blanca');
    expect(html).toContain('value="060560001">Bahía Blanca · Bahía Blanca');
    expect(html).not.toContain("(código INDEC)");
    expect(api.localities).toHaveBeenCalledWith(["06"]);
    expect(html).toContain('href="/registros?provinciaCodigo=06"');
    expect((html.match(/Cómo interpretar estos datos<\/h2>/g) ?? []).length).toBe(1);
  });

  it("un catálogo nominal caído no borra la lista ni pierde el filtro compartido", async () => {
    api.provinces.mockRejectedValueOnce(new Error("synthetic-failure"));
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ provinciaCodigo: "06" }) }));
    expect(html).toContain("Selección del enlace (06); nombre no disponible");
    expect(html).toContain("EJEMPLO SINTÉTICO");
    expect(html).toContain("Una referencia territorial no pudo cargarse");
  });

  it("una página excesiva ofrece reducir a un registro conservando los filtros", async () => {
    api.reportedRecords.mockRejectedValueOnce(new PublicApiError(413, { code: "RESPONSE_BUDGET", message: "synthetic-only", requestId: null }));
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ fuente: "bahia-obras", provinciaCodigo: "06", cursor: "old" }) }));
    expect(html).toContain("La página contiene textos completos que superan el límite de lectura");
    expect(html).toContain('href="/registros?fuente=bahia-obras&amp;provinciaCodigo=06&amp;limit=1"');
    expect(html).not.toContain("cursor=old");
  });
});
