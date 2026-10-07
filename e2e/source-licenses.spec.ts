/** @file Verifica atribución y evidencia de licencia en ficha SSR con API sintética aislada, reflujo móvil y sin descargar referencias o imágenes externas. */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const workPath = "/obras/10000000-0000-4000-8000-000000000027";
const attribution = "Atribución sintética exacta — Municipalidad de Olavarría.";
const distributionNotice = "Aviso sintético: la base derivada de esta revisión se distribuye bajo ODbL-1.0.";

test("entrega licencia y atribución en HTML y ficha sin punto, con enlaces y captura explícitos", async ({ page, request }, testInfo) => {
  const response = await request.get(workPath);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain("Licencias y atribución");
  expect(html).toContain(attribution);
  expect(html).toContain(distributionNotice);
  const externalRequests: string[] = [];
  page.on("request", pending => {
    if (new URL(pending.url()).hostname === "example.invalid" || new URL(pending.url()).hostname === "opendatacommons.org") externalRequests.push(pending.url());
  });
  await page.goto(workPath);
  const section = page.locator(".source-licenses");
  await expect(section.getByRole("heading", { name: "Licencias y atribución", exact: true })).toBeVisible();
  await expect(section).toContainText(attribution);
  await expect(section).toContainText(distributionNotice);
  await expect(section.getByRole("link", { name: "ODbL-1.0", exact: true })).toHaveCount(2);
  await expect(section.getByRole("link", { name: "Consultar evidencia de licencia", exact: true })).toHaveAttribute("href", "https://example.invalid/evidencia-licencia-olavarria");
  await expect(section.locator("time")).toHaveAttribute("datetime", "2026-10-06T12:00:00Z");
  await expect(section.locator("time")).toContainText("UTC");
  await expect(section).toContainText("no indica cuándo se actualizó");
  await expect(section).toContainText("no están incluidos en la licencia de datos registrada");
  await expect(page.locator(".map-availability")).toContainText("Publicada · Sin ubicación en el mapa");
  await expect(page.getByText("Territorio no informado.", { exact: true })).toBeVisible();
  await expect(page.locator(".institutional-roles")).toContainText("No hay roles institucionales verificados publicados para esta revisión.");
  await expect(section.locator("img,iframe")).toHaveCount(0);
  expect(externalRequests).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(report.violations).toEqual([]);
  await section.screenshot({ path: testInfo.outputPath("source-licenses.png") });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await section.screenshot({ path: testInfo.outputPath("source-licenses-reflow.png") });
});

test("conserva el faltante de licencia de una publicación anterior sin deducir derechos", async ({ page }) => {
  await page.goto("/obras/10000000-0000-4000-8000-000000000004");
  const section = page.locator(".source-licenses");
  await expect(section).toContainText("No hay evidencia de licencia registrada en la publicación de esta revisión.");
  await expect(section.locator("a")).toHaveCount(0);
  await expect(section).not.toContainText("CC-BY");
  await expect(section).not.toContainText("ODbL");
});

test("al recargar una revisión mantiene su atribución congelada y no consulta una licencia mutable de fuente", async ({ page, request }) => {
  const mutableRequests: string[] = [];
  // Si la UI intentara leer la fuente, esta respuesta deliberadamente distinta no debe sustituir la publicación.
  await page.route("**/api/**/fuentes/**", route => {
    mutableRequests.push(route.request().url());
    return route.fulfill({ json: { version: 99, atribucion: "Atribución de fuente modificada después de publicar." } });
  });
  const before = await (await request.get("http://127.0.0.1:4100/__requests")).json();
  expect(before.fixture).toBe("synthetic-e2e-only");
  const startSequence = (before.requests as { sequence: number }[]).at(-1)?.sequence ?? 0;
  await page.goto(`${workPath}?revisionId=20000000-0000-4000-8000-000000000027`);
  const section = page.locator(".source-licenses");
  await expect(section).toContainText(attribution);
  await page.reload();
  await expect(section).toContainText(attribution);
  await expect(section).toContainText(distributionNotice);
  await expect(section).not.toContainText("Atribución de fuente modificada después de publicar.");
  expect(mutableRequests).toEqual([]);
  const after = await (await request.get("http://127.0.0.1:4100/__requests")).json();
  const upstream = (after.requests as { sequence: number; path: string }[]).filter(entry => entry.sequence > startSequence);
  expect(upstream.some(entry => entry.path === "/api/v1/obras/10000000-0000-4000-8000-000000000027")).toBe(true);
  expect(upstream.some(entry => entry.path.includes("/fuentes"))).toBe(false);
});
