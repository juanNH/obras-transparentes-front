/** @file Verifica asociaciones y roles sintéticos publicados, filtros aditivos/compartibles, evidencia SSR y reflow sin consultar ni escribir la API activa. */
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import catalog from "../test/fixtures/pba-parties.json" with { type: "json" };
import { isolateMapNetwork, useSyntheticBasemap } from "./map-fixture";

const verified = catalog.items.find(party => party.nombre === "Vicente López")!;
const reported = catalog.items.find(party => party.nombre === "25 de Mayo")!;
const organizationId = "50000000-0000-4000-8000-000000000001";
const workId = "10000000-0000-4000-8000-000000000003";
const workName = "EJEMPLO SINTÉTICO — Obra 03";

test.beforeEach(async ({ page }) => { await isolateMapNetwork(page); await useSyntheticBasemap(page); });

test("la tarjeta separa territorio reportado de asociación espacial y gestión verificada", async ({ page }) => {
  await page.goto("/mapa?vista=lista");
  const card = page.locator(".work-card").filter({ has: page.getByRole("heading", { name: workName, exact: true }) });
  await expect(card).toContainText("Territorio informado por la fuente:");
  await expect(card).toContainText("25 de Mayo");
  await expect(card).toContainText("Ubicación territorial verificada: Vicente López");
  await expect(card).toContainText("Gestión municipal verificada: EJEMPLO SINTÉTICO — Organización municipal revisada (Financiador)");
  const first = page.locator(".work-card").first();
  await expect(first).toContainText("Sin asociaciones publicadas para esta revisión");
  await expect(first).toContainText("Sin roles municipales publicados para esta revisión");
});

test("los seis filtros explícitos se conservan al aplicar, recargar y alternar vistas", async ({ page }, info) => {
  await page.goto("/mapa?vista=lista");
  await page.getByText("Filtrar obras", { exact: true }).click();
  await page.locator(".party-picker > summary").click();
  await page.getByRole("checkbox", { name: reported.nombre, exact: true }).check();
  await page.getByText("Filtros territoriales avanzados", { exact: true }).click();
  await page.getByRole("combobox", { name: "Partido con ubicación verificada", exact: true }).selectOption(verified.partidoId);
  await page.getByRole("combobox", { name: "Gestión municipal verificada", exact: true }).selectOption(verified.partidoId);
  await page.getByText("Filtros institucionales", { exact: true }).click();
  await page.getByRole("combobox", { name: "Organización institucional verificada", exact: true }).selectOption(organizationId);
  await page.getByRole("combobox", { name: "Rol institucional verificado", exact: true }).selectOption("FINANCIADOR");
  await page.getByLabel("Vigencia del rol desde", { exact: true }).fill("2025-01-01");
  await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  expect(new URL(page.url()).searchParams.has("periodoDesde")).toBe(false);
  expect(await page.getByLabel("Vigencia del rol hasta", { exact: true }).evaluate(input => (input as HTMLInputElement).validity.valueMissing)).toBe(true);
  await page.getByLabel("Vigencia del rol hasta", { exact: true }).fill("2025-12-31");
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `artifacts/local-validation/asociaciones-obras/filtros-${info.project.name}.png`, fullPage: true });
  await page.locator(".institutional-filter").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `artifacts/local-validation/asociaciones-obras/filtros-viewport-${info.project.name}.png` });
  await page.locator(".institutional-filter").screenshot({ path: `artifacts/local-validation/asociaciones-obras/fieldset-${info.project.name}.png` });
  await page.locator(".filter-group > summary").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `artifacts/local-validation/asociaciones-obras/partidos-viewport-${info.project.name}.png` });
  await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: workName, exact: true })).toBeVisible();
  const expected = { partidos: reported.partidoId, partidoVerificadoId: verified.partidoId, gestionMunicipalId: verified.partidoId, organizacionId: organizationId, rolInstitucional: "FINANCIADOR", periodoDesde: "2025-01-01", periodoHasta: "2025-12-31" };
  expect(new URL(page.url()).searchParams.has("provinciaCodigo")).toBe(false);
  for (const [key, value] of Object.entries(expected)) expect(new URL(page.url()).searchParams.get(key)).toBe(value);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await expect(page.locator(".map-region canvas").first()).toBeVisible();
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await page.reload();
  for (const [key, value] of Object.entries(expected)) expect(new URL(page.url()).searchParams.get(key)).toBe(value);
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(1);
  await page.locator(".filter-group > summary").click();
  await page.locator(".party-picker > summary").click();
  await expect(page.getByRole("checkbox", { name: reported.nombre, exact: true })).toBeChecked();
  const savedSelectors = [["Partido con ubicación verificada", verified.partidoId], ["Gestión municipal verificada", verified.partidoId], ["Organización institucional verificada", organizationId], ["Rol institucional verificado", "FINANCIADOR"]] as const;
  for (const [name, value] of savedSelectors) await expect(page.getByRole("combobox", { name, exact: true })).toHaveValue(value);
  await expect(page.getByLabel("Vigencia del rol desde", { exact: true })).toHaveValue("2025-01-01");
  await expect(page.getByLabel("Vigencia del rol hasta", { exact: true })).toHaveValue("2025-12-31");
});

test("un período sin solapamiento conserva los filtros y explica el vacío", async ({ page }) => {
  await page.goto(`/mapa?vista=lista&organizacionId=${organizationId}&rolInstitucional=FINANCIADOR&periodoDesde=2030-01-01&periodoHasta=2030-12-31`);
  await expect(page.getByRole("heading", { name: "No hay obras para mostrar" })).toBeVisible();
  await expect(page.locator(".scope-note")).toContainText("Solapamiento de vigencia del rol");
  await expect(page.locator(".scope-note")).toContainText("no transforma las fechas desconocidas en vigencias ilimitadas");
});

test("la ficha y el resumen muestran evidencia y precisión original con reflow accesible", async ({ page }, info) => {
  await page.goto(`/obras/${workId}`);
  await expect(page.getByRole("heading", { name: "Ubicación territorial verificada", exact: true })).toBeVisible();
  await expect(page.locator(".work-associations")).toContainText("Vicente López");
  await page.getByText("Evidencia de la asociación espacial", { exact: true }).click();
  await expect(page.locator(".work-associations")).toContainText("limites-sinteticos-verificacion@1");
  await expect(page.locator(".institutional-roles")).toContainText("2020 (solo se conoce el año)");
  await page.getByText("Evidencia del rol verificado", { exact: true }).click();
  const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(report.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `artifacts/local-validation/asociaciones-obras/ficha-${info.project.name}.png`, fullPage: true });
  await page.goto("/mapa?vista=lista");
  await page.locator(".work-card").filter({ has: page.getByRole("heading", { name: workName, exact: true }) }).getByRole("button", { name: /^Ver resumen/ }).click();
  await expect(page.getByRole("dialog").locator(".institutional-roles")).toContainText("Financiador verificado");
});

test("sin JavaScript la ficha y filtros institucionales conservan el contrato", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await isolateMapNetwork(page);
  await page.goto(`http://127.0.0.1:3102/obras/${workId}`);
  await expect(page.locator(".work-associations")).toContainText("Vicente López");
  await expect(page.locator(".institutional-roles")).toContainText("Financiador verificado");
  await page.goto("http://127.0.0.1:3102/mapa?vista=lista");
  await page.getByText("Filtrar obras", { exact: true }).click();
  await page.getByText("Filtros territoriales avanzados", { exact: true }).click();
  await page.getByRole("combobox", { name: "Gestión municipal verificada", exact: true }).selectOption(verified.partidoId);
  await page.getByText("Filtros institucionales", { exact: true }).click();
  await page.getByRole("combobox", { name: "Organización institucional verificada", exact: true }).selectOption(organizationId);
  await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(2);
  expect(new URL(page.url()).searchParams.get("gestionMunicipalId")).toBe(verified.partidoId);
  await context.close();
});
