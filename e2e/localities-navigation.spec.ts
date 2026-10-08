/** @file Verifica conteos completos, contexto del área y navegación municipal textual en API/cartografía sintéticas aisladas. */
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { disableWebGL, hasMapColor, isolateMapNetwork, useSyntheticBasemap } from "./map-fixture";

test.beforeEach(async ({ page, request }) => {
  expect((await request.get("http://127.0.0.1:4100/__municipal-fixtures?enabled=1&failed=0&changed=0")).ok()).toBe(true);
  await isolateMapNetwork(page); await useSyntheticBasemap(page); await disableWebGL(page);
});
test.afterEach(async ({ request }) => { expect((await request.get("http://127.0.0.1:4100/__municipal-fixtures?enabled=0&failed=0&changed=0")).ok()).toBe(true); });

test("los conteos no cambian al paginar, alternar vista ni mover la cámara", async ({ page, request }) => {
  await page.goto("/mapa?vista=lista");
  const counts = page.getByRole("region", { name: "Cuántas obras podés consultar", exact: true });
  await expect(counts.locator("dd")).toHaveText(["27", "19", "8"]);
  await expect(page.locator(".work-card")).toHaveCount(20);
  await page.getByRole("button", { name: "Cargar más obras", exact: true }).click();
  await expect(page.locator(".work-card")).toHaveCount(27);
  await expect(counts.locator("dd")).toHaveText(["27", "19", "8"]);
  const baseline = (await (await request.get("http://127.0.0.1:4100/__requests")).json()).requests.length;
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await expect(page.getByRole("button", { name: "Acercar mapa", exact: true })).toBeEnabled();
  await expect.poll(() => hasMapColor(page, [148, 104, 0])).toBe(true);
  await page.getByRole("button", { name: "Acercar mapa", exact: true }).click();
  await page.getByRole("button", { name: "Mover mapa al norte", exact: true }).click();
  expect(new URL(page.url()).searchParams.has("bbox")).toBe(false);
  await expect(counts.locator("dd")).toHaveText(["27", "19", "8"]);
  const subsequent = (await (await request.get("http://127.0.0.1:4100/__requests")).json()).requests.slice(baseline);
  expect(subsequent.filter((entry: { path: string }) => entry.path === "/api/v1/obras/conteos")).toHaveLength(0);
});

test("un área vacía no oculta publicaciones sin ubicación ni las asigna al área", async ({ page }, info) => {
  await page.goto("/mapa?fuente=pergamino-obras&tieneGeometria=true&bbox=-61,-35,-60,-33&vista=lista");
  const counts = page.getByRole("region", { name: "Cuántas obras podés consultar", exact: true });
  await expect(counts.locator("dd")).toHaveText(["2", "0", "2", "0", "0"]);
  await expect(counts).toContainText("2 obras sin ubicación no pueden asignarse a esta área");
  await expect(page.locator(".work-card")).toHaveCount(0);
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  await expect(page.locator(".skip-link")).not.toBeFocused();
  await counts.screenshot({ path: info.outputPath("conteos-pergamino-area.png"), style: ".skip-link:not(:focus) { visibility: hidden; }" });
  await counts.getByRole("link", { name: /^Consultar publicaciones sin ubicación/ }).click();
  await expect(page.locator(".work-card")).toHaveCount(2);
  expect(new URL(page.url()).searchParams.get("fuente")).toBe("pergamino-obras");
  expect(new URL(page.url()).searchParams.has("bbox")).toBe(false);
  await expect(page.locator(".work-card").getByText("Publicada · Sin ubicación en el mapa", { exact: true })).toHaveCount(2);
});

test("cambiar fuente abre un listado completo sin área ni filtros previos", async ({ page }) => {
  await page.goto("/mapa?fuente=pergamino-obras&estado=IN_PROGRESS&vista=lista&cursor=fixture-offset-20");
  const switcher = page.getByRole("form", { name: "Consultar por fuente", exact: true });
  await switcher.getByRole("combobox", { name: "Fuente pública", exact: true }).selectOption("bahia-obras");
  await switcher.getByRole("button", { name: "Ver listado", exact: true }).click();
  await expect(page).toHaveURL("/mapa?fuente=bahia-obras&vista=lista");
  const params = new URL(page.url()).searchParams;
  expect([...params.keys()].sort()).toEqual(["fuente", "vista"]);
  await expect(page.locator(".work-card")).toHaveCount(1);
  const emptySwitcher = page.getByRole("form", { name: "Consultar por fuente", exact: true });
  await emptySwitcher.getByRole("combobox", { name: "Fuente pública", exact: true }).selectOption("olavarria-obras");
  await emptySwitcher.getByRole("button", { name: "Ver listado", exact: true }).click();
  await expect(page.locator(".work-card")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Cuántas obras podés consultar", exact: true }).locator("dd")).toHaveText(["0", "0", "0"]);
});

test("dentro y fuera del área suman las obras con ubicación; reflow y acceso sin JavaScript", async ({ browser }, info) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 844 } });
  try {
    const page = await context.newPage(); await isolateMapNetwork(page);
    await page.goto("http://127.0.0.1:3102/mapa?fuente=bahia-obras&bbox=-61,-35,-60,-33&vista=lista");
    const counts = page.getByRole("region", { name: "Cuántas obras podés consultar", exact: true });
    await expect(counts.locator("dd")).toHaveText(["1", "1", "0", "0", "1"]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.evaluate(() => { const style = document.createElement("style"); style.textContent = "html { font-size: 200% !important; }"; document.head.appendChild(style); });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath("locality-counts-without-js.png"), fullPage: true });
    const switcher = page.getByRole("form", { name: "Consultar por fuente", exact: true });
    await switcher.getByRole("combobox", { name: "Fuente pública", exact: true }).selectOption("pergamino-obras");
    await switcher.getByRole("button", { name: "Ver listado", exact: true }).click();
    await page.getByRole("region", { name: "Cuántas obras podés consultar", exact: true }).getByRole("link", { name: /^Consultar publicaciones sin ubicación/ }).click();
    await expect(page.locator(".work-card")).toHaveCount(2);
  } finally { await context.close(); }
});

test("fallas o cambio de catálogo ocultan cifras sin perder navegación y publicaciones", async ({ page, request }) => {
  for (const [failed, changed, text] of [["1", "0", "totales son desconocidos"], ["0", "1", "El catálogo cambió durante la lectura"]]) {
    expect((await request.get(`http://127.0.0.1:4100/__municipal-fixtures?enabled=1&failed=${failed}&changed=${changed}`)).ok()).toBe(true);
    await page.goto("/mapa?fuente=pergamino-obras&vista=lista");
    const counts = page.getByRole("region", { name: "Cuántas obras podés consultar", exact: true });
    await expect(counts).toContainText(text!); await expect(counts.locator("dd")).toHaveCount(0);
    await expect(page.locator(".work-card")).toHaveCount(2);
    await expect(counts.getByRole("link", { name: /^Consultar publicaciones sin ubicación/ })).toBeVisible();
  }
  expect((await request.get("http://127.0.0.1:4100/__municipal-fixtures?enabled=1&failed=0&changed=0")).ok()).toBe(true);
  await page.goto("/mapa?fuente=pergamino-obras&vista=lista");
  const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(report.violations).toEqual([]);
});

test("un cambio durante paginación retira lista, conteos y cifras de fuentes del corte anterior", async ({ page }) => {
  await page.goto("/mapa?vista=lista");
  const counts = page.getByRole("region", { name: "Cuántas obras podés consultar", exact: true });
  const coverage = page.getByRole("region", { name: "Publicaciones por fuente y disponibilidad en el mapa", exact: true });
  await expect(counts.locator("dd")).toHaveCount(3); await expect(coverage.locator("dd")).toHaveCount(21);
  await page.route("**/api/public/obras?*", async route => {
    const response = await route.fetch();
    const body = await response.json();
    body.catalogoVersion = "8";
    await route.fulfill({ response, json: body });
  });
  await page.getByRole("button", { name: "Cargar más obras", exact: true }).click();
  await expect(page.getByRole("heading", { name: "El catálogo cambió", exact: true })).toBeVisible();
  await expect(page.locator(".work-card")).toHaveCount(0);
  await expect(counts.locator("dd")).toHaveCount(0); await expect(coverage.locator("dd")).toHaveCount(0);
  await expect(counts).toContainText("El catálogo cambió durante la lectura");
  await expect(coverage).toContainText("El catálogo cambió durante la consulta");
});
