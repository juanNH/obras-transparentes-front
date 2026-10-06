/** @file Búsqueda local de la nómina territorial y presupuesto independiente de lectura, sin geometrías ni inferencias de cobertura. */
import type { PartyCatalog } from "../api/client";

/** Bytes JSON máximos de la nómina; independientes del presupuesto cartográfico de obras. */
export const MAX_PARTY_CATALOG_BYTES = 128 * 1024;

/** Normaliza nombres para buscar sin distinguir mayúsculas, tildes o espacios exteriores. */
function searchName(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es-AR").trim();
}

/** Busca partidos por nombre o código conservando sus identidades; no realiza solicitudes ni interpreta geometrías. */
export function matchingParties(catalog: PartyCatalog, search: string): PartyCatalog["items"] {
  const term = searchName(search);
  return catalog.items.filter(party => !term || searchName(party.nombre).includes(term) ||
    party.codigos.indecDepartamento.includes(term) || party.codigos.georefMunicipio.includes(term));
}
