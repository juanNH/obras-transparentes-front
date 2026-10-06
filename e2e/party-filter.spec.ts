/** @file Verifica selección de 135 partidos, búsqueda sin red, URLs y alternativa HTML con obras sintéticas aisladas. */
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import catalog from "../test/fixtures/pba-parties.json" with { type: "json" };
import { isolateMapNetwork, useSyntheticBasemap } from "./map-fixture";

const first = catalog.items.find(party => party.nombre === "25 de Mayo")!;
const empty = catalog.items.find(party => party.nombre === "Capitán Sarmiento")!;
const second = catalog.items.find(party => party.nombre === "Vicente López")!;

test.beforeEach(async ({ page }) => { await isolateMapNetwork(page); await useSyntheticBasemap(page); });

test("la nómina completa y la búsqueda local aplican sólo la identidad del partido", async ({ page, request }) => {
  const baseline = ((await (await request.get("http://127.0.0.1:4100/__requests")).json()).requests as { path: string }[]).length;
  await page.goto("/mapa?vista=lista");
  await page.getByText("Filtrar obras", { exact: true }).click();
  const selector = page.getByRole("group", { name: "Partidos de Buenos Aires", exact: true });
  await expect(selector.locator("input[name=partidos]")).toHaveCount(135);
  await expect(page.getByRole("checkbox", { name: "Buenos Aires", exact: true })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Buenos Aires", exact: true })).toBeEnabled();
  await selector.locator(".party-picker > summary").click();
  await page.getByRole("searchbox", { name: "Buscar partido (opcional)", exact: true }).fill("ZARATE");
  await expect(selector.locator(".party-options li:visible")).toHaveCount(1);
  await expect(selector.getByRole("checkbox", { name: "Zárate", exact: true })).toBeVisible();
  await page.getByRole("searchbox").fill("");
  await selector.getByRole("checkbox", { name: first.nombre, exact: true }).check();
  const records = ((await (await request.get("http://127.0.0.1:4100/__requests")).json()).requests as { path: string }[]).slice(baseline);
  expect(records.filter(entry => entry.path === "/api/v1/territorios/pba/partidos")).toHaveLength(1);
  expect(records.filter(entry => entry.path === "/api/v1/obras")).toHaveLength(1);
  await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("partidos=" + first.partidoId));
  const params = new URL(page.url()).searchParams;
  expect(params.has("municipioCodigo")).toBe(false);
  expect(params.has("territorioEsquema")).toBe(false);
  expect(params.has("bbox")).toBe(false);
  expect(params.getAll("provinciaCodigo")).toEqual([]);
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
  await expect(page.locator("input[name=partidos]")).toHaveCount(135);
  await page.getByRole("button", { name: "Limpiar partidos", exact: true }).click();
  await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(20);
  expect(new URL(page.url()).searchParams.has("partidoId")).toBe(false);
  expect(new URL(page.url()).searchParams.has("partidos")).toBe(false);
});

test("sin JavaScript el selector HTML envía UUID y conserva la lista", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await isolateMapNetwork(page);
  await page.goto("http://127.0.0.1:3102/mapa?vista=lista");
  await page.getByText("Filtrar obras", { exact: true }).click();
  const selector = page.getByRole("group", { name: "Partidos de Buenos Aires", exact: true });
  await expect(selector.locator("input[name=partidos]")).toHaveCount(135);
  await selector.locator(".party-picker > summary").click();
  await selector.getByRole("checkbox", { name: first.nombre, exact: true }).check();
  await selector.getByRole("checkbox", { name: second.nombre, exact: true }).check();
  await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("partidos=" + first.partidoId));
  expect(new URL(page.url()).searchParams.getAll("partidos").sort()).toEqual([first.partidoId, second.partidoId].sort());
  expect(new URL(page.url()).searchParams.getAll("provinciaCodigo")).toEqual([]);
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(20);
  await expect(page.locator(".scope-note")).toContainText("Partidos informados por la fuente:");
  await context.close();
});

test("dos partidos se combinan y se conservan al buscar, paginar, recargar y navegar el historial", async ({ page, request }) => {
  await page.goto("/mapa?vista=lista");
  await page.getByText("Filtrar obras", { exact: true }).click();
  await page.locator(".party-picker > summary").click();
  await page.getByRole("checkbox", { name: first.nombre, exact: true }).check();
  await page.getByRole("checkbox", { name: second.nombre, exact: true }).check();
  await page.getByRole("searchbox", { name: "Buscar partido (opcional)", exact: true }).fill("ZARATE");
  await expect(page.getByRole("list", { name: "Partidos seleccionados" })).toContainText(first.nombre);
  await expect(page.getByRole("list", { name: "Partidos seleccionados" })).toContainText(second.nombre);
  await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(20);
  const expectedIds = [first.partidoId, second.partidoId].sort();
  expect(new URL(page.url()).searchParams.getAll("partidos").sort()).toEqual(expectedIds);
  expect(new URL(page.url()).searchParams.has("partidoId")).toBe(false);
  await expect(page.locator(".scope-note")).toContainText("cualquiera de los partidos seleccionados");
  await page.getByRole("button", { name: "Cargar más obras", exact: true }).click();
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(24);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await page.goBack();
  await expect(page.getByRole("button", { name: "Mapa", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(new URL(page.url()).searchParams.getAll("partidos").sort()).toEqual(expectedIds);
  await page.goForward();
  await page.reload();
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(20);
  await page.getByText(/Filtrar obras/).first().click();
  await page.locator(".party-picker > summary").click();
  await expect(page.getByRole("checkbox", { name: first.nombre, exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: second.nombre, exact: true })).toBeChecked();
  await page.getByRole("button", { name: `Quitar ${first.nombre} del filtro de partidos`, exact: true }).click();
  await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(12);
  expect(new URL(page.url()).searchParams.getAll("partidos")).toEqual([second.partidoId]);
  const records = ((await (await request.get("http://127.0.0.1:4100/__requests")).json()).requests as { path: string; queryValues: Record<string, string[]> }[]);
  expect(records.some(entry => entry.path === "/api/v1/obras" && entry.queryValues.cursor && entry.queryValues.partidos?.length === 2 && !entry.queryValues.provinciaCodigo?.length)).toBe(true);
});
