/** @file Verifica selección de 135 partidos, búsqueda sin red, URLs y alternativa HTML con obras sintéticas aisladas. */
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import catalog from "../test/fixtures/pba-parties.json" with { type: "json" };
import { isolateMapNetwork, useSyntheticBasemap } from "./map-fixture";

const first = catalog.items.find(party => party.nombre === "25 de Mayo")!;
const empty = catalog.items.find(party => party.nombre === "Capitán Sarmiento")!;

test.beforeEach(async ({ page }) => { await isolateMapNetwork(page); await useSyntheticBasemap(page); });

test("la nómina completa y la búsqueda local aplican sólo la identidad del partido", async ({ page, request }) => {
  const baseline = ((await (await request.get("http://127.0.0.1:4100/__requests")).json()).requests as { path: string }[]).length;
  await page.goto("/mapa?vista=lista");
  await page.getByText("Filtrar obras", { exact: true }).click();
  const selector = page.getByRole("combobox", { name: "Partido de Buenos Aires", exact: true });
  await expect(selector.locator("option")).toHaveCount(136);
  await expect(selector.locator("option").first()).toHaveText("Sin filtro por partido");
  await page.getByRole("searchbox", { name: "Buscar partido (opcional)", exact: true }).fill("ZARATE");
  await expect(selector.locator("option")).toHaveCount(2);
  await expect(selector.locator("option").last()).toHaveText("Zárate");
  await page.getByRole("searchbox").fill("");
  await selector.selectOption(first.partidoId);
  const records = ((await (await request.get("http://127.0.0.1:4100/__requests")).json()).requests as { path: string }[]).slice(baseline);
  expect(records.filter(entry => entry.path === "/api/v1/territorios/pba/partidos")).toHaveLength(1);
  expect(records.filter(entry => entry.path === "/api/v1/obras")).toHaveLength(1);
  await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("partidoId=" + first.partidoId));
  const params = new URL(page.url()).searchParams;
  expect(params.has("municipioCodigo")).toBe(false);
  expect(params.has("territorioEsquema")).toBe(false);
  expect(params.has("bbox")).toBe(false);
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(12);
  await expect(page.locator(".scope-note")).toContainText("Partido informado por la fuente: 25 de Mayo");
  await expect(page.locator(".scope-note")).toContainText("no acredita ubicación espacial verificada ni gestión municipal");
  await page.getByText(/Filtrar obras/).first().click();
  const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(report.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("un partido sin publicaciones mantiene 135 opciones y explica la brecha", async ({ page }) => {
  await page.goto("/mapa?vista=lista&partidoId=" + empty.partidoId);
  await expect(page.getByRole("heading", { name: "No hay obras para mostrar" })).toBeVisible();
  await expect(page.locator(".empty-state")).toContainText("Esto no significa que no existan obras en el territorio.");
  await page.getByText(/Filtrar obras/).first().click();
  await expect(page.getByRole("combobox", { name: "Partido de Buenos Aires" }).locator("option")).toHaveCount(136);
  await page.getByRole("combobox", { name: "Partido de Buenos Aires" }).selectOption("");
  await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(20);
  expect(new URL(page.url()).searchParams.has("partidoId")).toBe(false);
});

test("sin JavaScript el selector HTML envía UUID y conserva la lista", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await isolateMapNetwork(page);
  await page.goto("http://127.0.0.1:3102/mapa?vista=lista");
  await page.getByText("Filtrar obras", { exact: true }).click();
  const selector = page.getByRole("combobox", { name: "Partido de Buenos Aires" });
  await expect(selector.locator("option")).toHaveCount(136);
  await selector.selectOption(first.partidoId);
  await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("partidoId=" + first.partidoId));
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(12);
  await expect(page.locator(".scope-note")).toContainText("Partido informado por la fuente: 25 de Mayo");
  await context.close();
});
