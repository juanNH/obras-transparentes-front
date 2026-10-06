/** @file Comprueba configuración SEO cerrada por defecto; el dominio oficial se usa como entrada sin red ni despliegue. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { indexableSiteUrl, reportEmail, siteUrl } from "../src/lib/config";
import { pageMetadata } from "../src/lib/seo";
import robots from "../src/app/robots";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SITE_URL", "");
  vi.stubEnv("SITE_ENVIRONMENT", "local");
  vi.stubEnv("SITE_INDEXABLE", "false");
  vi.stubEnv("REPORT_EMAIL", undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("origen e indexación públicos", () => {
  it("no crea URL pública y bloquea rastreo mientras el origen esté pendiente", () => {
    expect(siteUrl()).toBeNull();
    expect(indexableSiteUrl()).toBeNull();
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
    expect(pageMetadata("/", { title: "Inicio" })).toEqual({ title: "Inicio", robots: { index: false, follow: true } });
  });

  it.each([
    "http://localhost:3002", "https://localhost:3002", "https://127.0.0.1", "https://192.168.0.2", "https://[::1]", "https://obras.internal", "https://obras.invalid", "https://obras.local", "https://obras.test", "https://obras.example", "https://obras.example.org", "http://www.argentina.gob.ar",
  ])("rechaza como origen SEO un destino local, reservado o sin HTTPS: %s", value => {
    vi.stubEnv("SITE_URL", value);
    vi.stubEnv("SITE_ENVIRONMENT", "production");
    vi.stubEnv("SITE_INDEXABLE", "true");
    expect(siteUrl()).toBeNull();
    expect(indexableSiteUrl()).toBeNull();
    expect(robots()).not.toHaveProperty("sitemap");
    expect(pageMetadata("/proyecto", { title: "Proyecto" })).not.toHaveProperty("alternates");
  });

  it.each(["https://user:password@www.argentina.gob.ar", "https://www.argentina.gob.ar/proyecto", "https://www.argentina.gob.ar?tracking=x", "https://www.argentina.gob.ar#fragment", "file:///tmp/site", "not-a-url"])("rechaza una configuración que no sea un origen sin credenciales: %s", value => {
    vi.stubEnv("SITE_URL", value);
    expect(() => siteUrl()).toThrow();
  });

  it.each(["local", "staging", ""])("mantiene cerrado %s aunque se configure URL y switch", environment => {
    vi.stubEnv("SITE_URL", "https://www.argentina.gob.ar");
    vi.stubEnv("SITE_ENVIRONMENT", environment);
    vi.stubEnv("SITE_INDEXABLE", "true");
    expect(indexableSiteUrl()).toBeNull();
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });

  it("exige origen, entorno y aprobación; desarrollo permanece cerrado", () => {
    vi.stubEnv("SITE_ENVIRONMENT", "production");
    vi.stubEnv("SITE_INDEXABLE", "true");
    expect(indexableSiteUrl()).toBeNull();
    vi.stubEnv("SITE_URL", "https://www.argentina.gob.ar");
    expect(indexableSiteUrl()?.href).toBe("https://www.argentina.gob.ar/");
    expect(robots()).toEqual({ rules: { userAgent: "*", allow: "/", disallow: "/api/" }, sitemap: "https://www.argentina.gob.ar/sitemap.xml" });
    vi.stubEnv("SITE_INDEXABLE", "false");
    expect(indexableSiteUrl()).toBeNull();
    vi.stubEnv("SITE_INDEXABLE", "true");
    vi.stubEnv("NODE_ENV", "development");
    expect(indexableSiteUrl()).toBeNull();
  });

  it("conserva descripción y canonical sin parámetros sólo en producción habilitada", () => {
    vi.stubEnv("SITE_URL", "https://www.argentina.gob.ar");
    vi.stubEnv("SITE_ENVIRONMENT", "production");
    vi.stubEnv("SITE_INDEXABLE", "true");
    const metadata = pageMetadata("/mapa", { title: "Explorar obras", description: "Descripción existente.", index: false });
    expect(metadata.description).toBe("Descripción existente.");
    expect(metadata.alternates).toEqual({ canonical: "https://www.argentina.gob.ar/mapa" });
    expect(metadata.openGraph).toMatchObject({ title: "Explorar obras", description: "Descripción existente.", url: "https://www.argentina.gob.ar/mapa" });
    expect(metadata.openGraph).not.toHaveProperty("images");
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(pageMetadata("/privacidad", { title: "Privacidad" })).not.toHaveProperty("description");
  });
});

describe("contacto opcional", () => {
  it("no publica un correo cuando el contacto no está configurado", () => {
    expect(reportEmail()).toBeNull();
    vi.stubEnv("REPORT_EMAIL", "");
    expect(reportEmail()).toBeNull();
  });

  it("permite otro correo válido y rechaza parámetros inyectados", () => {
    vi.stubEnv("REPORT_EMAIL", "contacto@example.org");
    expect(reportEmail()).toBe("contacto@example.org");
    vi.stubEnv("REPORT_EMAIL", "contacto@example.org?subject=injected");
    expect(reportEmail()).toBeNull();
  });
});
