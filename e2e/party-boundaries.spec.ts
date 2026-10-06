/** @file Verifica carga y render del asset GeoRef final de 135 partidos con obras/mapa base sintéticos aislados; no acredita asignación espacial ni latencia de campo. */
import { expect, test, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { BoundingBox, PartyBoundaries } from "../src/api/client";
import catalog from "../test/fixtures/pba-parties.json" with { type: "json" };
import boundaries from "../test/fixtures/pba-party-boundaries.json" with { type: "json" };
import { MAX_PARTY_BOUNDARY_BYTES } from "../src/lib/party-boundaries";
import { disableWebGL, expectCanvasMap, hasMapColor, isolateMapNetwork, useSyntheticBasemap } from "./map-fixture";

const party = catalog.items.find(party => party.nombre === "Tornquist")!;
const geometry = boundaries.features.find(feature => feature.id === party.partidoId)!;
const positions = geometry.geometry.coordinates.flatMap(polygon => polygon.flatMap(ring => ring));
const bbox: BoundingBox = [Math.min(...positions.map(point => point[0]!)), Math.min(...positions.map(point => point[1]!)), Math.max(...positions.map(point => point[0]!)), Math.max(...positions.map(point => point[1]!))];

/** Lee únicamente el registro del fixture local para separar obras, nómina y límite. */
async function ledger(request: APIRequestContext): Promise<{ path: string; query: Record<string, string>; responseBytes: number }[]> {
  const response = await request.get("http://127.0.0.1:4100/__requests");
  const value = await response.json();
  expect(value.fixture).toBe("synthetic-e2e-only");
  return value.requests;
}

test.beforeEach(async ({ page }) => { await isolateMapNetwork(page); await useSyntheticBasemap(page); await disableWebGL(page); });

test("renderiza 135 límites reales dentro de su presupuesto y los reutiliza sin otra consulta de obras", async ({ page, request }, info) => {
  const baseline = (await ledger(request)).length;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  // Copia el cuerpo desde el BFF real antes de entregarlo, porque Chromium puede
  // retirar Network.getResponseBody cuando React cancela la lectura ya completada.
  // No sustituye límites: ambos consumen los mismos bytes del endpoint local.
  let deliveredBody: Buffer | null = null;
  await page.route("**/api/public/territorios/pba/partidos/limites?*", async route => {
    const upstream = await route.fetch();
    deliveredBody = await upstream.body();
    await route.fulfill({ response: upstream, body: deliveredBody });
  });
  await page.goto("/mapa?bbox=-64,-42,-56,-33&vista=lista");
  expect((await ledger(request)).slice(baseline).filter(record => record.path.endsWith("/limites"))).toHaveLength(0);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  // El centro de este bbox provincial cae fuera de la geografía sintética AMBA.
  // La pintura real se comprueba abajo en los píxeles de los límites GeoRef.
  await expect(page.getByRole("button", { name: "Acercar mapa", exact: true })).toBeEnabled();
  await expect(page.locator(".map-canvas canvas").first()).toBeVisible();
  await expect(page.locator(".map-region")).toContainText("18 ubicaciones cargadas");
  const before = (await ledger(request)).slice(baseline);
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === "/api/public/territorios/pba/partidos/limites");
  const start = performance.now();
  await page.getByRole("checkbox", { name: "Mostrar límites de partidos", exact: true }).check();
  const response = await pending;
  await expect(page.locator(".territory-controls")).toContainText("135 límites de partidos cargados");
  const text = deliveredBody!.toString("utf8");
  const body = JSON.parse(text) as PartyBoundaries;
  await expect.poll(() => hasMapColor(page, [107, 133, 155])).toBe(true);
  const loadAndPaintMs = performance.now() - start;
  expect(body.features).toHaveLength(135);
  expect(body.metadata.validacion.posiciones).toBe(55842);
  expect(Buffer.byteLength(text)).toBeLessThan(MAX_PARTY_BOUNDARY_BYTES);
  expect(body.metadata.uso).toBe("DISPLAY_ONLY");
  const after = (await ledger(request)).slice(baseline);
  expect(after.filter(record => record.path.startsWith("/api/v1/obras"))).toEqual(before.filter(record => record.path.startsWith("/api/v1/obras")));
  expect(after.filter(record => record.path.endsWith("/limites"))).toHaveLength(1);
  for (const visible of [false, true]) await page.getByRole("checkbox", { name: "Mostrar límites de partidos", exact: true }).setChecked(visible);
  for (const view of ["Lista", "Mapa", "Lista", "Mapa"]) {
    await page.getByRole("button", { name: view, exact: true }).click();
    if (view === "Mapa") await expect.poll(() => hasMapColor(page, [107, 133, 155])).toBe(true);
    else await expect(page.locator(".map-canvas")).toHaveCount(0);
  }
  await expect.poll(() => hasMapColor(page, [107, 133, 155])).toBe(true);
  expect((await ledger(request)).slice(baseline).filter(record => record.path.endsWith("/limites"))).toHaveLength(1);
  expect(errors).toEqual([]);
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const directory = resolve("artifacts/local-validation/partidos-pba");
  await mkdir(directory, { recursive: true });
  const screenshot = resolve(directory, `georef-real-${info.project.name}.png`);
  await page.locator(".map-region").screenshot({ path: screenshot, animations: "disabled" });
  const original = await readFile("test/fixtures/pba-party-boundaries.json");
  const report = { scope: "Asset final GeoRef real servido por BFF local y observado mediante route.fetch/fulfill; obras y mapa base sintéticos. Una muestra local por proyecto; no p95 ni teléfono físico.",
    project: info.project.name, features: body.features.length, positions: body.metadata.validacion.posiciones,
    originalFileBytes: original.byteLength, originalFileSha256: createHash("sha256").update(original).digest("hex"),
    bffDecodedJSONBytes: Buffer.byteLength(text), bffContentEncoding: response.headers()["content-encoding"] ?? null,
    loadAndPaintMs, maxDecodedBytes: MAX_PARTY_BOUNDARY_BYTES, sourceVersion: body.metadata.fuente.version,
    boundariesVersion: body.metadata.version, boundariesRequests: 1, worksChangedByToggle: false, screenshot, errors };
  await writeFile(resolve(directory, `georef-real-${info.project.name}.json`), JSON.stringify(report, null, 2));
  await info.attach("georef-final-real", { path: screenshot, contentType: "image/png" });
  await info.attach("medicion-georef-final-real", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
});

test("seleccionar un límite real aplica UUID y conserva su presentación sin reasignar obras", async ({ page, request }) => {
  const baseline = (await ledger(request)).length;
  await page.goto("/mapa?bbox=" + bbox.join(",") + "&limites=mostrar");
  await expectCanvasMap(page);
  await expect(page.locator(".territory-controls")).toContainText("135 límites de partidos cargados");
  await expect.poll(() => hasMapColor(page, [107, 133, 155])).toBe(true);
  const canvas = page.locator(".map-canvas");
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: box!.width / 2, y: box!.height / 2 } });
  await expect(page).toHaveURL(new RegExp("partidoId=" + party.partidoId));
  expect(new URL(page.url()).searchParams.get("limites")).toBe("mostrar");
  await expect(page.locator(".scope-note")).toContainText("Partido informado por la fuente: Tornquist");
  await expect(page.getByRole("checkbox", { name: "Mostrar límites de partidos" })).toBeChecked();
  await expect(page.locator(".territory-controls")).toContainText("135 límites de partidos cargados");
  const records = (await ledger(request)).slice(baseline);
  expect(records.filter(record => record.path.endsWith("/limites"))).toHaveLength(1);
  expect(records.filter(record => record.path === "/api/v1/obras").at(-1)!.query.partidoId).toBe(party.partidoId);
  await expect(page.getByRole("heading", { name: "No hay obras para mostrar" })).toBeVisible();
});

test("una falla de límites permite reintentar y mantiene las obras", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/public/territorios/pba/partidos/limites?*", async route => {
    if (++attempts === 1) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "BOUNDARIES_UNAVAILABLE", message: "Fixture failure" } }) });
    else await route.continue();
  });
  await page.goto("/mapa?bbox=-64,-42,-56,-33");
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(18);
  await page.getByRole("checkbox", { name: "Mostrar límites de partidos" }).check();
  await expect(page.locator(".territory-controls")).toContainText("No pudimos cargar los límites");
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(18);
  await page.getByRole("button", { name: "Reintentar límites de partidos", exact: true }).click();
  await expect(page.locator(".territory-controls")).toContainText("135 límites de partidos cargados");
  expect(attempts).toBe(2);
});

test("salir a lista cancela una carga territorial pendiente y permite recuperarla", async ({ page }) => {
  let attempts = 0;
  let cancelled = 0;
  let release = () => {};
  const blocked = new Promise<void>(resolve => { release = resolve; });
  page.on("requestfailed", request => { if (new URL(request.url()).pathname.endsWith("/partidos/limites")) cancelled++; });
  await page.route("**/api/public/territorios/pba/partidos/limites?*", async route => {
    if (++attempts === 1) {
      await blocked;
      try { await route.fulfill({ contentType: "application/json", body: JSON.stringify(boundaries) }); } catch { /* La solicitud cancelada ya no tiene consumidor. */ }
    } else await route.continue();
  });
  await page.goto("/mapa?bbox=-64,-42,-56,-33");
  await page.getByRole("checkbox", { name: "Mostrar límites de partidos" }).check();
  await expect(page.locator(".territory-controls")).toContainText("Cargando límites de partidos");
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(18);
  await expect.poll(() => cancelled).toBe(1);
  release();
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await expect(page.locator(".territory-controls")).toContainText("135 límites de partidos cargados");
  expect(attempts).toBe(2);
});
