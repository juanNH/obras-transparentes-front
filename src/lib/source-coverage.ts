/** @file Une el inventario provincial/nacional, conteos y cobertura municipal sólo cuando comparten versión con el listado inicial. */
import type { MunicipalCoverage, SourceCoverage, WorkCounts } from "../api/client";
import { SOURCES } from "./explorer-query";

/** Código de fuente admitido por el contrato público del listado. */
export type PublicSourceCode = keyof typeof SOURCES;

/** Estado textual de una lectura de cobertura antes de presentar cifras. */
export type SourceCoverageStatus = "AVAILABLE" | "UNKNOWN" | "ERROR";

/** Conteo global de una fuente comprobado contra la versión del listado inicial. */
export type PublicSourceCoverage = {
  codigo: PublicSourceCode;
  nombre: string;
  estado: SourceCoverageStatus;
  obrasPublicadas: number | null;
  obrasConGeometria: number | null;
  obrasSinGeometria: number | null;
  inventario?: SourceCoverage["fuentes"][number];
};

/** Fuentes no municipales cuyo desglose se consulta con GET /obras/conteos?fuente=. */
export const SOURCE_COUNT_CODES = ["caba-actualizado", "vl-obras"] as const satisfies readonly PublicSourceCode[];

const SOURCE_ORDER: readonly PublicSourceCode[] = ["pba-edificios", "nacion-obras", "caba-actualizado", "vl-obras", "bahia-obras", "olavarria-obras", "pergamino-obras"];
const MUNICIPAL_CODES = ["bahia-obras", "olavarria-obras", "pergamino-obras"] as const satisfies readonly PublicSourceCode[];

/** Identifica el grupo con cobertura agregada propia del contrato municipal. */
function isMunicipalSource(codigo: PublicSourceCode): codigo is typeof MUNICIPAL_CODES[number] {
  return MUNICIPAL_CODES.some(code => code === codigo);
}

/**
 * Construye las siete tarjetas y oculta cada cifra que no coincida con el listado.
 * @param catalogoVersion - Versión exacta del listado inicial, o null cuando falló.
 * @param municipalResult - Lectura agrupada de las tres fuentes municipales.
 * @param sourceResult - Inventario agrupado provincial/nacional, que mantiene sus unidades documentales.
 * @param countResults - Lecturas de las otras fuentes en el orden de SOURCE_COUNT_CODES.
 * @returns Una tarjeta por fuente pública con estado disponible, desconocido o error.
 */
export function buildSourceCoverage(
  catalogoVersion: string | null,
  municipalResult: PromiseSettledResult<MunicipalCoverage>,
  sourceResult: PromiseSettledResult<SourceCoverage>,
  countResults: readonly PromiseSettledResult<WorkCounts>[],
): PublicSourceCoverage[] {
  const municipalByCode = municipalResult.status === "fulfilled"
    ? new Map(municipalResult.value.fuentes.map(source => [source.codigo, source]))
    : null;
  const countsByCode = new Map(SOURCE_COUNT_CODES.map((code, index) => [code, countResults[index]]));

  return SOURCE_ORDER.map(codigo => {
    if (codigo === "pba-edificios" || codigo === "nacion-obras") {
      if (sourceResult.status === "rejected") return emptyCoverage(codigo, "ERROR");
      if (!catalogoVersion || sourceResult.value.catalogoVersion !== catalogoVersion) return emptyCoverage(codigo, "UNKNOWN");
      const source = sourceResult.value.fuentes.find(source => source.codigo === codigo);
      return source
        ? { codigo, nombre: SOURCES[codigo], estado: "AVAILABLE", obrasPublicadas: source.obrasPublicadas, obrasConGeometria: source.obrasConUbicacionAprobada, obrasSinGeometria: source.obrasSinUbicacionAprobada, inventario: source }
        : emptyCoverage(codigo, "ERROR");
    }
    if (isMunicipalSource(codigo)) {
      if (municipalResult.status === "rejected") return emptyCoverage(codigo, "ERROR");
      if (!catalogoVersion || municipalResult.value.catalogoVersion !== catalogoVersion) return emptyCoverage(codigo, "UNKNOWN");
      const source = municipalByCode?.get(codigo);
      return source
        ? { codigo, nombre: source.nombre, estado: "AVAILABLE", obrasPublicadas: source.obrasPublicadas, obrasConGeometria: source.obrasConGeometria, obrasSinGeometria: source.obrasSinGeometria }
        : emptyCoverage(codigo, "ERROR");
    }

    const result = countsByCode.get(codigo);
    if (!result || result.status === "rejected") return emptyCoverage(codigo, "ERROR");
    if (!catalogoVersion || result.value.catalogoVersion !== catalogoVersion) return emptyCoverage(codigo, "UNKNOWN");
    return {
      codigo,
      nombre: SOURCES[codigo],
      estado: "AVAILABLE",
      obrasPublicadas: result.value.totalPublicadas,
      obrasConGeometria: result.value.totalConGeometria,
      obrasSinGeometria: result.value.totalSinGeometria,
    };
  });
}

/** Crea una fila sin cantidades para evitar presentar un desconocido o error como cero. */
function emptyCoverage(codigo: PublicSourceCode, estado: Exclude<SourceCoverageStatus, "AVAILABLE">): PublicSourceCoverage {
  return { codigo, nombre: SOURCES[codigo], estado, obrasPublicadas: null, obrasConGeometria: null, obrasSinGeometria: null };
}
