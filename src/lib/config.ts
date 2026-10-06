/** @file Configuración exclusiva del servidor para origen público, contacto y proveedor de cartografía. */
import "server-only";

/**
 * Obtiene un origen público HTTPS configurado, sin crear un dominio por defecto.
 * Los orígenes locales, direcciones IP y nombres reservados no habilitan SEO público.
 * @returns Origen configurado, o null mientras no exista una URL pública elegible.
 * @throws Si SITE_URL no es una URL HTTP(S) de origen, o contiene credenciales.
 */
export function siteUrl(): URL | null {
  const value = process.env.SITE_URL?.trim();
  if (!value) return null;
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash)
    throw new Error("SITE_URL debe ser sólo un origen HTTP(S), sin credenciales, ruta ni parámetros.");
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:" || !hostname.includes(".") || /^[\d.]+$/.test(hostname) || hostname.includes(":") || /(?:^|\.)(?:localhost|local|internal|invalid|test|example)$/.test(hostname) || /(?:^|\.)example\.(?:com|net|org)$/.test(hostname))
    return null;
  return new URL(url.origin);
}

/**
 * Habilita URLs SEO sólo para una publicación identificada y aprobada como producción.
 * Un build local/staging sigue cerrado aunque conserve una URL o el switch de indexación.
 * @returns Origen público únicamente con SITE_ENVIRONMENT=production y SITE_INDEXABLE=true.
 */
export function indexableSiteUrl(): URL | null {
  if (process.env.NODE_ENV === "development" || process.env.SITE_ENVIRONMENT !== "production" || process.env.SITE_INDEXABLE !== "true") return null;
  return siteUrl();
}

/** Habilita contacto en fichas sólo con un correo configurado y válido, sin inventar uno por defecto. */
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
