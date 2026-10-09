/** @file Verifica lectura SSR, omisiones y una geometría municipal aceptada sobre API/cartografía sintéticas aisladas, sin alterar E7. */
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { disableWebGL, expectCanvasMap, hasMapColor, isolateMapNetwork, useSyntheticBasemap } from "./map-fixture";
import { openSourceCoverage } from "./source-coverage-fixture";

test.beforeEach(async ({ page, request }) => {
  expect((await request.get("http://127.0.0.1:4100/__municipal-fixtures?enabled=1&failed=0&changed=0")).ok()).toBe(true);
  await isolateMapNetwork(page);
  await useSyntheticBasemap(page);
  await disableWebGL(page);
});
test.afterEach(async ({ request }) => {
  expect((await request.get("http://127.0.0.1:4100/__municipal-fixtures?enabled=0&failed=0&changed=0")).ok()).toBe(true);
});

test("explica publicaciones sin ubicación y fuente vacía en la cobertura global de fuentes", async ({ page }, info) => {
  await page.goto("/mapa?fuente=pergamino-obras&tieneGeometria=true&bbox=-61,-35,-60,-33&vista=lista");
  const panel = await openSourceCoverage(page);
  const pergamino = panel.locator('[data-source="pergamino-obras"]');
  await expect(pergamino).toContainText("Las publicaciones siguen disponibles en lista y ficha");
  await expect(pergamino.locator("dd")).toHaveText(["2", "0", "2", "0"]);
  const olavarria = panel.locator('[data-source="olavarria-obras"]');
  await expect(olavarria).toContainText("Esta fuente no tiene publicaciones en este corte del catálogo");
  await expect(panel).toContainText("no cambian con filtros, área o paginación");
  await expect(page.locator(".work-card")).toHaveCount(0);
  const listLink = pergamino.getByRole("link", { name: /^Ver listado de esta fuente/ });
  await expect(listLink).toHaveAttribute("href", "/mapa?fuente=pergamino-obras&vista=lista");
  await listLink.click();
  await expect(page.locator(".work-card")).toHaveCount(2);
  await expect(page.locator(".work-card").getByText("Publicada · Sin ubicación en el mapa", { exact: true })).toHaveCount(2);
  await expect(page.getByRole("button", { name: /^Ver en mapa/ })).toHaveCount(0);
  const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(report.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("municipal-coverage-without-location.png"), fullPage: true });
  await page.emulateMedia({ forcedColors: "active" });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await expect(panel).toContainText("Sin ubicación en el mapa");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("una geometría aceptada conserva identidad y se dibuja como marcador municipal Canvas", async ({ page, request }, info) => {
  await page.goto("/mapa?fuente=bahia-obras");
  await expect(page.locator(".work-card")).toHaveCount(1);
  const panel = await openSourceCoverage(page);
  const bahia = panel.locator('[data-source="bahia-obras"]');
  await expect(bahia.locator("dd")).toHaveText(["1", "1", "0", "0"]);
  await expectCanvasMap(page);
  await expect(page.locator(".map-region")).toContainText("1 obra representada · 1 ubicación cargada");
  await expect.poll(() => hasMapColor(page, [148, 104, 0])).toBe(true);
  await page.getByRole("button", { name: /^Ver en mapa/ }).click();
  await expect(page.locator(".selection-strip")).toContainText("EJEMPLO SINTÉTICO — Bahía Blanca con ubicación revisada");
  const expectedId = "10000000-0000-4000-8000-000000000031";
  const expectedRevision = "20000000-0000-4000-8000-000000000031";
  const detail = await (await request.get(`/api/public/obras/${expectedId}?revisionId=${expectedRevision}`)).json();
  const map = await (await request.get("/api/public/geojson?fuente=bahia-obras&bbox=-63,-39,-62,-38")).json();
  expect(detail.ubicaciones[0].condicion).toBe("ACCEPTED");
  expect(map.features).toHaveLength(1);
  expect(map.features[0].properties).toMatchObject({ obraId: expectedId, revisionId: expectedRevision, ubicacionId: detail.ubicaciones[0].ubicacionId });
  expect(map.features[0].geometry).toEqual(detail.ubicaciones[0].geometria);
  await page.screenshot({ path: info.outputPath("municipal-accepted-marker.png") });
});

test("fallas o cortes de catálogo diferentes ocultan cifras y preservan publicaciones", async ({ page, request }) => {
  for (const [failed, changed, expectedText] of [["1", "0", "Error de lectura"], ["0", "1", "No hay un conteo verificable para el mismo corte"]]) {
    expect((await request.get(`http://127.0.0.1:4100/__municipal-fixtures?enabled=1&failed=${failed}&changed=${changed}`)).ok()).toBe(true);
    await page.goto("/mapa?fuente=pergamino-obras&vista=lista");
    const panel = await openSourceCoverage(page);
    await expect(panel).toContainText(expectedText!);
    await expect(panel.locator("dd")).toHaveCount(0);
    await expect(page.locator(".work-card")).toHaveCount(2);
    await expect(panel.getByRole("link", { name: "Actualizar consulta", exact: true })).toBeVisible();
  }
});

test("los totales y enlaces por fuente se consultan sin JavaScript con reflow móvil", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 844 } });
  try {
    const page = await context.newPage();
    await isolateMapNetwork(page);
    await page.goto("http://127.0.0.1:3102/mapa?fuente=pergamino-obras&vista=lista");
    const panel = await openSourceCoverage(page);
    await expect(panel).toContainText("Las publicaciones siguen disponibles en lista y ficha");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await panel.locator('[data-source="bahia-obras"]').getByRole("link", { name: /^Ver listado de esta fuente/ }).click();
    await expect(page.locator(".work-card")).toHaveCount(1);
    await page.locator(".work-card").getByRole("link", { name: /^Ver ficha/ }).click();
    await expect(page.getByRole("heading", { name: "EJEMPLO SINTÉTICO — Bahía Blanca con ubicación revisada", exact: true })).toBeVisible();
  } finally { await context.close(); }
});
