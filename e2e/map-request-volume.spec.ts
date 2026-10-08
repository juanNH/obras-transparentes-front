/** @file Mide solicitudes, cursores y bytes del explorador y fichas HTML con API/cartografía sintéticas; no acredita tráfico o percentiles reales. */
import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { Ajv } from "ajv";
import { fullFormats } from "ajv-formats/dist/formats.js";
import examples from "../contracts/examples.json" with { type: "json" };
import schemas from "../contracts/schemas.json" with { type: "json" };
import type { WorkGeoJSON } from "../src/api/client";
import { disableWebGL, expectCanvasMap, isolateMapNetwork, useSyntheticBasemap } from "./map-fixture";

const firstId = "10000000-0000-4000-8000-000000000001";
const firstRevision = "20000000-0000-4000-8000-000000000001";
const missingId = "10000000-0000-4000-8000-000000000999";
const firstName = "EJEMPLO SINTÉTICO — Obra 01";

/** Lectura registrada exclusivamente por el servidor sintético de Playwright, incluido SSR. */
type FixtureRequest = { sequence: number; path: string; query: Record<string, string>; status: number; responseBytes: number };
/** Intento observado por el navegador; una cancelación sigue siendo una solicitud iniciada. */
type BrowserRequest = { path: string; query: Record<string, string>; failed: boolean; status: number | null; contentEncoding: string | null };

/** Lee el registro del fixture local y rechaza una instancia distinta antes de usarlo como evidencia. */
async function fixtureRequests(request: APIRequestContext): Promise<FixtureRequest[]> {
  const response = await request.get("http://127.0.0.1:4100/__requests");
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.fixture).toBe("synthetic-e2e-only");
  return body.requests;
}

/** Cuenta solicitudes a datos públicos y al estilo aislado; no suma HTML/scripts a las llamadas de catálogo. */
function observeBrowser(page: Page): BrowserRequest[] {
  const records: BrowserRequest[] = [];
  const pending = new Map<object, BrowserRequest>();
  page.on("request", request => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/api/public/") && url.hostname !== "tiles.openfreemap.org") return;
    const entry: BrowserRequest = { path: url.pathname, query: Object.fromEntries(url.searchParams), failed: false, status: null, contentEncoding: null };
    records.push(entry);
    pending.set(request, entry);
  });
  page.on("response", response => {
    const entry = pending.get(response.request());
    if (entry) { entry.status = response.status(); entry.contentEncoding = response.headers()["content-encoding"] ?? null; }
  });
  page.on("requestfailed", request => { const entry = pending.get(request); if (entry) entry.failed = true; });
  return records;
}

/** Resume lecturas upstream del fixture separando obras, nóminas provinciales y de partidos y catálogo institucional independientes. */
function counts(records: readonly FixtureRequest[]) {
  return {
    list: records.filter(record => record.path === "/api/v1/obras").length,
    geojson: records.filter(record => record.path === "/api/v1/obras/geojson").length,
    detail: records.filter(record => /^\/api\/v1\/obras\/[a-f0-9-]+$/.test(record.path)).length,
    provinces: records.filter(record => record.path === "/api/v1/territorios/provincias").length,
    provinceJSONBytes: records.filter(record => record.path === "/api/v1/territorios/provincias").reduce((sum, record) => sum + record.responseBytes, 0),
    parties: records.filter(record => record.path === "/api/v1/territorios/pba/partidos").length,
    partyJSONBytes: records.filter(record => record.path === "/api/v1/territorios/pba/partidos").reduce((sum, record) => sum + record.responseBytes, 0),
    organizations: records.filter(record => record.path === "/api/v1/organizaciones-institucionales").length,
    municipalCoverage: records.filter(record => record.path === "/api/v1/obras/cobertura-municipal").length,
    sourceCoverage: records.filter(record => record.path === "/api/v1/obras/cobertura-fuentes").length,
    workCounts: records.filter(record => record.path === "/api/v1/obras/conteos").length,
    organizationJSONBytes: records.filter(record => record.path === "/api/v1/organizaciones-institucionales").reduce((sum, record) => sum + record.responseBytes, 0),
    decodedJSONBytes: records.reduce((sum, record) => sum + record.responseBytes, 0),
  };
}

/** Guarda un informe por proyecto con conteos/bytes sintéticos y límites de interpretación explícitos. */
async function attachReport(info: TestInfo, report: unknown) {
  const path = info.outputPath("map-request-volume.json");
  await writeFile(path, JSON.stringify({
    project: info.project.name,
    fixture: "synthetic-e2e-only",
    limitations: ["No es tráfico real ni p95/p75.", "El mapa base usa un estilo inline sin teselas remotas.", "Los bytes JSON son UTF-8 sin comprimir; no son transferSize ni consumo del proveedor."],
    report,
  }, null, 2));
  await info.attach("map-request-volume.json", {
    contentType: "application/json",
    path,
  });
}

test.beforeEach(async ({ page }) => {
  await isolateMapNetwork(page);
  await useSyntheticBasemap(page);
  await disableWebGL(page);
});

test("cada acción distingue nueva consulta de reutilización del catálogo", async ({ page, request }, info) => {
  const baseline = (await fixtureRequests(request)).length;
  const browser = observeBrowser(page);
  const checkpoints: { action: string; counts: ReturnType<typeof counts> }[] = [];
  /** Compara lecturas acumuladas después del estado observable que exige cada acción. */
  async function checkpoint(action: string, expected: { list: number; geojson: number; detail: number }) {
    await expect.poll(async () => counts((await fixtureRequests(request)).slice(baseline)), { timeout: 10_000 }).toMatchObject(expected);
    const delta = (await fixtureRequests(request)).slice(baseline);
    expect(counts(delta)).toMatchObject(expected);
    checkpoints.push({ action, counts: counts(delta) });
    return delta;
  }

  const initialResponse = await page.goto("/mapa?vista=lista");
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(20);
  await checkpoint("entrada en lista", { list: 1, geojson: 0, detail: 0 });
  expect(counts((await fixtureRequests(request)).slice(baseline)).parties).toBe(1);
  expect(counts((await fixtureRequests(request)).slice(baseline)).provinces).toBe(1);
  expect(counts((await fixtureRequests(request)).slice(baseline)).organizations).toBe(1);
  expect(counts((await fixtureRequests(request)).slice(baseline)).municipalCoverage).toBe(1);
  expect(counts((await fixtureRequests(request)).slice(baseline)).workCounts).toBe(3);
  expect(counts((await fixtureRequests(request)).slice(baseline)).sourceCoverage).toBe(1);
  expect(browser).toHaveLength(0);

  await page.getByRole("button", { name: "Cargar más obras", exact: true }).click();
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(24);
  const paginated = await checkpoint("cargar página siguiente", { list: 2, geojson: 0, detail: 0 });
  expect(paginated.at(-1)!.query).toMatchObject({ cursor: "fixture-offset-20", limit: "20" });

  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await expectCanvasMap(page);
  await expect(page.locator(".map-region")).toContainText("18 ubicaciones cargadas");
  const opened = await checkpoint("primera apertura del mapa", { list: 2, geojson: 1, detail: 0 });
  expect(opened.at(-1)!.query).toMatchObject({ bbox: "-180,-85.051129,180,85.051129", limit: "100" });

  await page.getByRole("button", { name: "Acercar mapa", exact: true }).click();
  await page.getByRole("button", { name: "Mover mapa al norte", exact: true }).click();
  await checkpoint("zoom y movimiento sin confirmar", { list: 2, geojson: 1, detail: 0 });
  expect(new URL(page.url()).searchParams.has("bbox")).toBe(false);

  await page.locator(".results-list").getByRole("button", { name: /^Ver en mapa/ }).first().click();
  await expect(page.locator(".selection-strip").getByRole("heading", { name: firstName, exact: true })).toBeVisible();
  await expect(page.locator(".selection-strip")).toContainText("Ubicación aprobada destacada. La consulta conserva sus filtros.");
  await checkpoint("seleccionar revisión exacta", { list: 2, geojson: 1, detail: 1 });
  await page.locator(".selection-strip").getByRole("button", { name: "Ver resumen", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: firstName, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar resumen", exact: true }).click();
  await page.locator(".results-list").getByRole("button", { name: /^Ver en mapa/ }).first().click();
  for (const view of ["Lista", "Mapa", "Lista", "Mapa"]) {
    await page.getByRole("button", { name: view, exact: true }).click();
    if (view === "Mapa") await expectCanvasMap(page);
  }
  await checkpoint("resumen, misma selección y dos alternancias completas", { list: 2, geojson: 1, detail: 1 });
  expect(counts((await fixtureRequests(request)).slice(baseline)).parties).toBe(1);
  expect(counts((await fixtureRequests(request)).slice(baseline)).provinces).toBe(1);
  expect(browser.filter(record => record.path.startsWith("/styles/"))).toHaveLength(3);

  await page.getByRole("button", { name: "Buscar en esta zona", exact: true }).click();
  await expect(page.locator(".scope-note")).toContainText("Consulta por área");
  await expect(page).toHaveURL(/bbox=/);
  const confirmed = await checkpoint("confirmar área", { list: 3, geojson: 2, detail: 1 });
  const area = new URL(page.url()).searchParams.get("bbox");
  expect(confirmed.filter(record => record.path === "/api/v1/obras").at(-1)!.query.bbox).toBe(area);
  expect(confirmed.filter(record => record.path === "/api/v1/obras/geojson").at(-1)!.query.bbox).toBe(area);

  await page.getByRole("combobox", { name: "Fuente pública", exact: true }).selectOption("nacion-obras");
  await page.getByRole("button", { name: "Ver listado", exact: true }).click();
  await expect(page).toHaveURL(/fuente=nacion-obras&vista=lista$/);
  const filtered = await checkpoint("cambiar fuente y abrir lista completa", { list: 4, geojson: 2, detail: 1 });
  expect(filtered.filter(record => record.path.startsWith("/api/v1/obras") && !["/api/v1/obras/cobertura-municipal", "/api/v1/obras/cobertura-fuentes", "/api/v1/obras/conteos"].includes(record.path))).toHaveLength(7);
  expect(counts(filtered).parties).toBe(3);
  expect(counts(filtered).provinces).toBe(3);
  expect(counts(filtered).organizations).toBe(3);
  expect(counts(filtered).municipalCoverage).toBe(3);
  expect(counts(filtered).workCounts).toBe(9);
  expect(counts(filtered).sourceCoverage).toBe(3);
  expect(filtered).toHaveLength(31);
  expect(filtered.filter(record => record.path === "/api/v1/obras").at(-1)!.query).toMatchObject({ fuente: "nacion-obras" });
  expect(filtered.filter(record => record.path === "/api/v1/obras").at(-1)!.query).not.toHaveProperty("bbox");
  expect(browser.filter(record => record.path === "/api/public/geojson")).toHaveLength(2);
  expect(browser.filter(record => record.path === `/api/public/obras/${firstId}`)).toHaveLength(1);
  await attachReport(info, { checkpoints, upstream: filtered, browser, initialDocumentContentEncoding: initialResponse?.headers()["content-encoding"] ?? null });
});

test("el recorrido con cursor pendiente se detiene en cinco páginas y declara mapa parcial", async ({ page }, info) => {
  const browser = observeBrowser(page);
  const responses: { cursor: string | null; features: number; bytes: number }[] = [];
  const ajv = new Ajv({ strict: false, formats: fullFormats });
  ajv.addSchema({ $id: "volume-fixture", components: { schemas } });
  const check = ajv.getSchema("volume-fixture#/components/schemas/PublicGeoFeatureCollection")!;
  const features = Array.from({ length: 600 }, (_, index) => {
    const feature = structuredClone(examples.geojsonPopulated.features[0]) as WorkGeoJSON["features"][number];
    const locationId = `40000000-0000-4000-8000-${String(index + 1000).padStart(12, "0")}`;
    feature.id = locationId;
    feature.properties.ubicacionId = locationId;
    feature.geometry = { type: "Point", coordinates: [-58.45 + index % 25 * 0.0005, -34.55 + Math.floor(index / 25) * 0.0005] };
    return feature;
  });
  await page.route("**/api/public/geojson?*", async route => {
    const cursor = new URL(route.request().url()).searchParams.get("cursor");
    const offset = cursor ? Number(cursor.replace("volume-offset-", "")) : 0;
    const value: WorkGeoJSON = { type: "FeatureCollection", features: features.slice(offset, offset + 100), nextCursor: offset + 100 < features.length ? `volume-offset-${offset + 100}` : null, catalogoVersion: "7" };
    expect(check(value), ajv.errorsText(check.errors)).toBe(true);
    const body = JSON.stringify(value);
    responses.push({ cursor, features: value.features.length, bytes: Buffer.byteLength(body) });
    await route.fulfill({ contentType: "application/json", body });
  });
  await page.goto("/mapa");
  await expect(page.getByText(/Mapa parcial: hay más ubicaciones/)).toBeVisible();
  await expectCanvasMap(page);
  await expect(page.locator(".map-region")).toContainText("500 ubicaciones cargadas");
  await page.waitForLoadState("networkidle");
  expect(responses.map(response => response.cursor)).toEqual([null, "volume-offset-100", "volume-offset-200", "volume-offset-300", "volume-offset-400"]);
  expect(responses.reduce((sum, response) => sum + response.features, 0)).toBe(500);
  expect(responses.reduce((sum, response) => sum + response.bytes, 0)).toBeLessThan(2 * 1024 * 1024);
  expect(browser.filter(record => record.path === "/api/public/geojson")).toHaveLength(5);
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await expectCanvasMap(page);
  await page.waitForLoadState("networkidle");
  expect(browser.filter(record => record.path === "/api/public/geojson")).toHaveLength(5);
  await attachReport(info, { pages: responses, renderedFeatures: 500, totalFixtureFeatures: 600, remainingCursor: "volume-offset-500", browser });
});

test("una carga inicial cancelada se repite al reabrir y la completada se reutiliza", async ({ page, request }, info) => {
  const baseline = (await fixtureRequests(request)).length;
  const browser = observeBrowser(page);
  let releaseFirst!: () => void;
  let firstUpstreamReady!: () => void;
  const release = new Promise<void>(resolve => { releaseFirst = resolve; });
  const ready = new Promise<void>(resolve => { firstUpstreamReady = resolve; });
  let first = true;
  await page.route("**/api/public/geojson?*", async route => {
    if (!first) return route.continue();
    first = false;
    const response = await route.fetch();
    firstUpstreamReady();
    await release;
    // The fetch has been cancelled by switching to Lista; completing the held
    // transport may be rejected by Playwright because that request is already gone.
    await route.fulfill({ response }).catch(() => undefined);
  });
  await page.goto("/mapa?vista=lista");
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await ready;
  await expect(page.getByText("Consultando ubicaciones…", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await expect(page.locator(".map-region")).toHaveCount(0);
  releaseFirst();
  await expect.poll(() => browser.filter(record => record.path === "/api/public/geojson" && record.failed).length).toBe(1);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await expectCanvasMap(page);
  await expect(page.locator(".map-region")).toContainText("18 ubicaciones cargadas");
  for (const view of ["Lista", "Mapa"]) await page.getByRole("button", { name: view, exact: true }).click();
  await expectCanvasMap(page);
  await page.waitForLoadState("networkidle");
  const upstream = (await fixtureRequests(request)).slice(baseline);
  expect(counts(upstream)).toMatchObject({ list: 1, geojson: 2, detail: 0 });
  expect(browser.filter(record => record.path === "/api/public/geojson")).toHaveLength(2);
  await attachReport(info, { upstream, browser, intentionallyHeldResponse: true, abortedBrowserRequests: 1, completedGeoJSONReads: 1 });
});

test.describe("costo de fichas HTML sin JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("una ficha válida consulta estado y contenido de la misma revisión", async ({ page, request }, info) => {
    const navigations: { path: string; upstream: FixtureRequest[] }[] = [];
    for (const path of [`/obras/${firstId}`, `/obras/${firstId}?revisionId=${firstRevision}`]) {
      const baseline = (await fixtureRequests(request)).length;
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("main h1")).toHaveText(firstName);
      await page.waitForLoadState("networkidle");
      const upstream = (await fixtureRequests(request)).slice(baseline);
      expect(counts(upstream)).toMatchObject({ list: 0, geojson: 0, detail: 2 });
      expect(upstream.map(entry => entry.status)).toEqual([200, 200]);
      expect(upstream.every(entry => entry.path === `/api/v1/obras/${firstId}`)).toBe(true);
      const revision = new URL(path, page.url()).searchParams.get("revisionId");
      expect(upstream.map(entry => entry.query.revisionId ?? null)).toEqual([revision, revision]);
      navigations.push({ path, upstream });
    }
    await attachReport(info, { scenario: "ficha-html-valida", javascriptEnabled: false, navigations, expectedUpstreamReadsPerNavigation: 2, preflightBodyCancelled: true });
  });

  test("una publicación ausente genera una comprobación 404 y entrega recuperación HTML", async ({ page, request }, info) => {
    const baseline = (await fixtureRequests(request)).length;
    const response = await page.goto(`/obras/${missingId}`);
    expect(response?.status()).toBe(404);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: "Explorar el catálogo", exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const upstream = (await fixtureRequests(request)).slice(baseline);
    expect(counts(upstream)).toMatchObject({ list: 0, geojson: 0, detail: 1 });
    expect(upstream[0]).toMatchObject({ path: `/api/v1/obras/${missingId}`, status: 404 });
    await attachReport(info, { scenario: "ficha-html-ausente", javascriptEnabled: false, upstream, expectedUpstreamReads: 1, preflight404EnvelopeValidated: true });
  });

  test("UUID o revisión inválidos entregan recuperación HTML sin consumir cuota de catálogo", async ({ page, request }, info) => {
    const navigations: { path: string; upstream: FixtureRequest[] }[] = [];
    for (const path of ["/obras/no-es-un-uuid", `/obras/${firstId}?revisionId=no-es-un-uuid`, `/obras/${firstId}?revisionId=${firstRevision}&revisionId=${firstRevision}`]) {
      const baseline = (await fixtureRequests(request)).length;
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator("main").getByRole("link", { name: "Explorar el catálogo", exact: true })).toBeVisible();
      await page.waitForLoadState("networkidle");
      const upstream = (await fixtureRequests(request)).slice(baseline);
      expect(upstream).toEqual([]);
      navigations.push({ path, upstream });
    }
    await attachReport(info, { scenario: "ficha-html-invalida", javascriptEnabled: false, navigations, expectedUpstreamReadsPerNavigation: 0 });
  });
});
