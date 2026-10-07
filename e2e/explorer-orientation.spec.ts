/** @file Comprueba relación lista/mapa/selección, área explícita y navegación con API/cartografía aisladas. */
import { expect, test, type Page } from "@playwright/test";
import { disableWebGL, isolateMapNetwork, useSyntheticBasemap } from "./map-fixture";

const firstId = "10000000-0000-4000-8000-000000000001";
const firstRevision = "20000000-0000-4000-8000-000000000001";
const firstName = "EJEMPLO SINTÉTICO — Obra 01";

test.beforeEach(async ({ page }) => {
  await isolateMapNetwork(page);
  await useSyntheticBasemap(page);
  await disableWebGL(page);
});

// The synthetic basemap has no work-category colors. This checks actual work pixels,
// rather than interpreting a painted background as a visible publication.
async function hasWorkPixels(page: Page) {
  return page.locator(".map-canvas canvas").evaluateAll(canvases => canvases.some(element => {
    const canvas = element as HTMLCanvasElement;
    if (!canvas.width || !canvas.height) return false;
    const pixels = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!pixels) return false;
    const workColors = [[0, 119, 168], [180, 35, 50], [40, 122, 58], [148, 104, 0], [51, 65, 85], [89, 105, 121], [10, 76, 120]];
    for (let offset = 0; offset < pixels.length; offset += 4) {
      if (pixels[offset + 3]! > 240 && workColors.some(([red, green, blue]) =>
        Math.abs(pixels[offset]! - red!) < 4 && Math.abs(pixels[offset + 1]! - green!) < 4 && Math.abs(pixels[offset + 2]! - blue!) < 4)) return true;
    }
    return false;
  }));
}

test("la entrada conserva todo el catálogo y alternar vistas conserva páginas y selección", async ({ page }) => {
  const geoRequests: string[] = [];
  const detailRequests: string[] = [];
  page.on("request", request => {
    if (request.url().includes("/api/public/geojson?")) geoRequests.push(request.url());
    if (request.url().includes(`/api/public/obras/${firstId}?`)) detailRequests.push(request.url());
  });
  const geo = page.waitForResponse(response => response.url().includes("/api/public/geojson?") && response.ok());
  await page.goto("/mapa");
  await geo;
  await expect(page.getByRole("button", { name: "Mapa", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".scope-note")).toContainText("Todas las obras publicadas");
  await expect(page.locator(".scope-note")).toContainText("Sin filtro de área. Incluye obras con y sin ubicación aprobada.");
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(20);
  await expect(page.locator(".unlocated-notice")).toContainText("5 obras cargadas no aparecen en el mapa.");
  expect(new URL(page.url()).searchParams.has("bbox")).toBe(false);
  expect(new URL(geoRequests[0]!).searchParams.get("bbox")).toBe("-180,-85.051129,180,85.051129");
  await expect.poll(() => hasWorkPixels(page)).toBe(true);
  await page.getByRole("button", { name: "Cargar más obras", exact: true }).click();
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(24);
  await page.locator(".results-list").getByRole("button", { name: /^Ver en mapa/ }).first().click();
  await expect(page.locator(".selection-strip").getByRole("heading", { name: firstName, exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  for (const view of ["Lista", "Mapa", "Lista", "Mapa"]) {
    await page.getByRole("button", { name: view, exact: true }).click();
    await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(24);
    await expect(page.locator(".work-card.selected")).toHaveCount(1);
    expect(new URL(page.url()).searchParams.get("obra")).toBe(firstId);
    expect(new URL(page.url()).searchParams.get("revisionId")).toBe(firstRevision);
    expect(new URL(page.url()).searchParams.has("bbox")).toBe(false);
  }
  expect(geoRequests).toHaveLength(1);
  expect(detailRequests).toHaveLength(1);
  await expect(page.getByRole("button", { name: "Cargar más obras", exact: true })).toHaveCount(0);
});

test("el encuadre inicial muestra las ubicaciones y solo confirmar convierte la cámara en filtro", async ({ page }) => {
  const geo = page.waitForResponse(response => response.url().includes("/api/public/geojson?") && response.ok());
  await page.goto("/mapa");
  await geo;
  await expect.poll(() => hasWorkPixels(page)).toBe(true);
  expect(new URL(page.url()).searchParams.has("bbox")).toBe(false);
  const searched = page.waitForResponse(response => response.url().includes("/api/public/geojson?") && response.ok());
  await page.getByRole("button", { name: "Buscar en esta zona", exact: true }).click();
  const response = await searched;
  const params = new URL(page.url()).searchParams;
  const bbox = params.get("bbox")!.split(",").map(Number);
  expect(bbox[2]! - bbox[0]!).toBeLessThan(1);
  expect(bbox[3]! - bbox[1]!).toBeLessThan(1);
  expect(bbox[0]!).toBeLessThan(-58.45);
  expect(bbox[2]!).toBeGreaterThan(-58.362);
  expect(new URL(response.url()).searchParams.get("bbox")).toBe(params.get("bbox"));
  await expect(page.locator(".scope-note")).toContainText("Consulta por área");
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(18);
});

test("una cámara sin ubicaciones no oculta las obras publicadas ni reduce el catálogo", async ({ page }) => {
  await page.route("**/api/public/geojson?*", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ type: "FeatureCollection", features: [], nextCursor: null, catalogoVersion: "7" }),
  }));
  await page.goto("/mapa");
  await expect(page.getByText("No hay ubicaciones publicadas para esta zona y estos filtros.")).toBeVisible();
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(20);
  await expect(page.locator(".results-heading")).toContainText("20 obras cargadas");
  await expect(page.getByRole("heading", { name: "No hay obras para mostrar", exact: true })).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has("bbox")).toBe(false);
  await expect(page.getByRole("button", { name: "Acercar mapa", exact: true })).toBeEnabled();
  expect(await hasWorkPixels(page)).toBe(false);
});

test("las obras sin ubicación siguen visibles en modo mapa y nunca reciben puntos inventados", async ({ page }) => {
  const geoRequests: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/public/geojson?")) geoRequests.push(request.url()); });
  await page.goto("/mapa?tieneGeometria=false");
  await expect(page.getByRole("button", { name: "Mapa", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(6);
  await expect(page.getByText("Estas obras no tienen ubicación aprobada. Podés leerlas en los resultados; no les asignamos puntos en el mapa.")).toBeVisible();
  await expect(page.locator(".results-list").getByRole("button", { name: /^Ver en mapa/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Acercar mapa", exact: true })).toBeEnabled();
  expect(await hasWorkPixels(page)).toBe(false);
  await page.locator(".results-list").getByRole("button", { name: /^Ver resumen/ }).first().click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "EJEMPLO SINTÉTICO — Obra 04", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar resumen", exact: true }).click();
  await expect(page.locator(".selection-strip")).toContainText("Sin ubicación aprobada.");
  expect(await hasWorkPixels(page)).toBe(false);
  expect(geoRequests).toHaveLength(0);
  expect(new URL(page.url()).searchParams.get("tieneGeometria")).toBe("false");
  expect(new URL(page.url()).searchParams.has("bbox")).toBe(false);
});

test("Ver en mapa encuadra la revisión exacta aunque su geometría no esté cargada en la consulta", async ({ page }) => {
  let geoRequests = 0;
  let detailRequests = 0;
  await page.route("**/api/public/geojson?*", route => {
    geoRequests++;
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ type: "FeatureCollection", features: [], nextCursor: null, catalogoVersion: "7" }) });
  });
  await page.route(`**/api/public/obras/${firstId}?*`, async route => {
    detailRequests++;
    expect(new URL(route.request().url()).searchParams.get("revisionId")).toBe(firstRevision);
    const response = await route.fetch();
    const detail = await response.json();
    // Change only the isolated synthetic response. No fixture is published or saved.
    detail.ubicaciones[0].geometria = { type: "Point", coordinates: [-80, -34] };
    await route.fulfill({ response, json: detail });
  });
  await page.goto("/mapa");
  await expect(page.getByText("No hay ubicaciones publicadas para esta zona y estos filtros.")).toBeVisible();
  await page.locator(".results-list").getByRole("button", { name: /^Ver en mapa/ }).first().click();
  await expect(page.locator(".selection-strip").getByRole("heading", { name: firstName, exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect.poll(() => hasWorkPixels(page)).toBe(true);
  await expect(page.locator(".map-region")).toBeFocused();
  expect(geoRequests).toBe(1);
  expect(detailRequests).toBe(1);
  expect(new URL(page.url()).searchParams.has("bbox")).toBe(false);
  await page.getByRole("button", { name: "Mover mapa al este", exact: true }).click();
  await page.locator(".results-list").getByRole("button", { name: /^Ver en mapa/ }).first().click();
  await expect.poll(() => hasWorkPixels(page)).toBe(true);
  expect(geoRequests).toBe(1);
  expect(detailRequests).toBe(1);
  const searched = page.waitForResponse(response => response.url().includes("/api/public/geojson?") && response.ok());
  await page.getByRole("button", { name: "Buscar en esta zona", exact: true }).click();
  await searched;
  const bbox = new URL(page.url()).searchParams.get("bbox")!.split(",").map(Number);
  expect(bbox[0]!).toBeLessThan(-80);
  expect(bbox[2]!).toBeGreaterThan(-80);
  expect(bbox[2]! - bbox[0]!).toBeLessThan(1);
  expect((bbox[0]! + bbox[2]!) / 2).toBeCloseTo(-80, 4);
  expect((bbox[1]! + bbox[3]!) / 2).toBeCloseTo(-34, 4);
});

test("alternar la vista conserva el cursor compartido y sus resultados", async ({ page }) => {
  await page.goto("/mapa?cursor=fixture-offset-20&vista=lista");
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(4);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(4);
  expect(new URL(page.url()).searchParams.get("cursor")).toBe("fixture-offset-20");
  expect(new URL(page.url()).searchParams.has("bbox")).toBe(false);
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(4);
  await page.reload();
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(4);
  expect(new URL(page.url()).searchParams.get("cursor")).toBe("fixture-offset-20");
});

test("alternar vistas conserva centro y zoom después de seleccionar y mover la cámara", async ({ page }) => {
  const area = "-58.451,-34.551,-58.449,-34.549";
  const geoRequests: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/public/geojson?")) geoRequests.push(request.url()); });

  async function commitMovedCamera(toggleViews: boolean) {
    await page.goto(`/mapa?bbox=${area}`);
    await page.locator(".results-list").getByRole("button", { name: /^Ver en mapa/ }).first().click();
    await expect(page.locator(".selection-strip").getByRole("heading", { name: firstName, exact: true })).toBeVisible();
    await expect.poll(() => hasWorkPixels(page)).toBe(true);
    await page.getByRole("button", { name: "Acercar mapa", exact: true }).click();
    await page.getByRole("button", { name: "Mover mapa al norte", exact: true }).click();
    // Finish the browser render before saving the visible area. No OpenLayers
    // internals or production-only testing hooks are used to inspect its view.
    await page.locator(".map-canvas").screenshot();
    const requestsBeforeToggle = geoRequests.length;
    if (toggleViews) {
      await page.getByRole("button", { name: "Lista", exact: true }).click();
      await expect(page.locator(".map-canvas")).toHaveCount(0);
      await page.getByRole("button", { name: "Mapa", exact: true }).click();
      await expect(page.getByRole("button", { name: "Acercar mapa", exact: true })).toBeEnabled();
      await page.locator(".map-canvas").screenshot();
    }
    expect(geoRequests).toHaveLength(requestsBeforeToggle);
    expect(new URL(page.url()).searchParams.get("bbox")).toBe(area);
    expect(new URL(page.url()).searchParams.get("obra")).toBe(firstId);
    expect(new URL(page.url()).searchParams.get("revisionId")).toBe(firstRevision);
    await expect(page.locator(".work-card.selected")).toHaveCount(1);
    const searched = page.waitForResponse(response => response.url().includes("/api/public/geojson?") && response.ok());
    await page.getByRole("button", { name: "Buscar en esta zona", exact: true }).click();
    const response = await searched;
    const committed = new URL(page.url()).searchParams.get("bbox")!;
    expect(new URL(response.url()).searchParams.get("bbox")).toBe(committed);
    return committed.split(",").map(Number);
  }

  const direct = await commitMovedCamera(false);
  const afterToggle = await commitMovedCamera(true);
  for (let index = 0; index < 4; index++) expect(afterToggle[index]!).toBeCloseTo(direct[index]!, 6);
  expect((direct[1]! + direct[3]!) / 2).toBeGreaterThan(-34.55);
  expect(afterToggle[2]! - afterToggle[0]!).toBeCloseTo(direct[2]! - direct[0]!, 6);
  expect(afterToggle[3]! - afterToggle[1]!).toBeCloseTo(direct[3]! - direct[1]!, 6);
});

test("quitar la selección devuelve el foco al mapa y limpia la obra y revisión del enlace", async ({ page }) => {
  await page.goto("/mapa");
  await page.locator(".results-list").getByRole("button", { name: /^Ver en mapa/ }).first().click();
  await expect(page.locator(".selection-strip").getByRole("heading", { name: firstName, exact: true })).toBeVisible();
  await expect(page.locator(".work-card.selected")).toHaveCount(1);
  const clear = page.locator(".selection-strip").getByRole("button", { name: "Quitar selección", exact: true });
  await clear.focus();
  await expect(clear).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".selection-strip")).toHaveCount(0);
  await expect(page.locator(".map-region")).toBeFocused();
  await expect(page.locator(".map-region")).toHaveAttribute("tabindex", "-1");
  await expect(page.locator(".work-card.selected")).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has("obra")).toBe(false);
  expect(new URL(page.url()).searchParams.has("revisionId")).toBe(false);
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(20);
});
