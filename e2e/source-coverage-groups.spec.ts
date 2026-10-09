/** @file Comprueba cobertura compacta por provincia, búsqueda local y accesibilidad con API sintética aislada. */
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { isolateMapNetwork } from "./map-fixture";
import { openSourceCoverage } from "./source-coverage-fixture";

test.beforeEach(async ({ page, request }) => {
  expect(
    (
      await request.get(
        "http://127.0.0.1:4100/__municipal-fixtures?enabled=0&failed=0&changed=0",
      )
    ).ok(),
  ).toBe(true);
  await isolateMapNetwork(page);
});
test.afterEach(async ({ request }) => {
  expect(
    (
      await request.get(
        "http://127.0.0.1:4100/__municipal-fixtures?enabled=0&failed=0&changed=0",
      )
    ).ok(),
  ).toBe(true);
});

test("empieza compacto y contiene fuentes municipales bajo su provincia declarada", async ({
  page,
}, info) => {
  await page.goto("/mapa?vista=lista");
  const panel = page.getByRole("region", {
    name: "Publicaciones por provincia y fuente",
    exact: true,
  });
  const overview = panel.locator(".source-coverage-overview");
  await expect(overview).not.toHaveAttribute("open");
  expect((await panel.boundingBox())!.height).toBeLessThan(175);
  await expect(page.locator(".work-card")).toHaveCount(20);
  await overview.locator(":scope > summary").click();
  await expect(panel.locator(".source-coverage-group")).toHaveCount(3);
  const buenosAires = panel.locator('[data-scope="provincia-06"]');
  await expect(buenosAires.locator(":scope > summary")).toContainText(
    "Buenos Aires",
  );
  await expect(buenosAires.locator(":scope > summary")).toContainText(
    "5 fuentes",
  );
  await buenosAires.locator(":scope > summary").click();
  await expect(buenosAires.locator('[data-source="vl-obras"]')).toBeVisible();
  await expect(
    buenosAires.locator('[data-source="bahia-obras"]'),
  ).toBeVisible();
  await expect(buenosAires.locator('[data-source="nacion-obras"]')).toHaveCount(
    0,
  );
  await expect(
    panel.locator('[data-scope="nacional"] [data-source="nacion-obras"]'),
  ).toHaveCount(1);
  await expect(
    panel.locator(
      '[data-scope="provincia-02"] [data-source="caba-actualizado"]',
    ),
  ).toHaveCount(1);
  await expect(panel).toContainText("no acredita dónde están sus obras");
  await panel.screenshot({
    path: info.outputPath("cobertura-por-provincia.png"),
    style: ".skip-link:not(:focus) { visibility: hidden; }",
  });
});

test("buscar un municipio abre su provincia sin cambiar obras ni pedir nuevas lecturas", async ({
  page,
  request,
}) => {
  await page.goto("/mapa?estado=IN_PROGRESS&vista=lista");
  const panel = page.getByRole("region", {
    name: "Publicaciones por provincia y fuente",
    exact: true,
  });
  await panel.locator(".source-coverage-overview > summary").click();
  const baseline = (
    await (await request.get("http://127.0.0.1:4100/__requests")).json()
  ).requests.length;
  const initialCards = await page.locator(".work-card").count();
  const search = panel.getByRole("searchbox", {
    name: "Buscar provincia, municipio o fuente",
    exact: true,
  });
  await search.fill("vicente lopez");
  await expect(panel.getByRole("status")).toHaveText("1 fuente encontrada.");
  await expect(panel.locator(".source-coverage-group")).toHaveCount(1);
  await expect(panel.locator('[data-scope="provincia-06"]')).toHaveAttribute(
    "open",
  );
  await expect(panel.locator('[data-source="vl-obras"]')).toBeVisible();
  await expect(
    panel.getByRole("link", { name: /^Ver listado de esta fuente/ }),
  ).toHaveAttribute("href", "/mapa?fuente=vl-obras&vista=lista");
  await expect(
    panel.getByRole("link", { name: /^Ver listado de esta fuente/ }),
  ).toBeVisible();
  await expect(page.locator(".work-card")).toHaveCount(initialCards);
  await expect(page).toHaveURL("/mapa?estado=IN_PROGRESS&vista=lista");
  expect(
    (await (await request.get("http://127.0.0.1:4100/__requests")).json())
      .requests.length,
  ).toBe(baseline);
  await search.fill("");
  await expect(panel.locator(".source-coverage-group")).toHaveCount(3);
  await expect(
    panel.locator('[data-scope="provincia-06"]'),
  ).not.toHaveAttribute("open");
  await search.fill("Fuente inexistente");
  await expect(panel).toContainText("No hay fuentes que coincidan");
  await expect(panel.getByRole("status")).toHaveText("0 fuentes encontradas.");
  await search.fill("");
  await expect(panel.locator(".source-coverage-group")).toHaveCount(3);
  await expect(
    panel.locator('[data-scope="provincia-06"]'),
  ).not.toHaveAttribute("open");
  await page.goto("/mapa?fuente=vl-obras&vista=lista");
  await search.fill("nacion");
  await expect(panel.locator('[data-scope="provincia-06"]')).toHaveCount(0);
  await search.fill("");
  await expect(panel.locator('[data-scope="provincia-06"]')).toHaveAttribute(
    "open",
  );
  await expect(
    panel.locator('[data-source="vl-obras"] > details'),
  ).toHaveAttribute("open");
});

test("fuente vacía conserva cero y error conserva alcance por confirmar y acceso a lista", async ({
  page,
  request,
}) => {
  await page.goto("/mapa?fuente=pba-edificios&vista=lista");
  let panel = await openSourceCoverage(page);
  const provinceSource = panel.locator('[data-source="pba-edificios"]');
  await expect(provinceSource).toContainText("Fuente sin publicaciones");
  await expect(provinceSource.locator("dd")).toHaveText(["0", "0", "0", "0"]);
  expect(
    (
      await request.get(
        "http://127.0.0.1:4100/__municipal-fixtures?enabled=0&failed=1&changed=0",
      )
    ).ok(),
  ).toBe(true);
  await page.goto("/mapa?fuente=nacion-obras&vista=lista");
  panel = await openSourceCoverage(page);
  await expect(panel.locator('[data-scope="unknown"]')).toHaveCount(1);
  await expect(panel.locator('[data-scope="provincia-06"]')).toHaveCount(0);
  await expect(panel.locator("dd")).toHaveCount(0);
  await expect(panel).toContainText(
    "El error no significa que tenga cero publicaciones",
  );
  await expect(
    panel
      .locator('[data-source="nacion-obras"]')
      .getByRole("link", { name: /^Ver listado/ }),
  ).toHaveAttribute("href", "/mapa?fuente=nacion-obras&vista=lista");
  await expect(page.locator(".work-card")).toHaveCount(16);
});

test("la divulgación funciona con teclado, colores forzados y texto al 200 por ciento", async ({
  page,
}, info) => {
  await page.goto("/mapa?vista=lista");
  const panel = page.getByRole("region", {
    name: "Publicaciones por provincia y fuente",
    exact: true,
  });
  const summary = panel.locator(".source-coverage-overview > summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(panel.locator(".source-coverage-overview")).toHaveAttribute(
    "open",
  );
  await openSourceCoverage(page);
  const report = await new AxeBuilder({ page })
    .include(".source-coverage")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(report.violations).toEqual([]);
  await page.emulateMedia({ forcedColors: "active" });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await panel.screenshot({
    path: info.outputPath("cobertura-reflow-colores-forzados.png"),
    style: ".skip-link:not(:focus) { visibility: hidden; }",
  });
});
