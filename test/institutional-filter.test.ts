/** @file Comprueba catálogo institucional SSR, identidades conocidas y recuperación independiente sin inventar organizaciones ni usar la API activa. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { InstitutionalOrganizationCatalog } from "../src/api/client";
import { InstitutionalFilter } from "../src/components/institutional-filter";

const id = "50000000-0000-4000-8000-000000000001";
const catalog: InstitutionalOrganizationCatalog = { items: [{ id, nombre: "EJEMPLO SINTÉTICO — Entidad institucional", nivel: "OTRO", partidoId: null }] };

describe("filtros institucionales HTML", () => {
  it("ofrece nombres de catálogo y roles cerrados con fechas originales de consulta", () => {
    const html = renderToStaticMarkup(createElement(InstitutionalFilter, { catalog, query: { organizacionId: id, rolInstitucional: "FINANCIADOR", periodoDesde: "2025-01-01", periodoHasta: "2025-12-31" } }));
    expect(html).toContain("EJEMPLO SINTÉTICO — Entidad institucional");
    expect(html).toContain('name="organizacionId"');
    expect(html).toContain('value="FINANCIADOR" selected=""');
    expect(html).toContain('type="date"');
    expect(html).toContain('value="2025-01-01"');
    expect(html).toContain("No filtra las fechas de inicio o fin de la obra");
    expect(html).not.toContain('type="text"');
  });
  it("una caída conserva la identidad aplicada sin inventar nombre y mantiene rol/período", () => {
    const html = renderToStaticMarkup(createElement(InstitutionalFilter, { catalog: null, query: { organizacionId: id, rolInstitucional: "FINANCIADOR", periodoDesde: "2025-01-01", periodoHasta: "2025-12-31" } }));
    expect(html).toContain("No pudimos cargar las organizaciones");
    expect(html).toContain('type="hidden" name="organizacionId"');
    expect(html).toContain("Reintentar organizaciones");
    expect(html).toContain('name="rolInstitucional"');
    expect(html).not.toContain("Entidad institucional");
  });
  it("un catálogo vacío mantiene la consulta explícita y no ofrece un padrón supuesto", () => {
    const html = renderToStaticMarkup(createElement(InstitutionalFilter, { catalog: { items: [] }, query: {} }));
    expect(html).toContain("No hay organizaciones con roles verificados");
    expect(html).not.toContain("Entidad institucional");
  });
});
