import { expect, test, type Page } from "@playwright/test";
import type { WorkDetail } from "../src/api/client.js";
import { isolateMapNetwork } from "./map-fixture";

const workId = "10000000-0000-4000-8000-000000000001";

function nationalParticipants(executor: string | null, funders: string[]): NonNullable<WorkDetail["nacional"]> {
  return {
    descripcion: null, objetivo: null, duracionDias: null, estadoFuente: null,
    monedaFuente: null, programaFuente: null, sectorFuente: null, tipoProyectoFuente: null,
    referencias: { idproyecto: "EJEMPLO-SINTETICO-1", numeroObra: null, bapin: null, operacionFinanciera: null, perfilObra: null },
    participantes: { ejecutor: executor, financiadores: funders },
    territorio: { provincia: null, departamento: null, codigoBahra: null },
    atributosFuente: { accionClimatica: null, contraparteCuit: null, contraparteModalidad: null, contraparteNombre: null, contraparteRol: null, odsIncidencia: null },
  };
}

async function openSyntheticSummary(page: Page, change: (work: WorkDetail) => void) {
  await isolateMapNetwork(page);
  await page.route(`**/api/public/obras/${workId}?*`, async route => {
    // Only the isolated, read-only fixture server is read or overridden here.
    const response = await route.fetch();
    const work: WorkDetail = await response.json();
    delete work.nacional;
    delete work.municipal;
    delete work.participantes;
    change(work);
    await route.fulfill({ response, json: work });
  });
  await page.goto("/mapa?vista=lista");
  await page.locator(".results-list").getByRole("button", { name: /^Ver resumen/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  return page.getByRole("dialog").locator(".work-responsibility");
}

test("el resumen muestra ejecutor y financiadores con sus roles reportados", async ({ page }) => {
  const roles = await openSyntheticSummary(page, work => {
    work.nacional = nationalParticipants("EJEMPLO SINTÉTICO — Entidad ejecutora", ["EJEMPLO SINTÉTICO — Entidad financiadora"]);
  });
  await expect(roles.getByRole("heading", { name: "Responsabilidades informadas", level: 3 })).toBeVisible();
  await expect(roles).toContainText("Ejecutor reportado");
  await expect(roles).toContainText("EJEMPLO SINTÉTICO — Entidad ejecutora");
  await expect(roles).toContainText("Financiadores reportados");
  await expect(roles).toContainText("EJEMPLO SINTÉTICO — Entidad financiadora");
  await expect(roles).not.toContainText("Área responsable reportada");
});

test("el área municipal conserva su rol sin convertir la jurisdicción en responsable", async ({ page }) => {
  const roles = await openSyntheticSummary(page, work => {
    work.municipal = { areaResponsableReportada: "EJEMPLO SINTÉTICO — Área de obras", jurisdiccionReportada: "EJEMPLO SINTÉTICO — Localidad", estadoFuente: null, lugarReportado: null, tipoFuente: null };
  });
  await expect(roles).toContainText("Área responsable reportada");
  await expect(roles).toContainText("EJEMPLO SINTÉTICO — Área de obras");
  await expect(roles).not.toContainText("EJEMPLO SINTÉTICO — Localidad");
  await expect(roles).not.toContainText("Ejecutor reportado");
  await expect(roles).not.toContainText("Financiadores reportados");
});

test("el resumen informa el faltante sin deducir responsable de fuente o razón social", async ({ page }) => {
  const roles = await openSyntheticSummary(page, work => {
    work.nacional = nationalParticipants(null, []);
    work.participantes = { jurisdiccionReportada: "EJEMPLO SINTÉTICO — Jurisdicción", razonSocial: "EJEMPLO SINTÉTICO — Participante sin rol", cuit: null };
  });
  await expect(roles).toContainText("Responsable no informado por la fuente.");
  await expect(roles.locator("dl")).toHaveCount(0);
  await expect(roles).not.toContainText("EJEMPLO SINTÉTICO — Jurisdicción");
  await expect(roles).not.toContainText("EJEMPLO SINTÉTICO — Participante sin rol");
});
