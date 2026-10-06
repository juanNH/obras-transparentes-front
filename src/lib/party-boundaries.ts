/** @file Presupuesto y conciliación nominal de límites para representación, independiente de geometrías/identidad de obras. */
import type { PartyBoundaries, PartyCatalog } from "../api/client";
import { readPublic } from "./browser-api";

/** Presupuesto territorial JSON descomprimido: independiente de los 2 MiB de ubicaciones de obras. */
export const MAX_PARTY_BOUNDARY_BYTES = 1.5 * 1024 * 1024;
/** Posiciones máximas de una capa territorial completa; no se recortan anillos para encajar. */
export const MAX_PARTY_BOUNDARY_POSITIONS = 100_000;

let cache: { version: string; sha256: string; boundaries: PartyBoundaries } | null = null;

/** Reutiliza una sola distribución inmutable por versión/hash en memoria; no guarda obras, usuarios ni solicitudes pendientes. */
export async function readPartyBoundaries(catalog: PartyCatalog, signal: AbortSignal): Promise<PartyBoundaries> {
  signal.throwIfAborted();
  const limits = catalog.limites;
  if (limits.estado !== "VALIDATED_FOR_DISPLAY") throw new TypeError("Los límites aún no están habilitados.");
  if (cache?.version === limits.version && cache.sha256 === limits.sha256) return validatePartyBoundaries(cache.boundaries, catalog);
  const data = await readPublic<PartyBoundaries>("territorios/pba/partidos/limites?" + new URLSearchParams({ version: limits.version }), signal, MAX_PARTY_BOUNDARY_BYTES);
  signal.throwIfAborted();
  const boundaries = validatePartyBoundaries(data, catalog);
  if (!signal.aborted) cache = { version: limits.version, sha256: limits.sha256, boundaries };
  return boundaries;
}

/** Rechaza versión/identidades divergentes o una distribución excesiva; el conteo nominal no atribuye obras a polígonos. */
export function validatePartyBoundaries(boundaries: PartyBoundaries, catalog: PartyCatalog): PartyBoundaries {
  if (catalog.limites.estado !== "VALIDATED_FOR_DISPLAY" || boundaries.metadata.version !== catalog.limites.version ||
    boundaries.metadata.uso !== "DISPLAY_ONLY" || boundaries.features.length !== 135) throw new TypeError("La versión territorial no corresponde a la nómina.");
  const identities = new Map(catalog.items.map(party => [party.partidoId, party]));
  const seen = new Set<string>();
  let positions = 0;
  for (const feature of boundaries.features) {
    const party = identities.get(feature.id);
    if (!party || feature.properties.partidoId !== feature.id || seen.has(feature.id) ||
      feature.properties.nombre !== party.nombre || feature.properties.indecDepartamento !== party.codigos.indecDepartamento)
      throw new TypeError("Los límites no coinciden con las identidades de partidos.");
    seen.add(feature.id);
    for (const polygon of feature.geometry.coordinates) {
      for (const ring of polygon) {
        positions += ring.length;
        if (positions > MAX_PARTY_BOUNDARY_POSITIONS) throw new TypeError("La capa territorial excede su presupuesto de posiciones.");
      }
    }
  }
  if (positions !== boundaries.metadata.validacion.posiciones || positions !== catalog.limites.posiciones) throw new TypeError("El conteo de posiciones territoriales es incompatible.");
  return boundaries;
}
