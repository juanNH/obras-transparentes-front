/** @file Recorrido de registros con API sintética aislada: visibilidad, dudas, conteos, retiro, paginación y ausencia de mapas o credenciales. */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const recordPath = "/registros/88000000-0000-4000-8000-000000000001";
const artifactDirectory = process.env.REPORTED_RECORD_E2E_ARTIFACT_DIR ?? "artifacts/reported-records-20261014";

test("la sección documental distingue PDF, JSON derivado y territorio desconocido y conserva motivos en descargas", async ({ page, request }) => {
  const path = "/registros/88000000-0000-4000-8000-000000000006";
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "Documento original y sección", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Consultar PDF original de la fuente" })).toHaveAttribute("href", "https://example.invalid/informe-sintetico.pdf");
  await expect(page.getByText("Huella SHA-256 de la transcripción JSON derivada", { exact: true })).toBeVisible();
  await expect(page.getByText("Territorio informado por la fuente: No informado", { exact: false })).toBeVisible();
  await expect(page.getByText("La sección puede agrupar calles o componentes; no acredita una obra única.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Referencia para citar")).toHaveValue(/PDF original:.*página 2; sección SECCIÓN SINTÉTICA/);
  for (const format of ["json", "csv"]) {
    const response = await request.get(path + "/descargar?formato=" + format);
    expect(response.status()).toBe(200);
    const content = await response.text();
    expect(content).toContain("DOCUMENT_REPORT_SECTION");
    expect(content).toContain("FIN DE SECCIÓN SINTÉTICA");
    expect(content).toContain("informe-sintetico.pdf");
    expect(content).not.toContain("originalBase64");
    expect(content).not.toContain("rawCells");
  }
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("el explorador ofrece registros y la lista conserva dudas y conteos independientes", async ({ page, request }, testInfo) => {
  await page.goto("/mapa?vista=lista");
  await page.getByRole("link", { name: "Consultar registros informados", exact: true }).click();
  await expect(page).toHaveURL(/\/registros/);
  await expect(page.getByRole("heading", { name: "Registros informados", exact: true })).toBeVisible();
  const totals = page.getByRole("region", { name: "Conteos de obras y registros" });
  await expect(totals).toContainText("Los registros no se suman a las obras");
  await expect(totals.getByText("Registros informados con estos filtros", { exact: true }).locator("..").locator("dd")).toHaveText("3");
  const workCounts = await (await request.get("/api/public/obras/conteos")).json();
  await expect(totals.getByText("Obras publicadas en todo el catálogo de obras", { exact: true }).locator("..").locator("dd")).toHaveText(String(workCounts.totalPublicadas));
  const card = page.locator(".record-card").first();
  await expect(card.getByText("Posible duplicado.", { exact: true })).toBeVisible();
  await expect(card.getByText("Datos contradictorios.", { exact: true })).toBeVisible();
  await expect(card).toContainText("Otro registro podría describir la misma intervención");
  await expect(page.getByRole("button", { name: "Ver en mapa" })).toHaveCount(0);
  await mkdir(artifactDirectory, { recursive: true });
  await page.screenshot({ path: artifactDirectory + "/" + testInfo.project.name + "-list.png", fullPage: true });
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("la ficha conserva datos desconocidos y cero, no carga mapas y permite leer evidencia y licencia", async ({ page }, testInfo) => {
  const external: string[] = [];
  page.on("request", request => { if (["example.invalid", "tiles.openfreemap.org"].includes(new URL(request.url()).hostname)) external.push(request.url()); });
  await page.goto(recordPath);
  await expect(page.getByRole("heading", { name: "EJEMPLO SINTÉTICO — Registro de reparación" })).toBeVisible();
  await expect(page.getByText("Identidad pendiente.", { exact: true })).toBeVisible();
  await expect(page.getByText("Posible duplicado.", { exact: true })).toBeVisible();
  await expect(page.locator("dd").filter({ hasText: /^No informado$/ })).toHaveCount(1);
  await expect(page.locator("dd").filter({ hasText: /^0$/ })).toHaveCount(1);
  await expect(page.getByText("999999999999999999.1234", { exact: true })).toBeVisible();
  await expect(page.getByText("Atribución exclusivamente sintética.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver en mapa" })).toHaveCount(0);
  await expect(page.locator("canvas,iframe")).toHaveCount(0);
  expect(external).toEqual([]);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("reported-record.png"), fullPage: true });
  await mkdir(artifactDirectory, { recursive: true });
  await page.screenshot({ path: artifactDirectory + "/" + testInfo.project.name + "-detail.png", fullPage: true });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("la paginación funciona sin JavaScript, conserva filtros y no duplica ni salta registros", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/registros?fuente=bahia-obras&tipo=WORK_RECORD&limit=1");
  await expect(page.locator(".record-card")).toHaveCount(1);
  await expect(page.locator(".record-card h2 a")).toHaveAttribute("href", "/registros/88000000-0000-4000-8000-000000000001");
  await page.getByRole("link", { name: "Página siguiente de registros" }).click();
  await expect(page.locator(".record-card h2 a")).toHaveAttribute("href", "/registros/88000000-0000-4000-8000-000000000002");
  await expect(page.getByRole("link", { name: "Página siguiente de registros" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Volver a la primera página" })).toHaveAttribute("href", "/registros?fuente=bahia-obras&tipo=WORK_RECORD&limit=1");
  await context.close();
});

test("el retiro no permite recuperar el contenido anterior y un cursor obsoleto ofrece reinicio", async ({ page, request }) => {
  await page.goto("/registros/88000000-0000-4000-8000-000000000004");
  await expect(page.getByRole("heading", { name: "Registro retirado" })).toBeVisible();
  await expect(page.locator(".reported-record-detail")).toHaveCount(0);
  await expect(page.getByText("EJEMPLO SINTÉTICO — Registro de reparación", { exact: true })).toHaveCount(0);
  const api = await request.get("/api/public/registros-informados/88000000-0000-4000-8000-000000000004");
  expect((await api.json()).registro).toBeNull();
  await page.goto("/registros?fuente=bahia-obras&cursor=changed");
  await expect(page.getByText("El catálogo cambió o el cursor ya no es válido. Reiniciá la consulta.", { exact: true })).toBeVisible();
  await expect(page.locator(".record-card")).toHaveCount(0);
  expect((await request.get("/api/public/registros-informados?actorId=private")).status()).toBe(400);
});

test("filtra por tipo y territorio reportado sin asignar una ubicación", async ({ page }) => {
  await page.goto("/registros");
  await page.getByRole("combobox", { name: "Tipo de registro", exact: true }).selectOption("COMPLETED_SCHOOL_BUILDING_RECORD");
  await page.getByRole("combobox", { name: "Provincia informada", exact: true }).selectOption({ label: "Buenos Aires" });
  await page.getByRole("combobox", { name: "Partido bonaerense informado", exact: true }).selectOption({ label: "Bahía Blanca" });
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page.locator(".record-card")).toHaveCount(1);
  await expect(page.locator(".record-card")).toContainText("Edificio escolar informado");
  await expect(page.locator(".record-card")).toContainText("Buenos Aires · Bahía Blanca");
  await expect(page.locator(".record-card")).toContainText("No acredita una ubicación en el mapa");
  expect(new URL(page.url()).searchParams.get("tipo")).toBe("COMPLETED_SCHOOL_BUILDING_RECORD");
  expect(new URL(page.url()).searchParams.get("provinciaCodigo")).toBe("06");
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("el texto largo, los motivos y la descarga de v2 son accesibles y las fórmulas siguen siendo texto", async ({ page, request }, testInfo) => {
  const path = "/registros/88000000-0000-4000-8000-000000000005";
  await page.goto(path);
  await expect(page.getByRole("heading", { name: /EJEMPLO SINTÉTICO — Título largo/ })).toContainText("FIN DEL TÍTULO COMPLETO");
  await expect(page.getByRole("region", { name: "Hallazgos y tratamientos del registro" })).toContainText("no impide leer el resto del registro");
  await expect(page.getByText("Campo no publicado. Consultá el motivo y el tratamiento indicados en los hallazgos.", { exact: true })).toBeVisible();
  await expect(page.locator("dd").filter({ hasText: /^=HYPERLINK/ })).toHaveCount(1);
  await expect(page.getByLabel("Referencia para citar")).toHaveValue(/SHA-256/);
  await page.getByRole("button", { name: "Copiar referencia", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(/Referencia copiada|Seleccioná y copiá la referencia/);
  const json = await request.get(path + "/descargar?formato=json");
  expect(json.status()).toBe(200);
  const exported = await json.json();
  expect(exported.registro.nombre).toContain("FIN DEL TÍTULO COMPLETO");
  expect(exported.registro.datos.find((field: { campo: string }) => field.campo === "literal").valor).toMatch(/^=HYPERLINK/);
  const csv = await request.get(path + "/descargar?formato=csv");
  expect(await csv.text()).toContain('"\'=HYPERLINK');
  expect(csv.headers()["cache-control"]).toBe("no-store");
  const retired = await request.get("/registros/88000000-0000-4000-8000-000000000004/descargar?formato=json");
  expect(retired.status()).toBe(410);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("homogeneous-record-v2.png"), fullPage: true });
});

test("consulta registros con territorio desconocido sin introducir una ubicación", async ({ page }) => {
  await page.goto("/registros");
  await page.getByRole("combobox", { name: "Disponibilidad del territorio", exact: true }).selectOption("UNKNOWN");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page.locator(".record-card")).toHaveCount(1);
  await expect(page.locator(".record-card")).toContainText("Territorio informado por la fuente: No informado");
  expect(new URL(page.url()).searchParams.get("territorio")).toBe("UNKNOWN");
  await expect(page.locator("canvas")).toHaveCount(0);
});
