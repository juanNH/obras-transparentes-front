/** @file Configuración exclusiva del servidor para origen público, contacto y proveedor de cartografía. */
import "server-only";

/** Obtiene el origen HTTP(S) para canonical/sitemap y rechaza credenciales antes de usarlo. */
export function siteUrl(): URL {
  const url = new URL(process.env.SITE_URL ?? "http://localhost:3002");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("SITE_URL debe ser un origen HTTP(S) público.");
  return new URL(url.origin);
}

/** Devuelve el contacto configurado sólo si permite construir un mailto sin parámetros inyectados. */
export function reportEmail(): string | null {
  const value = process.env.REPORT_EMAIL;
  return value && /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(value) ? value : null;
}

/** Obtiene un estilo HTTPS sin credenciales; valida la configuración antes de enviarla al navegador. */
export function mapStyleUrl(): string {
  const url = new URL(process.env.MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/liberty");
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("MAP_STYLE_URL debe usar HTTPS sin credenciales.");
  return url.href;
}
