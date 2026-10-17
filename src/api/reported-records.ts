/** @file Consulta y presentación básica de registros de fuente; sus identidades y conteos permanecen separados de obras. */
import type { components, paths } from "./generated.js";
import { ApiContractError } from "./contract.js";
import { assertReportedInstitution } from "./reported-institutions.js";

/** Instantánea pública permitida por el contrato, sin originales privados ni geometrías candidatas. */
export type ReportedRecordSnapshot = components["schemas"]["ReportedRecordSnapshot"];
/** Publicación o retiro de un registro; un retiro no conserva la instantánea pública. */
export type ReportedRecordDetail = components["schemas"]["ReportedRecordDetail"];
/** Página versionada de registros; su longitud no es un total de obras. */
export type ReportedRecordList = components["schemas"]["ReportedRecordList"];
/** Totales del catálogo de registros, independientes del catálogo de obras. */
export type ReportedRecordCounts = components["schemas"]["ReportedRecordCounts"];
/** Parámetros obtenidos del contrato generado del backend. */
export type ReportedRecordQuery = NonNullable<paths["/api/v1/registros-informados"]["get"]["parameters"]["query"]>;
/** Filtros compartidos por lista y conteos sin cursor ni límite de página. */
export type ReportedRecordFilters = Omit<ReportedRecordQuery, "limit" | "cursor">;
/** Tipos de unidad documental que admite este corte del contrato. */
export const REPORTED_RECORD_TYPES: Record<ReportedRecordSnapshot["tipo"], string> = {
  WORK_RECORD: "Registro de intervención informado",
  COMPLETED_SCHOOL_BUILDING_RECORD: "Registro de edificio escolar",
  DOCUMENT_REPORT_SECTION: "Sección de informe documental",
  PROCUREMENT_ACT_RECORD: "Acto de contratación informado",
  SOURCE_CAPTURE_UNIT: "Trabajo o trámite informado por la fuente",
  DOCUMENT_FRAGMENT_RECORD: "Fragmento documental",
  DOCUMENT_SUPPORT_RECORD: "Apoyo documental",
  SPATIAL_SUPPORT_RECORD: "Registro espacial informado",
  EDUCATIONAL_ESTABLISHMENT_RECORD: "Fila de oferta institucional educativa",
};

/** Serializa sólo parámetros públicos admitidos; los conteos no aceptan paginación. */
export function reportedRecordParams(query: ReportedRecordQuery, pagination = true): URLSearchParams {
  const params = new URLSearchParams();
  const filters = ["fuente", "tipo", "provinciaCodigo", "partidoCodigo", "localidadCodigo", "territorio"];
  const allowed = pagination ? [...filters, "limit", "cursor"] : filters;
  if (Object.keys(query).some(key => !allowed.includes(key))) throw new TypeError("Filtro de registros desconocido.");
  if (query.fuente !== undefined) {
    if (!/^[a-z][a-z0-9-]{0,79}$/.test(query.fuente)) throw new TypeError("Código de fuente inválido.");
    params.set("fuente", query.fuente);
  }
  if (query.tipo !== undefined) {
    if (!Object.hasOwn(REPORTED_RECORD_TYPES, query.tipo)) throw new TypeError("Tipo de registro inválido.");
    params.set("tipo", query.tipo);
  }
  if (query.territorio !== undefined) {
    if (query.territorio !== "UNKNOWN" || query.provinciaCodigo || query.partidoCodigo || query.localidadCodigo) throw new TypeError("Elegí territorio desconocido o un nombre territorial, sin combinarlos.");
    params.set("territorio", query.territorio);
  }
  for (const [key, pattern] of [
    ["provinciaCodigo", /^\d{2}$/],
    ["partidoCodigo", /^06\d{3}$/],
    ["localidadCodigo", /^\d{8,10}$/],
  ] as const) {
    const value = query[key];
    if (value !== undefined) {
      if (!pattern.test(value)) throw new TypeError("Código territorial de registro inválido.");
      params.set(key, value);
    }
  }
  if (pagination) {
    const limit = query.limit ?? 25;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new TypeError("Límite de registros inválido.");
    params.set("limit", String(limit));
    if (query.cursor !== undefined) {
      if (!query.cursor || query.cursor.length > 2000) throw new TypeError("Cursor de registros inválido.");
      params.set("cursor", query.cursor);
    }
  }
  return params;
}

/** Valida URLs compartidas y formularios GET; no acepta filtros privados, repetidos ni geometrías. */
export function parseReportedRecordQuery(params: URLSearchParams, pagination = true): ReportedRecordQuery {
  const filters = ["fuente", "tipo", "provinciaCodigo", "partidoCodigo", "localidadCodigo", "territorio"];
  const allowed = pagination ? [...filters, "limit", "cursor"] : filters;
  for (const key of params.keys()) {
    if (!allowed.includes(key) || params.getAll(key).length !== 1) throw new TypeError("Filtro de registros inválido o repetido.");
  }
  const query: ReportedRecordQuery = {};
  const fuente = params.get("fuente");
  const tipo = params.get("tipo");
  const limit = params.get("limit");
  const cursor = params.get("cursor");
  if (fuente) query.fuente = fuente;
  if (tipo) query.tipo = tipo as ReportedRecordSnapshot["tipo"];
  const territory = params.get("territorio");
  if (territory) query.territorio = territory as NonNullable<ReportedRecordQuery["territorio"]>;
  for (const key of ["provinciaCodigo", "partidoCodigo", "localidadCodigo"] as const) {
    const value = params.get(key);
    if (value) query[key] = value;
  }
  if (limit !== null) {
    if (!/^\d+$/.test(limit)) throw new TypeError("Límite de registros inválido.");
    query.limit = Number(limit);
  }
  if (cursor !== null) query.cursor = cursor;
  reportedRecordParams(query, pagination);
  return query;
}

/** Genera navegación nativa con la misma fuente, tipo y tamaño; reiniciar retira sólo el cursor. */
export function reportedRecordsHref(query: ReportedRecordQuery, cursor?: string): string {
  const { cursor: _cursor, ...filters } = query;
  const params = reportedRecordParams({ ...filters, ...(cursor ? { cursor } : {}) });
  return "/registros?" + params.toString();
}

/** Exige coherencia entre retiro e instantánea para impedir que un retiro exponga datos anteriores. */
export function assertReportedRecord(detail: ReportedRecordDetail): ReportedRecordDetail {
  if ((detail.estado === "PUBLISHED") !== (detail.registro !== null)) throw new ApiContractError("El estado del registro no coincide con su publicación.");
  if (detail.registro?.datos.some(data => data.estado !== "REPORTED" && data.valor !== null)) throw new ApiContractError("Un campo desconocido o restringido no puede exponer un valor.");
  const record = detail.registro;
  if (record) {
    if (record.version === "registro-informado@4") assertReportedInstitution(record);
    const document = "documento" in record ? record.documento : undefined;
    if (record.tipo === "DOCUMENT_REPORT_SECTION" && !document || document && record.tipo !== "DOCUMENT_REPORT_SECTION" && record.tipo !== "PROCUREMENT_ACT_RECORD") throw new ApiContractError("La unidad documental no coincide con su procedencia.");
    if (document && "pagina" in document && document.paginaFin !== undefined && document.paginaFin < document.pagina) throw new ApiContractError("El rango de páginas del documento es inválido.");
    if (document && "formato" in document && document.formato === "HTML" && document.byteEnd <= document.byteStart) throw new ApiContractError("El intervalo del fragmento HTML es inválido.");
  }
  return detail;
}
