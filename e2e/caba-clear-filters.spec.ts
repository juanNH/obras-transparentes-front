/** @file Verifica recuperación global de CABA, jurisdicciones explícitas y limpieza accesible de filtros compactos con publicaciones sintéticas aisladas. */
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import catalog from "../test/fixtures/pba-parties.json" with { type: "json" };
import { isolateMapNetwork, useSyntheticBasemap } from "./map-fixture";

const first = catalog.items.find(party => party.nombre === "25 de Mayo")!;
const municipal = catalog.items.find(party => party.nombre === "Vicente López")!;
const unknownCaba = "EJEMPLO SINTÉTICO — CABA con territorio no informado";
const reportedCaba = "EJEMPLO SINTÉTICO — CABA con provincia informada";

test.beforeEach(async ({ page, request }) => {
  await isolateMapNetwork(page); await useSyntheticBasemap(page);
  const response = await request.get("http://127.0.0.1:4100/__jurisdiction-fixtures?enabled=1");
  expect((await response.json()).fixture).toBe("synthetic-e2e-only");
});
test.afterEach(async ({ request }) => {
  const response = await request.get("http://127.0.0.1:4100/__jurisdiction-fixtures?enabled=0");
  expect(response.ok()).toBe(true);
});

test("el inicio incluye publicaciones de CABA con territorio ausente y la jurisdicción es opcional", async ({ page }, info) => {
  await page.goto("/mapa?vista=lista");
  await expect(page.getByRole("heading", { name: unknownCaba, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: reportedCaba, exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.has("provinciaCodigo")).toBe(false);
  await page.getByText("Filtrar obras", { exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Buenos Aires", exact: true })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Ciudad Autónoma de Buenos Aires", exact: true })).not.toBeChecked();
  await expect(page.locator(".party-picker")).not.toHaveAttribute("open");
  await expect(page.locator(".institutional-options")).not.toHaveAttribute("open");
  await expect(page.getByRole("searchbox", { name: "Buscar partido (opcional)", exact: true })).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  const clear = await page.getByRole("link", { name: "Limpiar filtros", exact: true }).boundingBox();
  const form = await page.getByRole("form", { name: "Filtrar obras", exact: true }).boundingBox();
  expect(clear!.y + clear!.height).toBeLessThan(form!.y);
  await page.getByRole("checkbox", { name: "Ciudad Autónoma de Buenos Aires", exact: true }).focus();
  await page.locator(".consultation-header").screenshot({ path: `artifacts/local-validation/filtros-compactos-${info.project.name}.png` });
  await page.getByRole("checkbox", { name: "Ciudad Autónoma de Buenos Aires", exact: true }).check();
  await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  await expect(page.getByRole("heading", { name: reportedCaba, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: unknownCaba, exact: true })).toHaveCount(0);
  expect(new URL(page.url()).searchParams.getAll("provinciaCodigo")).toEqual(["02"]);
  await expect(page.locator(".scope-note")).toContainText("territorio no informado");
  await page.getByRole("link", { name: "Quitar filtro de jurisdicción", exact: true }).click();
  await expect(page.getByRole("heading", { name: unknownCaba, exact: true })).toBeVisible();
  await page.getByText("Filtrar obras", { exact: true }).click();
  await page.getByRole("combobox", { name: /^Fuente/ }).selectOption("caba-actualizado");
  await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  await expect(page.getByRole("heading", { name: unknownCaba, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: reportedCaba, exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.has("provinciaCodigo")).toBe(false);
});

test("limpiar desde la cabecera quita filtros, área, cursor y selección y recupera CABA", async ({ page }) => {
  const params = new URLSearchParams({ provinciaCodigo: "06", partidos: first.partidoId, partidoVerificadoId: municipal.partidoId, gestionMunicipalId: municipal.partidoId, organizacionId: "50000000-0000-4000-8000-000000000001", rolInstitucional: "FINANCIADOR", periodoDesde: "2025-01-01", periodoHasta: "2025-12-31", fuente: "nacion-obras", estado: "COMPLETED", sector: "educacion", bbox: "-64,-42,-56,-33", cursor: "fixture-offset-20", obra: "10000000-0000-4000-8000-000000000003", revisionId: "20000000-0000-4000-8000-000000000003", limites: "mostrar", vista: "lista" });
  await page.goto("/mapa?" + params);
  await expect(page.locator(".filter-group")).not.toHaveAttribute("open");
  await page.getByRole("link", { name: "Limpiar filtros", exact: true }).click();
  await expect(page).toHaveURL(/\/mapa\?vista=lista$/);
  await expect(page.getByRole("heading", { name: unknownCaba, exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Filtros aplicados", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: unknownCaba, exact: true })).toBeVisible();
  expect([...new URL(page.url()).searchParams.keys()]).toEqual(["vista"]);
});

test("quitar un filtro conserva los otros y elimina el cursor sin selección oculta", async ({ page }) => {
  await page.goto(`/mapa?vista=lista&provinciaCodigo=06&partidos=${first.partidoId}&fuente=nacion-obras&cursor=fixture-offset-20&obra=10000000-0000-4000-8000-000000000003&revisionId=20000000-0000-4000-8000-000000000003`);
  await page.getByRole("link", { name: "Quitar filtro de fuente", exact: true }).click();
  const params = new URL(page.url()).searchParams;
  expect(params.getAll("partidos")).toEqual([first.partidoId]);
  expect(params.getAll("provinciaCodigo")).toEqual(["06"]);
  for (const key of ["fuente", "cursor", "obra", "revisionId"]) expect(params.has(key)).toBe(false);
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(12);
});

test("muchos partidos quedan resumidos y el desplegable permite quitarlos con teclado", async ({ page }) => {
  const parties = catalog.items.slice(0, 8);
  const params = new URLSearchParams({ vista: "lista" });
  parties.forEach(party => params.append("partidos", party.partidoId));
  await page.goto("/mapa?" + params);
  await page.locator(".filter-group > summary").click();
  await expect(page.locator(".reported-party-filter > .party-selected > li")).toHaveCount(6);
  const overflow = page.locator(".party-selected-overflow");
  await expect(overflow).not.toHaveAttribute("open");
  await overflow.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(overflow).toHaveAttribute("open", "");
  const removed = parties[7]!;
  await page.getByRole("button", { name: `Quitar ${removed.nombre} del filtro de partidos`, exact: true }).click();
  await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  expect(new URL(page.url()).searchParams.getAll("partidos")).toEqual(parties.slice(0, 7).map(party => party.partidoId).sort());
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("sin JavaScript el desplegable, la fuente CABA y la limpieza conservan el catálogo", async ({ browser, page: referencePage }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: referencePage.viewportSize() });
  try {
    const page = await context.newPage(); await isolateMapNetwork(page);
    await page.goto("http://127.0.0.1:3102/mapa?vista=lista");
    await expect(page.getByRole("heading", { name: unknownCaba, exact: true })).toBeVisible();
    await page.getByText("Filtrar obras", { exact: true }).click();
    await page.getByRole("combobox", { name: /^Fuente/ }).selectOption("caba-actualizado");
    await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
    await expect(page.getByRole("heading", { name: unknownCaba, exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Limpiar filtros", exact: true }).click();
    expect([...new URL(page.url()).searchParams.keys()]).toEqual(["vista"]);
    await page.getByText("Filtrar obras", { exact: true }).click();
    await page.getByText("Seleccionar partidos", { exact: true }).click();
    await page.getByRole("checkbox", { name: first.nombre, exact: true }).check();
    await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
    expect(new URL(page.url()).searchParams.getAll("partidos")).toEqual([first.partidoId]);
    expect(new URL(page.url()).searchParams.has("provinciaCodigo")).toBe(false);
  } finally { await context.close(); }
});
