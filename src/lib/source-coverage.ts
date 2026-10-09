/** @file Une la cobertura pública de todas las fuentes en un corte y agrupa su alcance declarado, sin inferir ubicación de obras. */
import type { SourceCoverage } from "../api/client";
import { SOURCES } from "./explorer-query";

/** Código de fuente admitido por el contrato público del listado. */
export type PublicSourceCode = keyof typeof SOURCES;

/** Estado textual de una lectura de cobertura antes de presentar cifras. */
export type SourceCoverageStatus = "AVAILABLE" | "UNKNOWN" | "ERROR";

/** Alcance declarado por la fuente; no acredita la ubicación, gestión ni financiamiento de sus obras. */
export type SourceTerritorialScope =
  SourceCoverage["fuentes"][number]["alcanceTerritorial"];

/** Conteo global de una fuente comprobado contra la versión del listado inicial. */
export type PublicSourceCoverage = {
  codigo: PublicSourceCode;
  nombre: string;
  estado: SourceCoverageStatus;
  alcanceTerritorial: SourceTerritorialScope | null;
  obrasPublicadas: number | null;
  obrasConGeometria: number | null;
  obrasSinGeometria: number | null;
  localidadesConObrasPublicadas: number | null;
  inventario?: SourceCoverage["fuentes"][number];
};

/** Grupo de procedencias con la misma provincia declarada o alcance nacional/desconocido. */
export type SourceCoverageGroup = {
  id: string;
  nombre: string;
  nivel: "NACIONAL" | "PROVINCIAL" | "UNKNOWN";
  fuentes: PublicSourceCoverage[];
};

/** Conserva el orden del selector público, sin usarlo para deducir provincias. */
const SOURCE_ORDER = Object.keys(SOURCES) as PublicSourceCode[];

/**
 * Construye las filas desde una sola lectura y retira cifras de otro corte.
 * El alcance explícito se conserva ante una diferencia de versión porque describe la fuente,
 * mientras que los conteos y originales publicados requieren coincidencia con la lista.
 * Una falla completa conserva enlaces con alcance por confirmar, sin asignaciones locales inferidas.
 */
export function buildSourceCoverage(
  catalogoVersion: string | null,
  sourceResult: PromiseSettledResult<SourceCoverage>,
): PublicSourceCoverage[] {
  return SOURCE_ORDER.map((codigo) => {
    const source =
      sourceResult.status === "fulfilled"
        ? sourceResult.value.fuentes.find((item) => item.codigo === codigo)
        : undefined;
    const estado: SourceCoverageStatus =
      sourceResult.status === "rejected" || !source
        ? "ERROR"
        : !catalogoVersion ||
            sourceResult.value.catalogoVersion !== catalogoVersion
          ? "UNKNOWN"
          : "AVAILABLE";
    return {
      codigo,
      nombre: SOURCES[codigo],
      estado,
      alcanceTerritorial: source?.alcanceTerritorial ?? null,
      obrasPublicadas: estado === "AVAILABLE" ? source!.obrasPublicadas : null,
      obrasConGeometria:
        estado === "AVAILABLE" ? source!.obrasConUbicacionAprobada : null,
      obrasSinGeometria:
        estado === "AVAILABLE" ? source!.obrasSinUbicacionAprobada : null,
      localidadesConObrasPublicadas:
        estado === "AVAILABLE" ? source!.localidadesConObrasPublicadas : null,
      ...(estado === "AVAILABLE" && source ? { inventario: source } : {}),
    };
  });
}

/** Agrupa por los códigos oficiales del contrato, nunca por el nombre de la fuente ni por sus obras. */
export function groupSourceCoverage(
  coverage: readonly PublicSourceCoverage[],
): SourceCoverageGroup[] {
  const groups = new Map<string, SourceCoverageGroup>();
  for (const source of coverage) {
    const scope = source.alcanceTerritorial;
    const id =
      scope?.nivel === "NACIONAL"
        ? "nacional"
        : scope?.provincia
          ? `provincia-${scope.provincia.codigo}`
          : "unknown";
    const nombre =
      scope?.nivel === "NACIONAL"
        ? "Fuentes nacionales"
        : (scope?.provincia?.nombre ?? "Alcance por confirmar");
    const nivel =
      scope?.nivel === "NACIONAL"
        ? "NACIONAL"
        : scope?.provincia
          ? "PROVINCIAL"
          : "UNKNOWN";
    const group = groups.get(id) ?? { id, nombre, nivel, fuentes: [] };
    group.fuentes.push(source);
    groups.set(id, group);
  }
  return [...groups.values()].sort((left, right) => {
    const rank = { NACIONAL: 0, PROVINCIAL: 1, UNKNOWN: 2 };
    return (
      rank[left.nivel] - rank[right.nivel] ||
      left.nombre.localeCompare(right.nombre, "es-AR")
    );
  });
}

/** Busca nombres de provincia, municipio y fuente; admite tildes y devuelve sólo procedencias coincidentes. */
export function filterSourceCoverageGroups(
  groups: readonly SourceCoverageGroup[],
  query: string,
): SourceCoverageGroup[] {
  const needle = normalizedSearch(query);
  if (!needle) return [...groups];
  return groups.flatMap((group) => {
    const fuentes = normalizedSearch(group.nombre).includes(needle)
      ? group.fuentes
      : group.fuentes.filter((source) =>
          normalizedSearch(
            `${source.nombre} ${source.alcanceTerritorial?.municipio?.nombre ?? ""}`,
          ).includes(needle),
        );
    return fuentes.length ? [{ ...group, fuentes }] : [];
  });
}

/** Normaliza únicamente la búsqueda de presentación, sin cambiar identidades territoriales. */
function normalizedSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("es-AR")
    .trim();
}
