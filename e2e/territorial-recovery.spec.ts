/** @file Comprueba caída SSR/BFF y recuperación de provincias y partidos con estado temporal en la API sintética 4100; conserva formulario, IDs y publicaciones sin consultar datos reales. */
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import catalog from "../test/fixtures/pba-parties.json" with { type: "json" };
import { isolateMapNetwork, useSyntheticBasemap } from "./map-fixture";

const first = catalog.items.find(party => party.nombre === "25 de Mayo")!;
const second = catalog.items.find(party => party.nombre === "Vicente López")!;
const selectedIds = [first.partidoId, second.partidoId].sort();
const selectedPath = `/mapa?vista=lista&partidos=${first.partidoId}&partidos=${second.partidoId}`;

/** Cambia sólo las fallas temporales del servidor sintético conocido y verifica su identidad antes de usarlo. */
async function setFailures(request: APIRequestContext, parties: boolean, provinces: boolean) {
  const health = await request.get("http://127.0.0.1:4100/__health");
  expect(health.ok()).toBe(true);
  expect(await health.json()).toEqual({ fixture: "synthetic-e2e-only" });
  const response = await request.get(`http://127.0.0.1:4100/__territorial-failures?parties=${parties ? "1" : "0"}&provinces=${provinces ? "1" : "0"}`);
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ fixture: "synthetic-e2e-only", parties, provinces });
}

/** Inspecciona los controles exitosos del GET nativo, incluidos seleccionados ocultos por búsqueda. */
async function formValues(page: Page) {
  return page.getByRole("form", { name: "Filtrar obras", exact: true }).evaluate(form => {
    const data = new FormData(form as HTMLFormElement);
    return { partidos: data.getAll("partidos").map(String).sort(), provincias: data.getAll("provinciaCodigo").map(String) };
  });
}

test.beforeEach(async ({ page }) => { await isolateMapNetwork(page); await useSyntheticBasemap(page); });

test("el reintento de partidos conserva dos IDs tras una caída SSR y otra BFF", async ({ page, request }) => {
  try {
    await setFailures(request, true, false);
    await page.goto(selectedPath);
    await page.locator(".filter-group > summary").click();
    await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(20);
    await expect(page.locator(".party-filter")).toContainText("No pudimos cargar la nómina de partidos");
    await expect(page.locator('input[type="hidden"][name="partidos"]')).toHaveCount(2);
    expect(await formValues(page)).toEqual({ partidos: selectedIds, provincias: [] });
    const failedRead = page.waitForResponse(response => new URL(response.url()).pathname === "/api/public/territorios/pba/partidos");
    await page.getByRole("button", { name: "Reintentar nómina de partidos", exact: true }).click();
    expect((await failedRead).status()).toBe(503);
    await expect(page.getByRole("button", { name: "Reintentar nómina de partidos", exact: true })).toBeEnabled();
    expect(await formValues(page)).toEqual({ partidos: selectedIds, provincias: [] });
    await setFailures(request, false, false);
    await page.getByRole("button", { name: "Reintentar nómina de partidos", exact: true }).click();
    const group = page.getByRole("group", { name: "Partidos de Buenos Aires", exact: true });
    await expect(group.locator('input[name="partidos"]')).toHaveCount(135);
    await group.locator(".party-picker > summary").click();
    await expect(group.getByRole("checkbox", { name: first.nombre, exact: true })).toBeChecked();
    await expect(group.getByRole("checkbox", { name: second.nombre, exact: true })).toBeChecked();
    await group.getByRole("searchbox", { name: "Buscar partido (opcional)", exact: true }).fill("ZARATE");
    await expect(group.locator(".party-options li:visible")).toHaveCount(1);
    await expect(group.getByRole("list", { name: "Partidos seleccionados" })).toContainText(first.nombre);
    await expect(group.getByRole("list", { name: "Partidos seleccionados" })).toContainText(second.nombre);
    expect(await formValues(page)).toEqual({ partidos: selectedIds, provincias: [] });
    await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
    await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(20);
    expect(new URL(page.url()).searchParams.getAll("partidos").sort()).toEqual(selectedIds);
    expect(new URL(page.url()).searchParams.getAll("provinciaCodigo")).toEqual([]);
  } finally { await setFailures(request, false, false); }
});

test("la caída provincial conserva Buenos Aires explícita en GET y reintenta sin perder partidos", async ({ page, request }) => {
  try {
    await setFailures(request, false, true);
    await page.goto(selectedPath + "&provinciaCodigo=06");
    await page.locator(".filter-group > summary").click();
    await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(20);
    const group = page.getByRole("group", { name: "Provincia o ciudad autónoma", exact: true });
    await expect(group).toContainText("Se conserva la selección actual");
    await expect(group.locator('input[type="hidden"][name="provinciaCodigo"]')).toHaveValue("06");
    await expect(group.getByRole("checkbox")).toHaveCount(0);
    expect(await formValues(page)).toEqual({ partidos: selectedIds, provincias: ["06"] });
    const failedRead = page.waitForResponse(response => new URL(response.url()).pathname === "/api/public/territorios/provincias");
    await group.getByRole("button", { name: "Reintentar nómina provincial", exact: true }).click();
    expect((await failedRead).status()).toBe(503);
    await expect(group.getByRole("button", { name: "Reintentar nómina provincial", exact: true })).toBeEnabled();
    expect(await formValues(page)).toEqual({ partidos: selectedIds, provincias: ["06"] });
    await setFailures(request, false, false);
    await group.getByRole("button", { name: "Reintentar nómina provincial", exact: true }).click();
    await expect(group.getByRole("button", { name: "Reintentar nómina provincial", exact: true })).toHaveCount(0);
    await expect(group.getByRole("checkbox", { name: "Buenos Aires", exact: true })).toBeChecked();
    await expect(group.getByRole("checkbox", { name: "Buenos Aires", exact: true })).toBeEnabled();
    await expect(group.getByRole("checkbox", { name: "Ciudad Autónoma de Buenos Aires", exact: true })).not.toBeChecked();
    expect(await formValues(page)).toEqual({ partidos: selectedIds, provincias: ["06"] });
    await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
    await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(20);
    expect(new URL(page.url()).searchParams.getAll("provinciaCodigo")).toEqual(["06"]);
    expect(new URL(page.url()).searchParams.getAll("partidos").sort()).toEqual(selectedIds);
  } finally { await setFailures(request, false, false); }
});
