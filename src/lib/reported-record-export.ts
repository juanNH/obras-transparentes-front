/** @file Exportación de la proyección pública de un registro, con atribución, valores literales y CSV sin fórmulas ejecutables. */
import type { ReportedRecordDetail } from "../api/reported-records";
import { assertReportedRecord } from "../api/reported-records";
import { parsePublicResponse } from "../api/contract";

/** Referencia reproducible de una publicación; no atribuye a la fuente un título generado ni una fecha del dato. */
export function reportedRecordCitation(detail: ReportedRecordDetail): string {
  const record = detail.registro;
  if (!record || detail.estado !== "PUBLISHED") throw new TypeError("La publicación no está disponible.");
  const document = record.version === "registro-informado@2" && "documento" in record ? record.documento : undefined;
  const locator = document ? "formato" in document
    ? `HTML, bytes ${document.byteStart}–${document.byteEnd}, con final excluido`
    : document.paginaFin && document.paginaFin > document.pagina ? `páginas ${document.pagina}–${document.paginaFin}` : `página ${document.pagina}` : "";
  const original = document ? ` ${"formato" in document ? "HTML" : "PDF"} original: ${document.urlOriginal}; SHA-256 ${document.sha256Original}; ${locator}; sección ${document.seccion}.` : "";
  const support = record.version === "registro-informado@3" ? ` Unidad de apoyo: ${record.apoyo.unidadFuente}; localizador ${JSON.stringify(record.apoyo.localizador)}.${record.apoyo.documento ? ` Documento original: ${record.apoyo.documento.urlOriginal ?? "enlace no publicado"}; SHA-256 ${record.apoyo.documento.sha256Original}.` : ""}` : "";
  const institution = record.version === "registro-informado@4" ? ` Fila de oferta institucional educativa; identificador informado ${record.institucion.namespace}:${record.institucion.codigo}; registro CSV ${record.institucion.localizador.registro}; oferta ${JSON.stringify(record.institucion.oferta)}. Etiqueta generada. No acredita obra, edificio intervenido, institución nueva ni vínculo con una obra; sin geometría publicada.` : "";
  const resource = document ? "Transcripción JSON derivada" : "Recurso";
  return `${record.fuente.nombre}. Registro informado ${detail.registroId}, versión ${detail.version}. ${resource} ${record.fuente.recursoId}; SHA-256 ${record.fuente.sha256}.${original}${support}${institution} Captura: ${record.fuente.capturadaEn ?? "no informada"}. Publicación: ${detail.publicadoEn}. /registros/${detail.registroId}`;
}

/** Proyecta sólo el contrato público vigente; no incluye respuestas administrativas, originales ni campos privados agregados. */
export function reportedRecordExport(detail: ReportedRecordDetail) {
  assertReportedRecord(parsePublicResponse<ReportedRecordDetail>("ReportedRecordDetail", detail));
  const record = detail.registro;
  if (!record || detail.estado !== "PUBLISHED") throw new TypeError("La publicación no está disponible.");
  return {
    formato: "registro-informado-publico@1",
    referencia: reportedRecordCitation(detail),
    registroId: detail.registroId,
    version: detail.version,
    publicadoEn: detail.publicadoEn,
    registro: record,
    alcance: record.version === "registro-informado@4" ? "Fila de oferta institucional educativa con diez campos permitidos. No contiene contactos, domicilio, coordenadas, matrícula, demografía ni el original privado. No acredita una obra, edificio intervenido, institución nueva o vínculo con una obra." : "Proyección pública del registro. No contiene el archivo original ni acredita una obra única.",
  };
}

/** Mantiene cada celda textual e inerte, incluso ante prefijos de fórmula tras espacios o controles; JSON conserva el literal. */
export function reportedRecordCsvCell(value: string | null): string {
  const literal = value ?? "";
  const inert = /^[\s\u0000-\u001f]*[=+\-@]/u.test(literal) || /^[\t\r\n]/u.test(literal) ? "'" + literal : literal;
  return '"' + inert.replace(/"/g, '""') + '"';
}

/** CSV vertical de la misma proyección pública, con estados explícitos para distinguir nulos de cero y metadatos de licencia. */
export function reportedRecordCsv(detail: ReportedRecordDetail): string {
  const exported = reportedRecordExport(detail);
  const record = exported.registro;
  const document = "documento" in record ? record.documento : undefined;
  const rows: (string | null)[][] = [
    ["seccion", "campo", "valor", "estado", "recurso", "columna"],
    ["referencia", "cita", exported.referencia, "PUBLIC", record.fuente.recursoId, null],
    ["referencia", "registroId", detail.registroId, "PUBLIC", record.fuente.recursoId, null],
    ["referencia", "version", String(detail.version), "PUBLIC", record.fuente.recursoId, null],
    ["referencia", "tipo", record.tipo, "PUBLIC", record.fuente.recursoId, null],
    ["referencia", "publicadoEn", detail.publicadoEn, "PUBLIC", record.fuente.recursoId, null],
    ["datos", "nombre", record.nombre, record.version === "registro-informado@3" || record.version === "registro-informado@4" || (record.version === "registro-informado@2" && record.nombreGenerado) ? "GENERATED_LABEL" : "REPORTED", record.fuente.recursoId, null],
    ...record.datos.map(data => ["datos", data.campo, data.valor, data.estado, data.recursoId, data.columna]),
    ["referencia", "territorio", JSON.stringify(record.territorio), "PUBLIC", record.fuente.recursoId, null],
    ["referencia", "fuente", JSON.stringify(record.fuente), "PUBLIC", record.fuente.recursoId, null],
    ["referencia", "advertencias", JSON.stringify(record.advertencias), "PUBLIC", record.fuente.recursoId, null],
    ...(record.version === "registro-informado@2" ? [
      ["referencia", "politicaVersion", record.politicaVersion, "PUBLIC", record.fuente.recursoId, null],
      ["referencia", "avisosGenerales", JSON.stringify(record.avisosGenerales), "PUBLIC", record.fuente.recursoId, null],
      ["referencia", "hallazgos", JSON.stringify(record.hallazgos), "PUBLIC", record.fuente.recursoId, null],
      ...(document ? [
        ["documento", "urlOriginal", document.urlOriginal, "REPORTED", record.fuente.recursoId, "originalUrl"],
        ["documento", "sha256Original", document.sha256Original, "REPORTED", record.fuente.recursoId, "originalSha256"],
        ...("formato" in document ? [
          ["documento", "formato", document.formato, "REPORTED", record.fuente.recursoId, "originalFormat"],
          ["documento", "byteStart", String(document.byteStart), "REPORTED", record.fuente.recursoId, "locatorOriginal"],
          ["documento", "byteEndExclusivo", String(document.byteEnd), "REPORTED", record.fuente.recursoId, "locatorOriginal"],
        ] : [
          ["documento", "pagina", String(document.pagina), "REPORTED", record.fuente.recursoId, "locatorOriginal"],
          ...(document.paginaFin ? [["documento", "paginaFin", String(document.paginaFin), "REPORTED", record.fuente.recursoId, "locatorOriginal"]] : []),
        ]),
        ["documento", "seccion", document.seccion, "REPORTED", record.fuente.recursoId, "locatorOriginal"],
      ] : []),
    ] : []),
    ...(record.version === "registro-informado@3" ? [
      ["referencia", "politicaVersion", record.politicaVersion, "PUBLIC", record.fuente.recursoId, null],
      ["apoyo", "unidadFuente", record.apoyo.unidadFuente, "PUBLIC", record.fuente.recursoId, null],
      ["apoyo", "vinculacion", record.apoyo.vinculacion, "PUBLIC", record.fuente.recursoId, null],
      ["apoyo", "geometriaPublicada", String(record.apoyo.geometriaPublicada), "PUBLIC", record.fuente.recursoId, null],
      ["apoyo", "localizador", JSON.stringify(record.apoyo.localizador), "PUBLIC", record.fuente.recursoId, null],
      ["apoyo", "documento", JSON.stringify(record.apoyo.documento), "PUBLIC", record.fuente.recursoId, null],
      ["apoyo", "extractos", JSON.stringify(record.apoyo.extractos), "PUBLIC", record.fuente.recursoId, null],
    ] : []),
    ...(record.version === "registro-informado@4" ? [
      ["referencia", "politicaVersion", record.politicaVersion, "PUBLIC", record.fuente.recursoId, null],
      ["institucion", "unidad", "Fila de oferta institucional educativa, no obra ni edificio intervenido", "PUBLIC", record.fuente.recursoId, null],
      ["institucion", "namespace", record.institucion.namespace, "REPORTED", record.fuente.recursoId, "establecimiento_id"],
      ["institucion", "codigo", record.institucion.codigo, "REPORTED", record.fuente.recursoId, "establecimiento_id"],
      ["institucion", "oferta", JSON.stringify(record.institucion.oferta), "PUBLIC", record.fuente.recursoId, null],
      ["institucion", "vinculacionObra", record.institucion.vinculacionObra, "PUBLIC", record.fuente.recursoId, null],
      ["institucion", "geometriaPublicada", String(record.institucion.geometriaPublicada), "PUBLIC", record.fuente.recursoId, null],
      ["institucion", "nombreGenerado", String(record.institucion.nombreGenerado), "PUBLIC", record.fuente.recursoId, null],
      ["institucion", "localizador", JSON.stringify(record.institucion.localizador), "PUBLIC", record.fuente.recursoId, null],
      ...record.datos.filter(data => data.estado === "WITHHELD").map(data => ["limitacion", data.campo, data.motivoLimitacion, data.estado, data.recursoId, data.columna]),
    ] : []),
    ["referencia", "licencias", JSON.stringify(record.licencias), "PUBLIC", record.fuente.recursoId, null],
    ["referencia", "tratamientoCSV", "Se antepone un apóstrofo a celdas que podrían interpretarse como fórmula; el JSON conserva el texto literal.", "PUBLIC", null, null],
  ];
  return "\ufeff" + rows.map(row => row.map(reportedRecordCsvCell).join(",")).join("\r\n") + "\r\n";
}
