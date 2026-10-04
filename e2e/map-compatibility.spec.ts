import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { disableWebGL, expectCanvasMap, isolateMapNetwork, useSyntheticBasemap } from "./map-fixture";

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

test("un fallo del proveedor conserva las obras y permite reintentar la cartografía", async ({ page }) => {
  await page.route("https://tiles.openfreemap.org/**", route => route.abort());
  await page.goto(`/mapa?bbox=${pointArea}&vista=mapa`);
  await expect(page.getByText(/No se pudo cargar una parte del mapa/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Acercar mapa", exact: true })).toBeEnabled();
  await expect(async () => {
    await page.locator(".map-canvas").click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });
  await expect(page.getByRole("dialog").getByRole("heading", { name: "EJEMPLO SINTÉTICO — Obra 01", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar resumen", exact: true }).click();
  await useSyntheticBasemap(page);
  await page.getByRole("button", { name: "Reintentar mapa", exact: true }).click();
  await expectCanvasMap(page);
});

for (const fixture of [
  { geometry: "punto", number: "01", area: pointArea },
  { geometry: "línea", number: "02", area: "-58.447,-34.549,-58.445,-34.547" },
  { geometry: "polígono", number: "03", area: "-58.443,-34.547,-58.441,-34.545" },
]) {
  test(`selecciona ${fixture.geometry} y conserva obra y revisión en el enlace`, async ({ page }) => {
    await page.goto(`/mapa?bbox=${fixture.area}&vista=mapa`);
    await expectCanvasMap(page);
    await expect(page.getByText("Ubicaciones de la consulta cargadas. Los puntos agrupados no representan un total de obras.")).toBeVisible();
    await expect(async () => {
      await page.locator(".map-canvas").click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 10000 });
    const name = `EJEMPLO SINTÉTICO — Obra ${fixture.number}`;
    await expect(page.getByRole("dialog").getByRole("heading", { name, exact: true })).toBeVisible();
    const id = `10000000-0000-4000-8000-${fixture.number.padStart(12, "0")}`;
    const revisionId = `20000000-0000-4000-8000-${fixture.number.padStart(12, "0")}`;
    await expect(page).toHaveURL(new RegExp(`obra=${id}&revisionId=${revisionId}`));
    await expect(page.getByRole("link", { name: "Abrir ficha completa", exact: true })).toHaveAttribute("href", `/obras/${id}?revisionId=${revisionId}`);
    await page.getByRole("button", { name: "Cerrar resumen", exact: true }).click();
    await page.getByRole("button", { name: "Lista", exact: true }).click();
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  });
}

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
  const responsePromise = page.waitForResponse(response => response.url().includes("/api/public/geojson?") && response.status() === 200);
  await page.getByRole("button", { name: "Buscar en esta zona", exact: true }).click();
  const response = await responsePromise;
  const committedArea = new URL(page.url()).searchParams.get("bbox");
  expect(committedArea).not.toBe(pointArea);
  expect(new URL(response.url()).searchParams.get("bbox")).toBe(committedArea);
  expect(new URL(response.url()).searchParams.get("estado")).toBe("IN_PROGRESS");
  const geo = await response.json();
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await expect(page.getByRole("button", { name: "Lista", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(new URL(page.url()).searchParams.get("bbox")).toBe(committedArea);
  expect(new URL(page.url()).searchParams.get("estado")).toBe("IN_PROGRESS");
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(new Set(geo.features.map((feature: { properties: { obraId: string } }) => feature.properties.obraId)).size);
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
