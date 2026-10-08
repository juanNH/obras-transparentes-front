/** @file Comprueba navegación por cada fuente y evidencia JSON con API y cartografía sintéticas aisladas, sin publicaciones reales. */
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { isolateMapNetwork } from "./map-fixture";

test.beforeEach(async ({ page }) => {
  await isolateMapNetwork(page);
});

for (const [source, label, expectedCards] of [
  ["pba-edificios", "Provincia de Buenos Aires · edificios escolares", 0],
  ["nacion-obras", "Nación · obras", 16],
  ["caba-actualizado", "CABA · obras", 8],
  ["vl-obras", "Vicente López · obras", 0],
  ["bahia-obras", "Municipalidad de Bahía Blanca", 0],
  ["olavarria-obras", "Municipalidad de Olavarría", 0],
  ["pergamino-obras", "Municipalidad de Pergamino", 0],
] as const)
  test(`abre un listado limpio para ${source} sin inventar cobertura`, async ({ page, request }) => {
    const response = await request.get(`/mapa?fuente=${source}&vista=lista`);
    expect(response.ok()).toBe(true);
    expect(await response.text()).toContain(label);
    await page.goto(`/mapa?fuente=${source}&vista=lista`);
    await expect(page.locator("main h1")).toBeVisible();
    const select = page.getByRole("combobox", { name: "Fuente pública", exact: true });
    await expect(select).toHaveValue(source);
    await expect(select.getByRole("option", { name: label, exact: true })).toHaveCount(1);
    await page.getByRole("button", { name: "Ver listado", exact: true }).click();
    await expect(page).toHaveURL(`/mapa?fuente=${source}&vista=lista`);
    await expect(page.locator(".work-card")).toHaveCount(expectedCards);
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

test("la navegación principal ofrece listados directos de Provincia y Nación", async ({ page }) => {
  await page.goto("/mapa?estado=IN_PROGRESS&bbox=-61,-35,-60,-33&vista=lista");
  const navigation = page.getByRole("navigation", { name: "Navegación principal", exact: true });
  await expect(navigation.getByRole("link", { name: "Provincia", exact: true })).toHaveAttribute("href", "/mapa?fuente=pba-edificios&vista=lista");
  await expect(navigation.getByRole("link", { name: "Nación", exact: true })).toHaveAttribute("href", "/mapa?fuente=nacion-obras&vista=lista");
  await navigation.getByRole("link", { name: "Provincia", exact: true }).click();
  await expect(page).toHaveURL("/mapa?fuente=pba-edificios&vista=lista");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("muestra referencia JSON y fuente municipal en un resumen sin ubicación aprobada", async ({ page }, testInfo) => {
  await page.route("**/api/public/obras/**", async route => {
    const response = await route.fetch();
    const work = await response.json();
    work.fuentes[0].codigo = "pergamino-obras";
    work.ubicaciones = [];
    work.procedencia.nombre = {
      regla: "PRESERVE_ORIGINAL", version: "pergamino-obras@1", evidencias: [{
        tipo: "SOURCE_CELL", registroOrigenId: "10000000-0000-4000-8000-000000000002",
        resultadoRegistroId: "10000000-0000-4000-8000-000000000003",
        recursoId: "10000000-0000-4000-8000-000000000004", columna: "Nombre", posicion: 1,
        localizador: { format: "JSON", pointer: "/4", dataOrdinal: 5, byteStart: 120, byteEndExclusive: 340 },
      }],
    };
    await route.fulfill({ response, json: work });
  });
  await page.goto("/mapa?vista=lista");
  await page.getByRole("button", { name: /^Ver resumen/ }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Datos de: Municipios");
  await expect(dialog).toContainText("Municipalidad de Pergamino");
  await expect(dialog).toContainText("Sin ubicación en el mapa");
  await dialog.getByText("Procedencia de los datos", { exact: true }).click();
  await dialog.getByText("Nombre", { exact: true }).click();
  const jsonReference = dialog.getByText("JSON · registro 5 · referencia /4 · bytes 120 a 340 (fin exclusivo).", { exact: true });
  await jsonReference.scrollIntoViewIfNeeded();
  await expect(jsonReference).toBeInViewport();
  await expect(dialog).not.toContainText("undefined");
  const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(report.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("municipal-json-summary.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});
