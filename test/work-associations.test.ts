/** @file Comprueba asociaciones verificadas y roles publicados con fixtures sintéticos, sin inferirlos desde fuente, territorio reportado o nivel institucional. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import examples from "../contracts/examples.json" with { type: "json" };
import catalog from "./fixtures/pba-parties.json" with { type: "json" };
import type { PartyCatalog, WorkDetail, WorkSummary } from "../src/api/client";
import { WorkAssociationSummary, WorkAssociations } from "../src/components/work-associations";

const party = catalog.items.find(item => item.nombre === "Vicente López")!;
const organization = { id: "50000000-0000-4000-8000-000000000001", nombre: "EJEMPLO SINTÉTICO — Entidad revisada", nivel: "MUNICIPAL", partidoId: party.partidoId } as const;
const decisionId = "60000000-0000-4000-8000-000000000001";

/** Construye una revisión sintética con relaciones explícitas y fechas originales, independiente de la fuente y territorio del ejemplo. */
function associatedWork(): WorkDetail {
  return { ...structuredClone(examples.detailPopulated), schemaVersion: "obra@3", asociacionesEspaciales: [{ ubicacionClave: "ubicacion-sintetica", partidoId: party.partidoId, condicion: "VERIFIED", relacion: "CROSSING", evidencia: { geometriaSha256: "a".repeat(64), limitesVersion: "limites-sinteticos-verificacion@1", limitesSha256: "b".repeat(64), metodo: "POSTGIS_INTERSECTION", metodoVersion: "pba-spatial@1", decisionId } }], rolesInstitucionales: [{ organizacion: organization, rol: "FINANCIADOR", condicion: "VERIFIED", vigencia: { inicio: { valor: "2020", precision: "YEAR" }, fin: null }, evidencias: [{ tipo: "REVIEW_DECISION", campo: "rolesInstitucionales", decisionId }], decisionId }] } as WorkDetail;
}

describe("relaciones públicas con evidencia", () => {
  it("muestra faltantes sin convertir territorio o fuente en una asociación verificada", () => {
    const work = { ...associatedWork(), asociacionesEspaciales: [], rolesInstitucionales: [] };
    const html = renderToStaticMarkup(createElement(WorkAssociations, { work }));
    expect(html).toContain("No hay asociaciones espaciales verificadas publicadas");
    expect(html).toContain("No hay roles institucionales verificados publicados");
    expect(html).not.toContain(organization.nombre);
    expect(html).not.toContain("Intersección en PostGIS");
  });
  it("conserva partido y evidencia publicados, precisión YEAR y fechas ausentes", () => {
    const html = renderToStaticMarkup(createElement(WorkAssociations, { work: associatedWork(), partyCatalog: catalog as PartyCatalog }));
    expect(html).toContain("Vicente López");
    expect(html).toContain("Cruza el límite del partido");
    expect(html).toContain("Intersección en PostGIS");
    expect(html).toContain("limites-sinteticos-verificacion@1");
    expect(html).toContain("2020 (solo se conoce el año)");
    expect(html).toContain("Fin de vigencia del rol</dt><dd>No informada");
    expect(html).toContain("FINANCIADOR");
    expect(html).not.toMatch(/vigente actualmente|actor|usuario@|fecha de inicio de la obra/i);
  });
  it("un contratista municipal no se presenta como gestión municipal", () => {
    const work = associatedWork();
    work.rolesInstitucionales[0]!.rol = "CONTRATISTA";
    const summary = { ...structuredClone(examples.listPopulated.items[0]!), asociacionesEspaciales: [], rolesInstitucionales: work.rolesInstitucionales } as WorkSummary;
    const html = renderToStaticMarkup(createElement(WorkAssociationSummary, { work: summary, partyCatalog: catalog as PartyCatalog }));
    expect(html).toContain("Sin roles municipales publicados para esta revisión");
    expect(html).toContain("1 rol institucional verificado");
    expect(html).toContain(`${organization.nombre} (Contratista)`);
  });
  it("la ausencia de nómina no reemplaza ni inventa el nombre del partido", () => {
    const html = renderToStaticMarkup(createElement(WorkAssociations, { work: associatedWork() }));
    expect(html).toContain("Partido del padrón no disponible");
    expect(html).toContain(organization.nombre);
    expect(html).toContain("partidoVerificadoId=");
    expect(html).not.toContain("Vicente López");
  });
});
