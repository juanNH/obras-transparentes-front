/** @file Lectura limitada del BFF desde el navegador; la validación de contrato se realiza previamente en servidor. */
// All responses have already passed the runtime contract validator in the BFF.
/** Error público del BFF utilizado para recuperar consultas o reiniciar páginas ante cambios de catálogo. */
export class BrowserApiError extends Error {
  /** Conserva código público y explicación legible de la consulta fallida. */
  constructor(readonly code: string, message: string) { super(message); }
}
/**
 * Lee del BFF sin credenciales ni caché y aplica un presupuesto de bytes antes de interpretar JSON.
 * @param path - Ruta relativa pública admitida por el BFF.
 * @param signal - Cancelación de la interacción que inició la lectura.
 * @param maxBytes - Bytes restantes permitidos para esta respuesta.
 * @returns Payload previamente validado por el servidor.
 * @throws BrowserApiError Si no hay body, excede presupuesto o la respuesta HTTP falla.
 */
export async function readPublic<T>(path: string, signal: AbortSignal, maxBytes = 2 * 1024 * 1024): Promise<T> {
  const response = await fetch("/api/public/" + path, { signal, credentials: "omit", cache: "no-store" });
  const reader = response.body?.getReader();
  if (!reader) throw new BrowserApiError("UNAVAILABLE", "La consulta no devolvió datos.");
  const decoder = new TextDecoder(); let json = ""; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new BrowserApiError("RESPONSE_BUDGET", "Mapa parcial: esta zona contiene demasiados datos. Acercá el mapa o explorá la lista paginada.");
      }
      json += decoder.decode(value, { stream: true });
    }
  } finally { reader.releaseLock(); }
  const body = JSON.parse(json + decoder.decode());
  if (!response.ok) throw new BrowserApiError(body.error?.code ?? "UNAVAILABLE", body.error?.message ?? "No se pudo consultar el catálogo.");
  return body as T;
}
