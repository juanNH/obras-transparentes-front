/** @file Comprueba HTML territorial accesible, selección múltiple y valores GET sin JavaScript con catálogos sintéticos; no consulta servicios ni acredita cobertura de obras. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PartyCatalog, ProvinceCatalog } from "../src/api/client";
import { PartyFilter } from "../src/components/party-filter";
import { ProvinceFilter } from "../src/components/province-filter";
import fixture from "./fixtures/pba-parties.json" with { type: "json" };

const parties = fixture as PartyCatalog;
const first = parties.items[0]!;
const second = parties.items[1]!;
const unknownParty = "10000000-0000-4000-8000-000000000001";
const provinces: ProvinceCatalog = {
  version: "provincias@2",
  consultadoEn: "2026-10-06",
  fuentes: parties.fuentes,
  items: [
    { codigo: "02", nombre: "Ciudad Autónoma de Buenos Aires", tipo: "CIUDAD_AUTONOMA" },
    { codigo: "06", nombre: "Buenos Aires", tipo: "PROVINCIA" },
  ],
};

/** Obtiene controles HTML de un nombre para comprobar los valores que el formulario nativo conserva. */
function namedInputs(html: string, name: string): string[] {
  return (html.match(/<input\b[^>]*>/g) ?? []).filter(input => input.includes(`name="${name}"`));
}

describe("partidos reportados en formulario HTML", () => {
  it("ofrece los 135 checkboxes nativos con dos seleccionados y filtros verificados separados", () => {
    const html = renderToStaticMarkup(createElement(PartyFilter, {
      catalog: parties,
      partidos: [first.partidoId, second.partidoId],
      partidoVerificadoId: first.partidoId,
      gestionMunicipalId: second.partidoId,
    }));
    const inputs = namedInputs(html, "partidos");
    expect(inputs).toHaveLength(135);
    expect(inputs.every(input => input.includes('type="checkbox"') && !input.includes("disabled"))).toBe(true);
    expect(inputs.filter(input => input.includes('checked=""'))).toHaveLength(2);
    expect(html).toContain("<legend>Partidos de Buenos Aires</legend>");
    expect(html).toContain('aria-label="Partidos seleccionados"');
    expect(html).toContain('<details class="party-picker">');
    expect(html).toContain("Seleccionar partidos");
    expect(html.indexOf('aria-label="Partidos seleccionados"')).toBeLessThan(html.indexOf('<details class="party-picker">'));
    expect(html).toContain('<details class="territorial-advanced" open="">');
    expect(html).toContain(`aria-label="Quitar ${first.nombre} del filtro de partidos"`);
    expect(html).toContain('type="button"');
    expect(html).toContain("Limpiar partidos");
    expect(html).toContain('name="partidoVerificadoId"');
    expect(html).toContain('name="gestionMunicipalId"');
    expect(html).not.toContain('name="partidoId"');
    expect(html).toContain("La nómina completa está disponible");
  });

  it("respeta la selección múltiple explícita y acepta el UUID escalar legado cuando está sola", () => {
    const legacyHtml = renderToStaticMarkup(createElement(PartyFilter, { catalog: parties, partidoId: first.partidoId }));
    const legacyChecked = namedInputs(legacyHtml, "partidos").filter(input => input.includes('checked=""'));
    expect(legacyChecked).toHaveLength(1);
    expect(legacyChecked[0]).toContain(`value="${first.partidoId}"`);
    const arrayHtml = renderToStaticMarkup(createElement(PartyFilter, { catalog: parties, partidos: [], partidoId: first.partidoId }));
    expect(namedInputs(arrayHtml, "partidos").filter(input => input.includes('checked=""'))).toHaveLength(0);
    expect(arrayHtml).toContain("Todos los partidos.");
    expect(arrayHtml).toContain('<details class="territorial-advanced">');
    expect(arrayHtml).not.toContain('<details class="territorial-advanced" open="">');
  });

  it("conserva IDs múltiples y filtros independientes cuando la nómina falla", () => {
    const html = renderToStaticMarkup(createElement(PartyFilter, {
      catalog: null,
      partidos: [first.partidoId, second.partidoId],
      partidoVerificadoId: first.partidoId,
      gestionMunicipalId: second.partidoId,
    }));
    expect(namedInputs(html, "partidos")).toHaveLength(2);
    expect(namedInputs(html, "partidos").every(input => input.includes('type="hidden"'))).toBe(true);
    expect(html).toContain(`value="${first.partidoId}"`);
    expect(html).toContain(`value="${second.partidoId}"`);
    expect(html).toContain("Reintentar nómina de partidos");
    expect(html).toContain('name="partidoVerificadoId"');
    expect(html).toContain('name="gestionMunicipalId"');
  });

  it("mantiene una identidad ausente en el padrón y omite reportados cuando showReported es false", () => {
    const html = renderToStaticMarkup(createElement(PartyFilter, { catalog: parties, partidos: [unknownParty] }));
    expect(namedInputs(html, "partidos").find(input => input.includes(`value="${unknownParty}"`))).toContain('type="hidden"');
    expect(html).toContain("Partido no disponible en esta versión");
    const hiddenHtml = renderToStaticMarkup(createElement(PartyFilter, { catalog: parties, partidos: [first.partidoId], showReported: false }));
    expect(namedInputs(hiddenHtml, "partidos")).toEqual([]);
    expect(hiddenHtml).toContain('name="partidoVerificadoId"');
    expect(hiddenHtml).toContain('name="gestionMunicipalId"');
  });

  it("limita el resumen a seis chips y conserva todas las selecciones en controles HTML exitosos", () => {
    const ids = parties.items.map(party => party.partidoId);
    const html = renderToStaticMarkup(createElement(PartyFilter, { catalog: parties, partidos: ids }));
    const visibleList = html.match(/<ul class="party-selected" aria-label="Partidos seleccionados">([\s\S]*?)<\/ul>/)?.[1] ?? "";
    expect(visibleList.match(/<li\b/g)).toHaveLength(6);
    expect(html).toContain('<details class="party-selected-overflow">');
    expect(html).toContain("Ver todos los partidos seleccionados");
    expect(html).toContain('aria-label="Otros partidos seleccionados"');
    expect(namedInputs(html, "partidos")).toHaveLength(135);
    expect(namedInputs(html, "partidos").filter(input => input.includes('checked=""'))).toHaveLength(135);
    expect(html).toContain(`aria-label="Quitar ${parties.items[134]!.nombre} del filtro de partidos"`);
  });
});

describe("provincia en formulario HTML", () => {
  it("ofrece PBA y CABA sin selección inicial ni valor oculto que restrinja el catálogo global", () => {
    const html = renderToStaticMarkup(createElement(ProvinceFilter, { catalog: provinces }));
    const inputs = namedInputs(html, "provinciaCodigo");
    expect(inputs).toHaveLength(2);
    expect(inputs.every(input => input.includes('type="checkbox"') && !input.includes("disabled") && !input.includes('checked=""'))).toBe(true);
    expect(inputs.some(input => input.includes('type="hidden"'))).toBe(false);
    expect(html).toContain("<legend>Provincia o ciudad autónoma</legend>");
    expect(html).toContain("Buenos Aires");
    expect(html).toContain("Ciudad Autónoma de Buenos Aires");
    expect(html).toContain("Sin selección, se muestran todas las obras.");
  });

  it("una falla conserva el catálogo global sin forzar PBA y ofrece reintento independiente", () => {
    const html = renderToStaticMarkup(createElement(ProvinceFilter, { catalog: null }));
    expect(namedInputs(html, "provinciaCodigo")).toEqual([]);
    expect(html).toContain("Se conserva la selección actual");
    expect(html).toContain("Reintentar nómina provincial");
    expect(html).toContain('type="button"');
  });

  it("conserva códigos explícitos cuando falla la nómina, incluyendo CABA sin agregar una selección PBA", () => {
    const html = renderToStaticMarkup(createElement(ProvinceFilter, { catalog: null, provinciaCodigo: ["02"] }));
    const inputs = namedInputs(html, "provinciaCodigo");
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toContain('type="hidden"');
    expect(inputs[0]).toContain('value="02"');
    expect(inputs[0]).not.toContain('value="06"');
  });

  it("habilita ambas jurisdicciones preservando el código y la identidad autónoma de CABA", () => {
    const html = renderToStaticMarkup(createElement(ProvinceFilter, { catalog: provinces, provinciaCodigo: ["02"] }));
    const inputs = namedInputs(html, "provinciaCodigo");
    expect(inputs).toHaveLength(2);
    expect(inputs.every(input => input.includes('type="checkbox"') && !input.includes("disabled"))).toBe(true);
    expect(inputs.find(input => input.includes('value="02"'))).toContain('checked=""');
    expect(inputs.find(input => input.includes('value="06"'))).not.toContain('checked=""');
    expect(html).toContain("Ciudad Autónoma de Buenos Aires");
    expect(html).toContain("mantiene su identidad propia");
  });
});
