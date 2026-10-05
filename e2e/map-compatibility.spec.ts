/** @file Comprueba Canvas sin WebGL, teclado, selección y reflow en navegadores/viewport configurados. */
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { WorkDetail, WorkGeoJSON } from "../src/api/client";
import { disableWebGL, expectCanvasMap, hasMapColor, isolateMapNetwork, useSyntheticBasemap } from "./map-fixture";

const pointArea = "-58.451,-34.551,-58.449,-34.549";

test.beforeEach(async ({ page }) => {
  await isolateMapNetwork(page);
  await useSyntheticBasemap(page);
  await disableWebGL(page);
});

test("dibuja el mapa base sin obras y sin WebGL", async ({ page }) => {
  await page.goto(`/mapa?bbox=${pointArea}&fuente=vl-obras&vista=mapa`);
  await expect(page.getByText("No hay ubicaciones publicadas para esta zona y estos filtros.")).toBeVisible();
  await expectCanvasMap(page);
  expect(await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    return { webgl: canvas.getContext("webgl"), webgl2: canvas.getContext("webgl2"), canvas2d: Boolean(canvas.getContext("2d")) };
  })).toEqual({ webgl: null, webgl2: null, canvas2d: true });
  await expect(page.locator(".map-attribution")).toBeVisible();
  await page.getByRole("button", { name: "Acercar mapa", exact: true }).click();
  await page.getByRole("button", { name: "Mover mapa al norte", exact: true }).click();
  await expectCanvasMap(page);
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No hay obras para mostrar", exact: true })).toBeVisible();
});

test("explica con texto, colores y formas el nivel de cada fuente de datos", async ({ page }) => {
  await page.goto(`/mapa?bbox=${pointArea}&vista=mapa`);
  await expectCanvasMap(page);
  // The isolated fixture's one visible point comes from nacion-obras.
  await expect.poll(() => page.locator(".map-canvas canvas").evaluateAll(canvases => canvases.some(element => {
    const canvas = element as HTMLCanvasElement;
    if (!canvas.width || !canvas.height) return false;
    const pixels = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!pixels) return false;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      if (pixels[offset + 3]! > 240 && Math.abs(pixels[offset]!) < 4 && Math.abs(pixels[offset + 1]! - 119) < 4 && Math.abs(pixels[offset + 2]! - 168) < 4) return true;
    }
    return false;
  }))).toBe(true);
  const legend = page.getByRole("group", { name: "Referencia de fuente de datos", exact: true });
  await expect(legend).toBeVisible();
  await expect(legend.getByRole("listitem")).toHaveCount(6);
  const origins = [
    { label: "Nación", color: "#0077A8", shape: "circle" },
    { label: "Ciudad de Buenos Aires", color: "#B42332", shape: "rect" },
    { label: "Provincia de Buenos Aires", color: "#287A3A", shape: "polygon" },
    { label: "Municipio · Vicente López", color: "#946800", shape: "polygon" },
    { label: "Fuentes de distintos niveles", color: "#334155", shape: "polygon" },
    { label: "Fuente no informada", color: "#596979", shape: "circle" },
  ];
  for (const origin of origins) {
    const item = legend.getByRole("listitem").filter({ hasText: origin.label });
    await expect(item).toHaveCount(1);
    const symbol = item.locator("svg > *").first();
    expect(await symbol.evaluate(element => element.tagName.toLowerCase())).toBe(origin.shape);
    await expect(symbol).toHaveAttribute("fill", origin.color);
  }
  await expect(legend).toContainText("El color y la forma identifican quién publica los datos.");
  await expect(legend.getByRole("link", { name: "Por qué usamos estos colores", exact: true })).toHaveAttribute("href", "/proyecto#colores");
  const card = page.locator(".work-card").first();
  await expect(card.locator('.source-badge[data-source-origin="nation"]')).toContainText("Datos de: Nación");
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await expect(legend).toBeVisible();
  await expect(card.locator('.source-badge[data-source-origin="nation"]')).toBeVisible();
});

test("un fallo del proveedor conserva las obras y permite reintentar la cartografía", async ({ page }) => {
  await page.route("https://tiles.openfreemap.org/**", route => route.abort());
  await page.goto(`/mapa?bbox=${pointArea}&vista=mapa`);
  await expect(page.getByText(/No se pudo cargar una parte del mapa/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Acercar mapa", exact: true })).toBeEnabled();
  await expect(async () => {
    await page.locator(".map-canvas").click();
    await expect(page.locator(".selection-strip")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.locator(".selection-strip").getByRole("button", { name: "Ver resumen", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "EJEMPLO SINTÉTICO — Obra 01", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar resumen", exact: true }).click();
  await useSyntheticBasemap(page);
  await page.getByRole("button", { name: "Reintentar mapa", exact: true }).click();
  await expectCanvasMap(page);
});

for (const fixture of [
  { geometry: "punto", number: "01", area: pointArea, color: [0, 119, 168] },
  { geometry: "línea", number: "02", area: "-58.447,-34.549,-58.445,-34.547", color: [0, 119, 168] },
  { geometry: "polígono", number: "03", area: "-58.443,-34.547,-58.441,-34.545", color: [180, 35, 50] },
] as const) {
  test(`selecciona ${fixture.geometry} y conserva obra y revisión en el enlace`, async ({ page }) => {
    await page.goto(`/mapa?bbox=${fixture.area}&vista=mapa`);
    await expectCanvasMap(page);
    await expect(page.getByText("Ubicaciones de la consulta cargadas. Los puntos agrupados no representan un total de obras.")).toBeVisible();
    await expect(async () => {
      await page.locator(".map-canvas").click();
      await expect(page.locator(".selection-strip")).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 10000 });
    const name = `EJEMPLO SINTÉTICO — Obra ${fixture.number}`;
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.locator(".selection-strip").getByRole("heading", { name, exact: true })).toBeVisible();
    await page.locator(".selection-strip").getByRole("button", { name: "Ver resumen", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("heading", { name, exact: true })).toBeVisible();
    const id = `10000000-0000-4000-8000-${fixture.number.padStart(12, "0")}`;
    const revisionId = `20000000-0000-4000-8000-${fixture.number.padStart(12, "0")}`;
    await expect(page).toHaveURL(new RegExp(`obra=${id}&revisionId=${revisionId}`));
    await expect(page.getByRole("link", { name: "Abrir ficha completa", exact: true })).toHaveAttribute("href", `/obras/${id}?revisionId=${revisionId}`);
    await page.getByRole("button", { name: "Cerrar resumen", exact: true }).click();
    await expect(page.locator(".selection-strip")).toBeVisible();
    await expect.poll(() => hasMapColor(page, fixture.color)).toBe(true);
    await expect.poll(() => hasMapColor(page, [10, 76, 120])).toBe(true);
    await expect(page).toHaveURL(new RegExp(`obra=${id}&revisionId=${revisionId}`));
    await page.getByRole("button", { name: "Lista", exact: true }).click();
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  });
}

test("un tramo de CABA seleccionado conserva el rojo y el contorno de selección", async ({ page }) => {
  const id = "10000000-0000-4000-8000-000000000003";
  const geometry: WorkGeoJSON["features"][number]["geometry"] = {
    type: "MultiLineString", coordinates: [[[-58.4424, -34.546], [-58.4416, -34.546]]],
  };
  await page.route("**/api/public/geojson?*", async route => {
    const response = await route.fetch();
    const data: WorkGeoJSON = await response.json();
    for (const feature of data.features) if (feature.properties.obraId === id) feature.geometry = geometry;
    await route.fulfill({ response, json: data });
  });
  await page.route(`**/api/public/obras/${id}?*`, async route => {
    const response = await route.fetch();
    const work: WorkDetail = await response.json();
    work.ubicaciones[0]!.geometria = geometry;
    await route.fulfill({ response, json: work });
  });
  await page.goto("/mapa?bbox=-58.443,-34.547,-58.441,-34.545");
  await expectCanvasMap(page);
  await expect.poll(() => hasMapColor(page, [180, 35, 50])).toBe(true);
  await expect(async () => {
    await page.locator(".map-canvas").click();
    await expect(page.locator(".selection-strip")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });
  await page.locator(".selection-strip").getByRole("button", { name: "Ver resumen", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "EJEMPLO SINTÉTICO — Obra 03", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar resumen", exact: true }).click();
  await expect.poll(() => hasMapColor(page, [180, 35, 50])).toBe(true);
  await expect.poll(() => hasMapColor(page, [10, 76, 120])).toBe(true);
});

test("mover el mapa no consulta hasta confirmar el área y la lista usa esa misma zona", async ({ page }) => {
  const geoRequests: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/public/geojson?")) geoRequests.push(request.url()); });
  await page.goto(`/mapa?bbox=${pointArea}&vista=mapa&estado=IN_PROGRESS`);
  await expectCanvasMap(page);
  await expect(page.getByText("Ubicaciones de la consulta cargadas. Los puntos agrupados no representan un total de obras.")).toBeVisible();
  const initialRequests = geoRequests.length;
  const initialUrl = page.url();
  await page.getByRole("button", { name: "Mover mapa al este", exact: true }).click();
  await page.getByRole("button", { name: "Acercar mapa", exact: true }).click();
  expect(page.url()).toBe(initialUrl);
  expect(geoRequests).toHaveLength(initialRequests);
  const geoResponses = new Map<string, WorkGeoJSON>();
  await page.route("**/api/public/geojson?*", async route => {
    // Read the payload before serving it: confirming the area navigates the page,
    // so Chromium can discard its response body before the assertion reads it.
    const response = await route.fetch();
    geoResponses.set(route.request().url(), await response.json());
    await route.fulfill({ response });
  });
  const responsePromise = page.waitForResponse(response => response.url().includes("/api/public/geojson?") && response.status() === 200);
  await page.getByRole("button", { name: "Buscar en esta zona", exact: true }).click();
  const response = await responsePromise;
  const committedArea = new URL(page.url()).searchParams.get("bbox");
  expect(committedArea).not.toBe(pointArea);
  expect(new URL(response.url()).searchParams.get("bbox")).toBe(committedArea);
  expect(new URL(response.url()).searchParams.get("estado")).toBe("IN_PROGRESS");
  const geo = geoResponses.get(response.url());
  expect(geo).toBeDefined();
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await expect(page.getByRole("button", { name: "Lista", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(new URL(page.url()).searchParams.get("bbox")).toBe(committedArea);
  expect(new URL(page.url()).searchParams.get("estado")).toBe("IN_PROGRESS");
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(new Set(geo!.features.map(feature => feature.properties.obraId)).size);
  await page.reload();
  expect(new URL(page.url()).searchParams.get("bbox")).toBe(committedArea);
});

test("el mapa y sus controles se adaptan al ancho y al cambio de orientación", async ({ page }) => {
  await page.goto(`/mapa?bbox=${pointArea}&vista=mapa`);
  await expectCanvasMap(page);
  const viewport = page.viewportSize()!;
  for (const size of [viewport, { width: viewport.height, height: viewport.width }]) {
    await page.setViewportSize(size);
    await expectCanvasMap(page);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const map = await page.locator(".map-canvas").boundingBox();
    expect(map!.width).toBeGreaterThan(250);
    expect(map!.height).toBeGreaterThanOrEqual(240);
    expect(map!.x + map!.width).toBeLessThanOrEqual(size.width + 1);
    for (const button of await page.getByRole("group", { name: "Controles del mapa", exact: true }).getByRole("button").all()) {
      const box = await button.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  }
  const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(report.violations).toEqual([]);
});

test("lista y mapa pueden alternarse sin acumular lienzos ni perder filtros", async ({ page }) => {
  await page.goto(`/mapa?bbox=${pointArea}&vista=mapa&estado=IN_PROGRESS`);
  await expectCanvasMap(page);
  const canvasCount = await page.locator(".map-canvas canvas").count();
  for (let iteration = 0; iteration < 3; iteration++) {
    await page.getByRole("button", { name: "Lista", exact: true }).click();
    await expect(page.locator(".map-canvas")).toHaveCount(0);
    await page.getByRole("button", { name: "Mapa", exact: true }).click();
    await expectCanvasMap(page);
    await expect(page.locator(".map-canvas canvas")).toHaveCount(canvasCount);
    expect(new URL(page.url()).searchParams.get("estado")).toBe("IN_PROGRESS");
  }
});
