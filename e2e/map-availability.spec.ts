/** @file Verifica que las publicaciones sin geometría se distingan y sigan siendo consultables, con y sin área. */
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { isolateMapNetwork, useSyntheticBasemap } from "./map-fixture";

const unlocatedId = "10000000-0000-4000-8000-000000000004";
const unlocatedRevision = "20000000-0000-4000-8000-000000000004";
const unlocatedName = "EJEMPLO SINTÉTICO — Obra 04";
const label = "Publicada · Sin ubicación en el mapa";

test.beforeEach(async ({ page }) => {
  await isolateMapNetwork(page);
  await useSyntheticBasemap(page);
});

test("las tarjetas diferencian la publicación de su ausencia en el mapa y permiten abrir resumen y ficha", async ({ page }) => {
  await page.goto("/mapa?vista=lista");
  const unlocated = page.locator(".work-card").filter({ has: page.getByRole("heading", { name: unlocatedName, exact: true }) });
  const located = page.locator(".work-card").first();
  await expect(unlocated.getByText(label, { exact: true })).toBeVisible();
  await expect(unlocated.getByText(/no tiene una ubicación aprobada para dibujar/)).toBeVisible();
  await expect(unlocated.getByRole("button", { name: /^Ver en mapa/ })).toHaveCount(0);
  await expect(located.getByText("Con ubicación en el mapa", { exact: true })).toBeVisible();
  await expect(located.getByText(label, { exact: true })).toHaveCount(0);
  await expect(page.locator(".unlocated-notice")).toContainText("5 obras cargadas no aparecen en el mapa.");
  await page.getByRole("button", { name: "Cargar más obras", exact: true }).click();
  await expect(page.locator(".unlocated-notice")).toContainText("6 obras cargadas no aparecen en el mapa.");
  await expect(page.locator(".results-list").getByText(label, { exact: true })).toHaveCount(6);
  await unlocated.getByRole("button", { name: /^Ver resumen/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(label, { exact: true })).toBeVisible();
  await expect(dialog.getByText(/No aparece en el mapa porque esta revisión/)).toBeVisible();
  await page.keyboard.press("Escape");
  await unlocated.getByRole("link", { name: /^Ver ficha/ }).click();
  await expect(page).toHaveURL(new RegExp(`/obras/${unlocatedId}\\?revisionId=${unlocatedRevision}`));
  await expect(page.getByRole("heading", { name: unlocatedName, exact: true })).toBeVisible();
  await expect(page.getByText(label, { exact: true })).toBeVisible();
  const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(report.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("una consulta por área explica lo que excluye y abre publicaciones sin ubicación conservando filtros", async ({ page }) => {
  await page.goto("/mapa?fuente=nacion-obras&bbox=-58.5,-34.6,-58.2,-34.4&vista=lista");
  await expect(page.locator(".results-list").getByText(label, { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Las obras publicadas sin ubicación no aparecen en una consulta por área/)).toBeVisible();
  const withoutMap = page.getByRole("link", { name: "Ver obras sin ubicación en el mapa", exact: true });
  await expect(withoutMap).toHaveAttribute("href", "/mapa?fuente=nacion-obras&tieneGeometria=false&vista=lista");
  await withoutMap.click();
  await expect(page).toHaveURL(/fuente=nacion-obras&tieneGeometria=false&vista=lista$/);
  await expect(page.getByRole("button", { name: "Lista", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".results-list .work-card")).toHaveCount(4);
  await expect(page.locator(".results-list").getByText(label, { exact: true })).toHaveCount(4);
  await expect(page.locator(".unlocated-notice")).toContainText("Sus fichas siguen disponibles.");
  await expect(page.getByRole("button", { name: /^Ver en mapa/ })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Área del mapa", exact: true })).toHaveCount(0);
});

test("la distinción y el enlace a publicaciones sin ubicación están en el HTML sin JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await isolateMapNetwork(page);
    await page.goto("http://127.0.0.1:3102/mapa?vista=lista");
    await expect(page.locator(".results-list").getByText(label, { exact: true })).toHaveCount(5);
    await page.getByRole("link", { name: "Ver solo obras sin ubicación en el mapa", exact: true }).click();
    await expect(page.locator(".results-list .work-card")).toHaveCount(6);
    await expect(page.locator(".results-list").getByText(label, { exact: true })).toHaveCount(6);
    await page.locator(".work-card").first().getByRole("link", { name: /^Ver ficha/ }).click();
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("las etiquetas mantienen texto legible y reflow con colores forzados y ampliación", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/mapa?tieneGeometria=false&vista=lista");
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await expect(page.locator(".results-list").getByText(label, { exact: true })).toHaveCount(6);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const badge = page.locator(".without-map-location").first();
  expect(await badge.evaluate(element => {
    const style = getComputedStyle(element);
    return style.color !== style.backgroundColor && Number.parseFloat(style.fontSize) >= 28;
  })).toBe(true);
});

test("un resumen histórico sin geometría conserva su vigencia explícita", async ({ page, request }) => {
  const response = await request.get(`/api/public/obras/${unlocatedId}?revisionId=${unlocatedRevision}`);
  expect(response.ok()).toBe(true);
  const work = await response.json();
  await page.route(`**/api/public/obras/${unlocatedId}?*`, route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ ...work, publicadaActualmente: false }),
  }));
  await page.goto("/mapa?tieneGeometria=false&vista=lista");
  await page.locator(".work-card").filter({ has: page.getByRole("heading", { name: unlocatedName, exact: true }) }).getByRole("button", { name: /^Ver resumen/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Revisión sin ubicación en el mapa", { exact: true })).toBeVisible();
  await expect(dialog.getByText(label, { exact: true })).toHaveCount(0);
  await expect(dialog.getByText(/Esta es una revisión histórica/)).toBeVisible();
});
