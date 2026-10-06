/** @file Verifica lectura legal sin contacto supuesto, navegación por teclado/sin JavaScript, SEO staging y reflow con red aislada. */
import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { isolateMapNetwork } from "./map-fixture";

const inheritedDescription = "Explorá información de obras públicas, consultá sus fuentes y conocé qué datos están disponibles. Un proyecto en etapa piloto.";
const termsDescription = "Alcance informativo de Obras Transparentes, fuentes, límites de los datos y condiciones de uso del sitio.";
const emailAddress = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

/** Comprueba que el enlace se alcanza con Tab, sin reemplazar esa navegación por foco programático. */
async function focusWithKeyboard(page: Page, link: Locator) {
  for (let attempt = 0; attempt < 60; attempt++) {
    await page.keyboard.press("Tab");
    if (await link.evaluate(element => element === document.activeElement)) break;
  }
  await expect(link).toBeFocused();
}

test.beforeEach(async ({ page }) => {
  await isolateMapNetwork(page);
});

test("páginas legales conservan descripciones y permanecen fuera de indexación en staging", async ({ page }) => {
  for (const [path, description, title] of [
    ["/privacidad", inheritedDescription, "Ubicación y privacidad | Obras Transparentes"],
    ["/terminos", termsDescription, "Términos de uso | Obras Transparentes"],
  ] as const) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", description);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.locator('meta[property^="og:"]')).toHaveCount(0);
  }
});

test("legales y ficha no publican un correo ni enlaces mailto", async ({ page, request }) => {
  for (const path of ["/privacidad", "/terminos", "/obras/10000000-0000-4000-8000-000000000001"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).not.toMatch(/mailto:/i);
    expect(html).not.toMatch(emailAddress);
  }
  for (const [path, title] of [["/privacidad", "Responsable y consultas"], ["/terminos", "Información del operador"]] as const) {
    await page.goto(path);
    const heading = page.locator("main").getByRole("heading", { name: title, exact: true });
    await expect(heading).toBeVisible();
    const statement = heading.locator("xpath=following-sibling::p[contains(@class, 'notice')][1]");
    await expect(statement).toBeVisible();
    await expect(statement).toContainText(/\b(?:no|sin)\b/i);
    await expect(statement).toContainText(/operador|responsable|identidad|identificaci[oó]n/i);
    await expect(statement).toContainText(/canal.*(?:consulta|solicitud)/i);
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  }
});

test("contenido legal y enlaces conservan accesibilidad, teclado y reflow a 390 y 320 px", async ({ page }) => {
  const externalRequests: string[] = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) externalRequests.push(url.href);
  });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ["/privacidad", "/terminos"]) {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(report.violations).toEqual([]);
      await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const complementaryPath = path === "/privacidad" ? "/terminos" : "/privacidad";
      const complementaryLink = page.locator(`main a[href="${complementaryPath}"]`).first();
      const explore = page.locator('main a.button[href^="/mapa"]').first();
      await expect(explore).toHaveAttribute("href", path === "/privacidad" ? "/mapa?vista=lista" : "/mapa");
      for (const link of [complementaryLink, explore]) {
        await focusWithKeyboard(page, link);
        await expect(link).toBeVisible();
        const bounds = await link.boundingBox();
        expect(bounds?.x).toBeGreaterThanOrEqual(0);
        expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(width);
      }
      await focusWithKeyboard(page, complementaryLink);
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(new RegExp(`${complementaryPath}$`));
      await expect(page.locator("main h1")).toBeVisible();
    }
  }
  expect(externalRequests).toEqual([]);
});

test.describe("legales sin JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("el pie permite leer legales y continuar por el catálogo completo sin un contacto supuesto", async ({ page, request }) => {
    const externalRequests: string[] = [];
    page.on("request", request => {
      const url = new URL(request.url());
      if (!["127.0.0.1", "localhost"].includes(url.hostname)) externalRequests.push(url.href);
    });
    for (const path of ["/privacidad", "/terminos"]) {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      const html = await response.text();
      expect(html).toMatch(/<h1(?:\s[^>]*)?>/);
      expect(html).not.toMatch(/mailto:/i);
      expect(html).not.toMatch(emailAddress);
    }
    await page.goto("/");
    await page.getByRole("navigation", { name: "Navegación del pie de página" }).getByRole("link", { name: "Privacidad", exact: true }).click();
    await expect(page).toHaveURL(/\/privacidad$/);
    await expect(page.locator("main").getByRole("heading", { name: "Responsable y consultas", exact: true })).toBeVisible();
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
    await page.getByRole("navigation", { name: "Navegación del pie de página" }).getByRole("link", { name: "Términos de uso", exact: true }).click();
    await expect(page).toHaveURL(/\/terminos$/);
    await expect(page.locator("main h1")).toHaveText("Términos de uso");
    await expect(page.locator("main").getByRole("heading", { name: "Información del operador", exact: true })).toBeVisible();
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
    await page.locator("main").getByRole("link", { name: "Explorar obras", exact: true }).click();
    await expect(page).toHaveURL(/\/mapa$/);
    await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(20);
    await page.getByRole("link", { name: "Página siguiente sin JavaScript", exact: true }).click();
    await expect(page.getByRole("link", { name: /^Ver ficha/ })).toHaveCount(4);
    expect(externalRequests).toEqual([]);
  });
});
