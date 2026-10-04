// All responses have already passed the runtime contract validator in the BFF.
export class BrowserApiError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
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
