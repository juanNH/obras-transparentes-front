/** @file Cliente exclusivo del servidor con timeout, presupuesto de bytes y respuestas de catálogo sin caché. */
import "server-only";
import { createPublicApi, PublicApiError } from "../api/client";
import { MAX_PARTY_CATALOG_BYTES } from "./party-catalog";
import { MAX_PARTY_BOUNDARY_BYTES } from "./party-boundaries";
import { MAX_INSTITUTIONAL_CATALOG_BYTES } from "./institutional-organizations";

// The existing contract validator stays on the server, outside the mobile bundle.
const MAX_BYTES = 2 * 1024 * 1024;
/**
 * Crea el cliente de obras con 8 segundos/2 MiB, catálogos de provincias y partidos con 5 segundos/128 KiB y catálogo institucional con 5 segundos/512 KiB por lectura.
 * @returns Cliente con validación de contrato, cancelación combinada y política no-store.
 * @throws PublicApiError Si una respuesta excede el presupuesto de bytes.
 */
export function publicApi() {
  return createPublicApi({
    baseUrl: process.env.PUBLIC_API_URL ?? "http://127.0.0.1:3000/api/v1",
    fetch: async (input, init) => {
      const partyCatalog = String(input).endsWith("/territorios/pba/partidos");
      const provinceCatalog = String(input).endsWith("/territorios/provincias");
      const partyBoundaries = String(input).includes("/territorios/pba/partidos/limites?");
      const institutionalCatalog = String(input).endsWith("/organizaciones-institucionales");
      const maxBytes = partyCatalog || provinceCatalog ? MAX_PARTY_CATALOG_BYTES : partyBoundaries ? MAX_PARTY_BOUNDARY_BYTES : institutionalCatalog ? MAX_INSTITUTIONAL_CATALOG_BYTES : MAX_BYTES;
      const timeout = AbortSignal.timeout(partyCatalog || provinceCatalog || institutionalCatalog ? 5000 : 8000);
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
          if (size > maxBytes) {
            await reader.cancel();
            throw new PublicApiError(413, { code: "RESPONSE_BUDGET", message: institutionalCatalog ? "No se pudo cargar el catálogo institucional dentro del límite de lectura." : partyCatalog || provinceCatalog || partyBoundaries ? "No se pudo cargar la referencia territorial dentro del límite de lectura." : "El área contiene demasiados datos; acercá el mapa o ajustá los filtros.", requestId: null });
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
