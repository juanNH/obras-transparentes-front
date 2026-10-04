import "server-only";
import { createPublicApi, PublicApiError } from "../api/client";

// The existing contract validator stays on the server, outside the mobile bundle.
const MAX_BYTES = 2 * 1024 * 1024;
export function publicApi() {
  return createPublicApi({
    baseUrl: process.env.PUBLIC_API_URL ?? "http://127.0.0.1:3000/api/v1",
    fetch: async (input, init) => {
      const timeout = AbortSignal.timeout(8000);
      const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
      const response = await fetch(input, { ...init, cache: "no-store", signal });
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Respuesta vacía de la API.");
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_BYTES) {
            await reader.cancel();
            throw new PublicApiError(413, { code: "RESPONSE_BUDGET", message: "El área contiene demasiados datos; acercá el mapa o ajustá los filtros.", requestId: null });
          }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return new Response(bytes, { status: response.status, headers: { "Content-Type": "application/json" } });
    },
  });
}
