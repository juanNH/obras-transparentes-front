import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { disableWebGL, expectCanvasMap, isolateMapNetwork } from "./map-fixture";

test.beforeEach(async ({ page }) => {
  await isolateMapNetwork(page);
  await disableWebGL(page);
});

test("explica las banderas y los créditos en la página del proyecto", async ({ page }) => {
  await page.goto("/proyecto");
  await expect(page.getByRole("heading", { name: "Por qué usamos estos colores", exact: true })).toBeVisible();
  await expect(page.locator(".project-color-list > li")).toHaveCount(4);
  await expect(page.locator("#colores")).toContainText("Oro del sol del escudo");
  await expect(page.locator("#responsabilidad")).toContainText("La fuente tampoco determina por sí sola quién la ejecuta o la financia.");
  await expect(page.locator("#mapa").getByRole("link", { name: "OpenFreeMap", exact: true })).toHaveAttribute("href", "https://openfreemap.org/");
  await expect(page.locator("#mapa")).toContainText("permanecen visibles junto al mapa");
  await page.setViewportSize({ width: 320, height: 900 });
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await page.evaluate(() => document.fonts.ready);
  // Each heading must also reflow inside its card, including its symbol.
  const headingOverflow = await page.locator(".project-color-list strong").evaluateAll(headings => headings.some(heading => {
    const card = heading.parentElement!;
    const style = getComputedStyle(card);
    const contentWidth = card.getBoundingClientRect().width - [style.paddingLeft, style.paddingRight, style.borderLeftWidth, style.borderRightWidth].reduce((sum, value) => sum + Number.parseFloat(value), 0);
    return heading.scrollWidth > heading.clientWidth || heading.getBoundingClientRect().width > contentWidth;
  }));
  expect(headingOverflow).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(report.violations).toEqual([]);
});

test("omite sólo la marca opcional y mantiene los créditos visibles del mapa", async ({ page }) => {
  // Synthetic geography with the attribution text supplied by real TileJSON.
  await page.route("https://tiles.openfreemap.org/**", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      version: 8,
      sources: { synthetic: {
        type: "geojson",
        attribution: '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank">© OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
        data: { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[-59, -35], [-58, -34]] } }] },
      } },
      layers: [{ id: "background", type: "background", paint: { "background-color": "#edf0e6" } }, { id: "road", type: "line", source: "synthetic", paint: { "line-color": "#c4b99c" } }],
    }),
  }));
  await page.goto("/mapa?bbox=-58.451,-34.551,-58.449,-34.549");
  await expectCanvasMap(page);
  const attribution = page.getByRole("group", { name: "Atribución del mapa", exact: true });
  await expect(attribution.getByRole("link", { name: "OpenFreeMap", exact: true })).toHaveCount(0);
  await expect(attribution.getByRole("link", { name: "© OpenMapTiles", exact: true })).toBeVisible();
  await expect(attribution.getByRole("link", { name: "OpenStreetMap", exact: true })).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
  await expect(page.getByRole("link", { name: "Créditos del mapa", exact: true })).toHaveAttribute("href", "/proyecto#mapa");
});
