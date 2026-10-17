/** @file Valida la proyección institucional pública v4 y sus diez campos; una fila de oferta no acredita obra, edificio, institución nueva ni vínculo espacial. */
import type { components } from "./generated.js";
import { ApiContractError } from "./contract.js";

/** Fila institucional derivada exclusivamente del contrato público generado. */
export type ReportedInstitution = Extract<components["schemas"]["ReportedRecordSnapshot"], { version: "registro-informado@4" }>;
/** Diez columnas públicas exactas, sin domicilio, contactos, demografía, matrícula o coordenadas. */
export const REPORTED_INSTITUTION_FIELDS = ["establecimiento_id", "establecimiento_nombre", "cueanexo", "modalidad", "nivel", "sector", "tipo_organizacion", "periodo", "municipio_id", "municipio_nombre"] as const satisfies readonly ReportedInstitution["datos"][number]["campo"][];
/** Fuente de catálogo institucional: sólo filtros de registros, nunca fuentes del mapa o WorkSnapshot. */
export const INSTITUTION_RECORD_SOURCE = "pba-establecimientos";
/** Nombre de filtro público separado de edificios escolares y obras consolidadas. */
export const INSTITUTION_RECORD_SOURCE_NAME = "PBA · Padrón institucional de ofertas educativas";

/** Comprueba relaciones que JSON Schema no expresa: columnas/valores permitidos, identidad reportada y ausencia de vínculo/geometría. */
export function assertReportedInstitution(record: ReportedInstitution): void {
  const fields = new Map(record.datos.map(field => [field.campo, field]));
  const institution = record.institucion;
  if (record.datos.length !== REPORTED_INSTITUTION_FIELDS.length || fields.size !== REPORTED_INSTITUTION_FIELDS.length ||
    REPORTED_INSTITUTION_FIELDS.some(field => !fields.has(field)) ||
    record.datos.some(field => field.columna !== field.campo || field.recursoId !== record.fuente.recursoId ||
      (field.estado === "WITHHELD" ? field.valor !== null || !field.motivoLimitacion?.trim() :
        field.estado === "NOT_REPORTED" ? field.valor !== null || field.motivoLimitacion !== null :
          field.valor === null || field.valor.trim() === "" || field.motivoLimitacion !== null)) ||
    record.fuente.codigo !== INSTITUTION_RECORD_SOURCE || record.tipo !== "EDUCATIONAL_ESTABLISHMENT_RECORD" ||
    fields.get("establecimiento_id")?.valor !== institution.codigo ||
    record.nombre !== `Registro de establecimiento educativo ${institution.codigo}` ||
    !institution.nombreGenerado || institution.vinculacionObra !== "NOT_ASSERTED" || institution.geometriaPublicada !== false ||
    (["cueanexo", "modalidad", "nivel", "periodo"] as const).some(key => fields.get(key)?.valor !== institution.oferta[key]))
    throw new ApiContractError("La fila de oferta institucional no conserva el contrato público y sus límites.");
}
