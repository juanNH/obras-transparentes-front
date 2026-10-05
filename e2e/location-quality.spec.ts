import { expect, test, type Page } from "@playwright/test";
import { disableWebGL, isolateMapNetwork, useSyntheticBasemap } from "./map-fixture";

const workId = "10000000-0000-4000-8000-000000000001";
const revisionId = "20000000-0000-4000-8000-000000000001";
const assumedId = "40000000-0000-4000-8000-000000000001";
const reportedId = "40000000-0000-4000-8000-000000000099";
const approximate = "Ubicación orientativa · precisión no informada";
const explanation = "La fuente no informó el sistema de coordenadas. Se aprobó interpretarlas como WGS84 durante la revisión. El punto no acredita el sitio exacto ni el alcance de la obra.";

async function isolateLocations(page: Page) {
  await isolateMapNetwork(page);
  await useSyntheticBasemap(page);
  await disableWebGL(page);
  await page.route(`**/api/public/obras/${workId}?*`, async route => {
    const response = await route.fetch();
    const detail = await response.json();
    const original = detail.ubicaciones[0];
    detail.ubicaciones = [
      { ...original, clave: "supuesto", ubicacionId: assumedId, geometria: { type: "Point", coordinates: [-58.45, -34.55] }, crs: { codigo: "EPSG:4326", fundamento: "REVIEW_DECISION", condicion: "APPROVED_ASSUMPTION" }, precision: "coordenada_reportada_sin_precision", controles: ["WGS84_ASSUMPTION_APPROVED", "POSTGIS_VALID"] },
      { ...original, clave: "establecimiento", ubicacionId: reportedId, geometria: { type: "Point", coordinates: [-58.40, -34.58] }, crs: { codigo: "EPSG:4326", fundamento: "CATALOG_METADATA", condicion: "REPORTED_REFERENCE" }, precision: "ubicacion_establecimiento_reportada", controles: ["CATALOG_CRS_REFERENCE", "POSTGIS_VALID"] },
    ];
    await route.fulfill({ response, json: detail });
  });
  // The selection loads its geometry from the exact revision, independent of the query layer.
  await page.route("**/api/public/geojson?*", route => route.fulfill({ contentType: "application/json", json: { type: "FeatureCollection", features: [], nextCursor: null, catalogoVersion: "7" } }));
}

test.beforeEach(async ({ page }) => isolateLocations(page));

test("la selección por ubicación conserva calidad, revisión y filtros con teclado y resumen", async ({ page }, testInfo) => {
  await page.goto("/mapa?estado=IN_PROGRESS");
  await page.locator(".results-list").getByRole("button", { name: /^Ver en mapa/ }).first().click();
  const selector = page.getByRole("combobox", { name: "Ubicación para consultar" });
  await expect(selector).toBeVisible();
  await selector.focus();
  await selector.press("Home");
  await selector.press("ArrowDown");
  await expect(selector).toHaveValue(assumedId);
  await expect(selector).toBeFocused();
  await selector.press("ArrowDown");
  await expect(selector).toHaveValue(reportedId);
  await selector.press("ArrowUp");
  await expect(selector).toHaveValue(assumedId);
  await expect(selector).toBeFocused();
  const strip = page.locator(".selection-strip");
  const quality = page.locator(".map-region .selected-location-quality");
  await expect(quality).toBeVisible();
  await expect(quality).toContainText(approximate);
  await expect(quality).toContainText(explanation);
  await expect(quality).not.toContainText("Ubicación reportada del establecimiento");
  const params = new URL(page.url()).searchParams;
  expect(params.get("obra")).toBe(workId);
  expect(params.get("revisionId")).toBe(revisionId);
  expect(params.get("ubicacionId")).toBe(assumedId);
  expect(params.get("estado")).toBe("IN_PROGRESS");
  expect(params.has("bbox")).toBe(false);
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await expect(selector).toHaveValue(assumedId);
  await strip.getByRole("button", { name: "Ver resumen", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(explanation);
  await page.getByRole("button", { name: "Cerrar resumen", exact: true }).click();
  await expect(selector).toHaveValue(assumedId);
  await page.locator(".map-region").screenshot({ path: testInfo.outputPath("ubicacion-orientativa.png") });
  await selector.selectOption(reportedId);
  await expect(quality).toContainText("Ubicación reportada del establecimiento");
  await expect(quality).not.toContainText(approximate);
  await expect(quality).toContainText("informada por el catálogo de origen");
  await page.goBack();
  await expect(selector).toHaveValue(assumedId);
  await expect(quality).toContainText(approximate);
  await page.goForward();
  await expect(selector).toHaveValue(reportedId);
  await page.locator(".results-list").getByRole("button", { name: /^Ver resumen/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("ubicacionId")).toBe(reportedId);
  await page.getByRole("button", { name: "Cerrar resumen", exact: true }).click();
  await page.reload();
  await expect(selector).toHaveValue(reportedId);
  await expect(quality).not.toContainText(approximate);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("una ubicación ajena al detalle no se sustituye por otra aceptada", async ({ page }) => {
  await page.goto(`/mapa?obra=${workId}&revisionId=${revisionId}&ubicacionId=40000000-0000-4000-8000-000000000055`);
  await expect(page.locator(".selection-strip")).toContainText("La ubicación elegida no está aceptada en esta revisión");
  await expect(page.locator(".map-region .location-quality")).toHaveCount(0);
});

test("tocar un punto identifica su ubicación y muestra ayuda persistente sin abrir un modal", async ({ page }) => {
  await page.route("**/api/public/geojson?*", async route => {
    const response = await route.fetch();
    const collection = await response.json();
    const original = collection.features.find((feature: { properties: { obraId: string } }) => feature.properties.obraId === workId);
    collection.features = [{ ...original, id: assumedId, geometry: { type: "Point", coordinates: [-58.45, -34.55] }, properties: { ...original.properties, ubicacionId: assumedId, calidad: { ...original.properties.calidad, crs: { codigo: "EPSG:4326", fundamento: "REVIEW_DECISION", condicion: "APPROVED_ASSUMPTION" }, precision: "coordenada_reportada_sin_precision" } } }];
    collection.nextCursor = null;
    await route.fulfill({ response, json: collection });
  });
  await page.goto("/mapa");
  await expect(page.locator(".map-context")).toContainText("1 obra ubicada");
  await expect(page.getByRole("button", { name: "Acercar mapa", exact: true })).toBeEnabled();
  const canvas = page.locator(".map-canvas");
  await canvas.click({ position: { x: (await canvas.boundingBox())!.width / 2, y: (await canvas.boundingBox())!.height / 2 } });
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".map-region .selected-location-quality")).toContainText(explanation);
  expect(new URL(page.url()).searchParams.get("ubicacionId")).toBe(assumedId);
  if (!test.info().project.use.isMobile) {
    const box = (await canvas.boundingBox())!;
    await canvas.hover({ position: { x: box.width / 2, y: box.height / 2 } });
    await expect(page.getByRole("tooltip")).toContainText(explanation);
    await page.getByRole("tooltip").hover();
    await expect(page.getByRole("tooltip")).toContainText(explanation);
    await page.getByRole("button", { name: "Acercar mapa", exact: true }).focus();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  }
});
