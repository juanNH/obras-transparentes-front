import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expectCanvasMap, isolateMapNetwork, useSyntheticBasemap } from "./map-fixture";

const firstId = "10000000-0000-4000-8000-000000000001";
const firstRevision = "20000000-0000-4000-8000-000000000001";
const firstName = "EJEMPLO SINTÉTICO — Obra 01";
const detailHref = `/obras/${firstId}?revisionId=${firstRevision}`;

test.beforeEach(async ({ page }) => {
  // The UI tests never depend on a remote tile service or transmit browsing locations.
  await isolateMapNetwork(page);
});

test("landing, lista y ficha son accesibles y tienen HTML indexable", async ({ page, request }) => {
  const fontRequests: string[] = [];
  const loadedFonts = new Set<string>();
  page.on("request", request => { if (request.resourceType() === "font") fontRequests.push(request.url()); });
  page.on("response", response => { if (response.request().resourceType() === "font" && response.ok()) loadedFonts.add(response.url()); });
  for (const path of ["/", "/mapa", detailHref]) {
    await page.goto(path);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "es-AR");
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => {
      let loaded = false;
      document.fonts.forEach(font => { if (font.family.includes("Noto Sans") && font.status === "loaded") loaded = true; });
      return loaded;
    })).toBe(true);
    expect(await page.locator("body").evaluate(body => getComputedStyle(body).fontFamily)).toContain("Noto Sans");
    const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(report.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  const response = await request.get(detailHref);
  const html = await response.text();
  expect(html).toContain(firstName);
  expect(html).toContain('rel="canonical"');
  expect(html).toContain("og:title");
  expect(fontRequests.length).toBeGreaterThan(0);
  for (const url of fontRequests) {
    expect(new URL(url).origin).toBe(new URL(page.url()).origin);
    expect(loadedFonts.has(url)).toBe(true);
  }
});

test("lista pagina sin duplicar obras y abre/cierra resumen con foco", async ({ page }) => {
  await page.goto("/mapa");
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(20);
  await page.getByRole("button", { name: "Cargar más obras", exact: true }).click();
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(24);
  const summary = page.locator(".results-list").getByRole("button", { name: /^Ver resumen/ }).first();
  await summary.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: firstName })).toBeVisible();
  const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(report.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(summary).toBeFocused();
});

test("landing, filtros y ficha conservan reflow a 320 px con texto al 200 %", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  for (const path of ["/", "/mapa", detailHref]) {
    await page.goto(path);
    await expect(page.locator("main h1")).toBeVisible();
    if (path === "/mapa") await page.getByText("Filtrar obras", { exact: true }).click();
    if (path === detailHref) {
      await page.getByText("Identificación del recurso fuente", { exact: true }).first().click();
      await page.getByText("Procedencia de los datos", { exact: true }).click();
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const paragraph = page.locator("main p").first();
    const initialFontSize = await paragraph.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize));
    // Increase the user's root text size without patching component dimensions.
    // Browser-native zoom and assistive technology still require manual review.
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    await expect.poll(() => paragraph.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(initialFontSize * 1.95);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (path === "/mapa") {
      await page.getByRole("combobox", { name: "Ubicación", exact: true }).selectOption("false");
      await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
      await expect(page).toHaveURL(/tieneGeometria=false/);
      await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(6);
    }
  }
});

test("colores forzados y movimiento reducido conservan selección y foco por teclado", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await useSyntheticBasemap(page);
  // The rendering probe samples the center; keep it inside the synthetic land.
  await page.goto("/mapa?bbox=-58.451,-34.551,-58.449,-34.549&vista=lista");
  const listButton = page.getByRole("button", { name: "Lista", exact: true });
  const mapButton = page.getByRole("button", { name: "Mapa", exact: true });
  await expect(listButton).toBeEnabled();
  await expect(listButton).toHaveAttribute("aria-pressed", "true");
  await listButton.focus();
  await page.keyboard.press("Tab");
  await expect(mapButton).toBeFocused();
  const outline = await mapButton.evaluate(element => {
    const style = getComputedStyle(element);
    return { width: Number.parseFloat(style.outlineWidth), style: style.outlineStyle, color: style.outlineColor, background: style.backgroundColor };
  });
  expect(outline.width).toBeGreaterThanOrEqual(2);
  expect(outline.style).not.toBe("none");
  expect(outline.color).not.toBe(outline.background);
  await page.keyboard.press("Enter");
  await expect(mapButton).toHaveAttribute("aria-pressed", "true");
  await expect(listButton).toHaveAttribute("aria-pressed", "false");
  await expectCanvasMap(page);
  await listButton.focus();
  await page.keyboard.press("Enter");
  await expect(listButton).toHaveAttribute("aria-pressed", "true");
  const summary = page.locator(".results-list").getByRole("button", { name: /^Ver resumen/ }).first();
  await summary.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: firstName })).toBeVisible();
  expect(await dialog.evaluate(element => getComputedStyle(element).transitionDuration.split(",").every(duration => Number.parseFloat(duration) <= 0.001))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(summary).toBeFocused();
});

test("la selección compartible restaura la revisión con Atrás, Adelante y recarga", async ({ page }) => {
  await page.goto("/mapa");
  await page.locator(".results-list").getByRole("button", { name: /^Ver resumen/ }).first().click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: firstName })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`obra=${firstId}&revisionId=${firstRevision}`));
  await page.goBack();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page).not.toHaveURL(/obra=/);
  await page.goForward();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".selection-strip").getByRole("heading", { name: firstName })).toBeVisible();
  await expect(page.locator(".work-card.selected")).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".selection-strip").getByRole("heading", { name: firstName })).toBeVisible();
  await page.locator(".selection-strip").getByRole("button", { name: "Ver resumen", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: firstName })).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir ficha completa", exact: true })).toHaveAttribute("href", detailHref);
});

test("filtros compartibles incluyen obras sin ubicación y estados vacíos", async ({ page }) => {
  await page.goto("/mapa");
  await page.getByText("Filtrar obras", { exact: true }).click();
  await page.getByRole("combobox", { name: "Ubicación", exact: true }).selectOption("false");
  await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  await expect(page).toHaveURL(/tieneGeometria=false/);
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(6);
  await page.reload();
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(6);
  await page.goto("/mapa?fuente=vl-obras");
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(0);
  await expect(page.getByText(/no encontramos obras|no hay obras/i).first()).toBeVisible();
});

test("la ubicación se pide solo por acción y su rechazo conserva alternativa manual", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { locationCalls: number }).locationCalls = 0;
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition(_success: PositionCallback, failure?: PositionErrorCallback) {
        (window as unknown as { locationCalls: number }).locationCalls += 1;
        failure?.({ code: 1, message: "Denied for test", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
      } },
    });
  });
  await page.goto("/mapa");
  expect(await page.evaluate(() => (window as unknown as { locationCalls: number }).locationCalls)).toBe(0);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { locationCalls: number }).locationCalls)).toBe(0);
  await page.getByRole("button", { name: "Usar mi ubicación", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { locationCalls: number }).locationCalls)).toBe(1);
  await expect(page.getByText("No pudimos obtener tu ubicación. Podés mover el mapa o explorar todas las obras en la lista.")).toBeVisible();
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await expect(page.getByRole("link", { name: /^Ver ficha/ }).first()).toBeVisible();
});

test("la ubicación concedida no se comparte ni consulta hasta Buscar en esta zona", async ({ page }) => {
  await useSyntheticBasemap(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
      getCurrentPosition(success: PositionCallback) {
        success({ coords: { longitude: -58.45, latitude: -34.55, accuracy: 100, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() } as GeolocationPosition);
      },
    } });
  });
  const geoRequests: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/public/geojson?")) geoRequests.push(request.url()); });
  await page.goto("/mapa?vista=lista");
  const initialGeo = page.waitForResponse(response => response.url().includes("/api/public/geojson?") && response.status() === 200);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await initialGeo;
  await expect(page.getByText("Ubicaciones de la consulta cargadas. Los puntos agrupados no representan un total de obras.")).toBeVisible();
  const previousUrl = page.url();
  const previousRequests = geoRequests.length;
  await page.getByRole("button", { name: "Usar mi ubicación", exact: true }).click();
  await expect(page.getByText(/Mapa centrado cerca tuyo\./)).toBeVisible();
  expect(page.url()).toBe(previousUrl);
  expect(geoRequests).toHaveLength(previousRequests);
  const newGeo = page.waitForResponse(response => response.url().includes("/api/public/geojson?") && response.status() === 200);
  await page.getByRole("button", { name: "Buscar en esta zona", exact: true }).click();
  await newGeo;
  expect(geoRequests.length).toBeGreaterThan(previousRequests);
  const bbox = new URL(page.url()).searchParams.get("bbox")!.split(",").map(Number);
  expect((bbox[0]! + bbox[2]!) / 2).toBeCloseTo(-58.45, 1);
  expect((bbox[1]! + bbox[3]!) / 2).toBeCloseTo(-34.55, 1);
});

test("retira resultados anteriores si cambia el catálogo durante la paginación", async ({ page }) => {
  await page.goto("/mapa");
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(20);
  await page.route("**/api/public/obras?*", route => route.fulfill({
    status: 409,
    contentType: "application/json",
    body: JSON.stringify({ error: { code: "CATALOG_CHANGED", message: "El catálogo cambió." } }),
  }));
  await page.getByRole("button", { name: "Cargar más obras", exact: true }).click();
  await expect(page.getByRole("heading", { name: "El catálogo cambió", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Reiniciar consulta", exact: true })).toHaveAttribute("href", "/mapa");
});

test("no mezcla ubicaciones con otra versión del listado", async ({ page }) => {
  await page.route("**/api/public/geojson?*", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ type: "FeatureCollection", features: [], nextCursor: null, catalogoVersion: "8" }),
  }));
  await page.goto("/mapa?estado=IN_PROGRESS");
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await expect(page.getByRole("heading", { name: "El catálogo cambió", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Reiniciar consulta", exact: true })).toHaveAttribute("href", /estado=IN_PROGRESS/);
});

test("el mapa se carga al elegirlo y un fallo del proveedor permite seguir con la lista", async ({ page }) => {
  const mapRequests: string[] = [];
  page.on("request", request => { if (/openfreemap/.test(request.url())) mapRequests.push(request.url()); });
  await page.goto("/mapa?vista=lista");
  expect(mapRequests).toHaveLength(0);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await expect(page.getByText(/no se pudo cargar una parte del mapa|no pudimos mostrar el mapa/i)).toBeVisible();
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await expect(page.getByRole("link", { name: /^Ver ficha/ }).first()).toBeVisible();
});

test("el proxy público rechaza rutas privadas, filtros extra y escrituras", async ({ request }) => {
  expect((await request.get("/api/public/admin")).status()).toBe(404);
  expect((await request.get("/api/public/obras?extra=true")).status()).toBe(400);
  expect((await request.post("/api/public/obras", { data: {} })).status()).toBe(405);
});

test.describe("HTML sin JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("permite leer fichas y pasar a la segunda página", async ({ page }) => {
    await page.goto("/mapa");
    await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(20);
    await page.getByRole("link", { name: "Página siguiente sin JavaScript", exact: true }).click();
    await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(4);
    await page.getByRole("link", { name: /^Ver ficha/ }).first().click();
    await expect(page.locator("main h1")).toContainText("EJEMPLO SINTÉTICO");
  });
});
