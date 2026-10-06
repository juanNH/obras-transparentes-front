/** @file Comprueba recuperación de 404 reales, enlaces sin JavaScript y reflow con API sintética aislada. */
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { isolateMapNetwork, useSyntheticBasemap } from "./map-fixture";

const firstId = "10000000-0000-4000-8000-000000000001";
const firstRevision = "20000000-0000-4000-8000-000000000001";
const missingId = "10000000-0000-4000-8000-000000000999";
const missingRevision = "20000000-0000-4000-8000-000000000999";

test.beforeEach(async ({ page }) => {
  await isolateMapNetwork(page);
  await useSyntheticBasemap(page);
});

test("rutas ausentes, UUID y revisiones inválidas responden 404 sin mostrar una ficha distinta", async ({ page }) => {
  const paths = [
    "/pagina-inexistente",
    "/obras/no-es-un-uuid",
    `/obras/${missingId}`,
    `/obras/${firstId}?revisionId=no-es-un-uuid`,
    `/obras/${firstId}?revisionId=${missingRevision}`,
    `/obras/${firstId}?revisionId=${firstRevision}&revisionId=${missingRevision}`,
  ];
  for (const path of paths) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: "Explorar el catálogo", exact: true })).toHaveAttribute("href", "/mapa");
    await expect(page.locator("main").getByText(/EJEMPLO SINTÉTICO/)).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  }
});

test("los CTA de recuperación permiten consultar el catálogo o volver al inicio", async ({ page }) => {
  await page.goto("/pagina-inexistente");
  await page.locator("main").getByRole("link", { name: "Explorar el catálogo", exact: true }).click();
  await expect(page).toHaveURL(/\/mapa$/);
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(20);
  await page.goto("/pagina-inexistente");
  await page.locator("main").getByRole("link", { name: "Volver al inicio", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("main h1")).toBeVisible();
});

test("404 conserva accesibilidad y CTA táctiles a 390 y 320 px con texto ampliado", async ({ page }) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/pagina-inexistente");
    await page.evaluate(() => document.fonts.ready);
    const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(report.violations).toEqual([]);
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const action of await page.locator("main .hero-actions a").all()) {
      await expect(action).toBeVisible();
      const bounds = await action.boundingBox();
      expect(bounds?.width).toBeGreaterThanOrEqual(44);
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
      await action.focus();
      await expect(action).toBeFocused();
    }
  }
});

test.describe("recuperación sin JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("abre la lista completa y su ficha sin cargar cartografía externa", async ({ page }) => {
    const mapRequests: string[] = [];
    page.on("request", request => { if (/openfreemap/.test(request.url())) mapRequests.push(request.url()); });
    const paths = [
      "/pagina-inexistente",
      "/obras/no-es-un-uuid",
      `/obras/${missingId}`,
      `/obras/${firstId}?revisionId=no-es-un-uuid`,
      `/obras/${firstId}?revisionId=${missingRevision}`,
      `/obras/${firstId}?revisionId=${firstRevision}&revisionId=${missingRevision}`,
    ];
    for (const path of paths) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator("main").getByRole("link", { name: "Explorar el catálogo", exact: true })).toBeVisible();
      await expect(page.locator("main").getByRole("link", { name: "Consultar sólo la lista", exact: true })).toBeVisible();
    }
    await page.locator("main").getByRole("link", { name: "Consultar sólo la lista", exact: true }).click();
    await expect(page).toHaveURL(/\/mapa\?vista=lista$/);
    await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(20);
    await page.getByRole("link", { name: "Página siguiente sin JavaScript", exact: true }).click();
    await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(4);
    await page.getByRole("link", { name: /^Ver ficha/ }).first().click();
    await expect(page.locator("main h1")).toContainText("EJEMPLO SINTÉTICO");
    await page.getByRole("link", { name: "Enlace permanente a la ficha actual", exact: true }).click();
    await expect(page).toHaveURL(/\/obras\/[a-f0-9-]+$/);
    await expect(page.locator("main h1")).toContainText("EJEMPLO SINTÉTICO");
    expect(mapRequests).toHaveLength(0);
  });
});
