/** @file Registros exclusivamente sintéticos para pruebas aisladas; no consulta ni publica datos reales. */
const recursoId = "77000000-0000-4000-8000-000000000001";
const fuenteId = "77000000-0000-4000-8000-000000000002";
const snapshot = {
  version: "registro-informado@1",
  tipo: "WORK_RECORD",
  nombre: "EJEMPLO SINTÉTICO — Registro de reparación",
  territorio: {
    condicion: "REPORTED", provincia: { codigo: "06", nombre: "Buenos Aires" },
    partido: { codigo: "06056", nombre: "Bahía Blanca" }, localidad: null, columnas: ["PROVINCIA", "PARTIDO"],
  },
  fuente: {
    codigo: "bahia-obras", nombre: "Fuente municipal sintética", urlCatalogo: "https://example.invalid/catalogo",
    capturadaEn: "2026-10-14T10:00:00.123Z", recursoId, sha256: "a".repeat(64),
  },
  datos: [
    { campo: "estado", etiqueta: "Estado informado", valor: null, estado: "NOT_REPORTED", recursoId, columna: "ESTADO" },
    { campo: "avanceFinanciero", etiqueta: "Avance financiero informado", valor: "0", estado: "REPORTED", recursoId, columna: "AVANCE" },
    { campo: "monto", etiqueta: "Monto informado", valor: "999999999999999999.1234", estado: "REPORTED", recursoId, columna: "MONTO" },
  ],
  advertencias: [
    { codigo: "SOURCE_REPORTED", motivo: "Dato reproducido de una fuente sintética." },
    { codigo: "IDENTITY_UNRESOLVED", motivo: "No está resuelta la identidad física de esta intervención." },
    { codigo: "SEMANTICS_UNREVIEWED", motivo: "No se revisó individualmente el significado de todos los valores." },
    { codigo: "LOCATION_NOT_PUBLISHED", motivo: "No se publica una geometría para este registro." },
    { codigo: "POSSIBLE_DUPLICATE", motivo: "Otro registro podría describir la misma intervención; no se cuenta como otra obra." },
    { codigo: "FIELD_CONFLICT", motivo: "Existen valores reportados incompatibles; no se eligió uno como confirmado." },
  ],
  licencias: [{
    fuenteId, codigo: "bahia-obras", version: 2, codigoLicencia: "CC-BY-4.0",
    urlLicencia: "https://creativecommons.org/licenses/by/4.0/", atribucion: "Atribución exclusivamente sintética.",
    evidenciaUrl: "https://example.invalid/licencia", capturadaEn: "2026-10-14T09:00:00Z",
    alcance: "RESOURCE", recursoVersionIds: [recursoId], distribucionBase: null,
    contenidosIndividuales: "EXCLUDED", licenciaContenidos: null,
  }],
};

/** Tres publicaciones fuente y un retiro; varias publicaciones pueden describir la misma intervención. */
export const reportedRecordFixtures = [
  { registroId: "88000000-0000-4000-8000-000000000001", version: 1, estado: "PUBLISHED", publicadoEn: "2026-10-14T11:00:00Z", motivoRetiro: null, registro: snapshot },
  { registroId: "88000000-0000-4000-8000-000000000002", version: 1, estado: "PUBLISHED", publicadoEn: "2026-10-14T11:00:00Z", motivoRetiro: null, registro: { ...structuredClone(snapshot), territorio: null, fuente: { ...snapshot.fuente, capturadaEn: null } } },
  { registroId: "88000000-0000-4000-8000-000000000003", version: 1, estado: "PUBLISHED", publicadoEn: "2026-10-14T11:00:00Z", motivoRetiro: null, registro: { ...structuredClone(snapshot), tipo: "COMPLETED_SCHOOL_BUILDING_RECORD", nombre: "EJEMPLO SINTÉTICO — Edificio escolar informado" } },
  { registroId: "88000000-0000-4000-8000-000000000004", version: 2, estado: "RETIRED", publicadoEn: "2026-10-14T11:00:00Z", motivoRetiro: "Publicación retirada por corrección de la fuente.", registro: null },
];

/** Revisión v2 sólo sintética: texto largo y literal permitido, dato cero y un campo restringido con motivo independiente. */
export const homogeneousReportedRecordFixture = {
  registroId: "88000000-0000-4000-8000-000000000005", version: 2, estado: "PUBLISHED", publicadoEn: "2026-10-14T12:00:00Z", motivoRetiro: null,
  registro: {
    ...structuredClone(snapshot),
    version: "registro-informado@2", politicaVersion: "publicacion-homogenea@2", nombreGenerado: false,
    nombre: "EJEMPLO SINTÉTICO — Título largo " + "con texto informado íntegro. ".repeat(35) + "FIN DEL TÍTULO COMPLETO",
    datos: [
      ...structuredClone(snapshot.datos),
      { campo: "literal", etiqueta: "Texto literal informado", valor: '=HYPERLINK("https://example.invalid", "dato literal")', estado: "REPORTED", recursoId, columna: "LITERAL" },
      { campo: "datoRestringido", etiqueta: "Campo restringido de ejemplo", valor: null, estado: "WITHHELD", recursoId, columna: "RESTRINGIDO" },
    ],
    advertencias: structuredClone(snapshot.advertencias.slice(4)),
    avisosGenerales: structuredClone(snapshot.advertencias.slice(0, 4)),
    hallazgos: [
      { codigo: "LONG_TEXT_PUBLISHED", campo: "nombre", motivo: "El título supera el tamaño de presentación de una tarjeta; su texto completo se publica en la ficha.", tratamiento: "PUBLISHED_LITERAL", recursoId, columna: "NOMBRE", politicaVersion: "publicacion-homogenea@2" },
      { codigo: "FORMULA_PUBLISHED_LITERAL", campo: "literal", motivo: "El texto comienza con un signo de fórmula y se reproduce como texto, sin ejecución.", tratamiento: "PUBLISHED_LITERAL", recursoId, columna: "LITERAL", politicaVersion: "publicacion-homogenea@2" },
      { codigo: "FIELD_RESTRICTED", campo: "datoRestringido", motivo: "El campo sintético contiene contenido que requiere una limitación; no impide leer el resto del registro.", tratamiento: "FIELD_WITHHELD", recursoId, columna: "RESTRINGIDO", politicaVersion: "publicacion-homogenea@2" },
    ],
  },
};

/** Sección y PDF enteramente sintéticos: diferencia original/transcripción, territorio desconocido y granularidad no resuelta. */
export const documentaryReportedRecordFixture = {
  registroId: "88000000-0000-4000-8000-000000000006", version: 1, estado: "PUBLISHED", publicadoEn: "2026-10-15T16:00:00Z", motivoRetiro: null,
  registro: {
    ...structuredClone(homogeneousReportedRecordFixture.registro),
    tipo: "DOCUMENT_REPORT_SECTION",
    nombre: "EJEMPLO SINTÉTICO — Sección de informe documental",
    territorio: null,
    fuente: { ...structuredClone(snapshot.fuente), codigo: "lujan-documentos", nombre: "Municipalidad sintética · informes", sha256: "b".repeat(64) },
    documento: { urlOriginal: "https://example.invalid/informe-sintetico.pdf", sha256Original: "c".repeat(64), pagina: 2, seccion: "SECCIÓN SINTÉTICA" },
    datos: [
      { campo: "title", etiqueta: "Título informado", valor: "EJEMPLO SINTÉTICO — Sección de informe documental", estado: "REPORTED", recursoId, columna: "title" },
      { campo: "sectionReported", etiqueta: "Sección informada", valor: "SECCIÓN SINTÉTICA", estado: "REPORTED", recursoId, columna: "sectionReported" },
      { campo: "descriptionReported", etiqueta: "Descripción informada", valor: "Texto documental completo. ".repeat(30) + "FIN DE SECCIÓN SINTÉTICA", estado: "REPORTED", recursoId, columna: "descriptionReported" },
      { campo: "statusReported", etiqueta: "Estado informado", valor: "En proceso", estado: "REPORTED", recursoId, columna: "statusReported" },
      { campo: "locationReported", etiqueta: "Ubicación literal informada", valor: "Calle sintética y componentes, sin geometría aprobada", estado: "REPORTED", recursoId, columna: "locationReported" },
      { campo: "reportedPeriod", etiqueta: "Período del informe", valor: "2024", estado: "REPORTED", recursoId, columna: "reportedPeriod" },
    ],
    advertencias: [],
    avisosGenerales: [
      ...structuredClone(homogeneousReportedRecordFixture.registro.avisosGenerales),
      { codigo: "CATALOG_TITLE_STATE_DISCREPANCY", motivo: "Ámbito del catálogo municipal: el título y las notas del informe describen estados diferentes. No se atribuye un estado adicional a esta sección." },
      { codigo: "CATALOG_AUTHOR_ORGANIZATION_DIFFER", motivo: "Ámbito del catálogo municipal: el autor y la organización son metadatos distintos y no acreditan por sí solos el ejecutor de esta sección." },
    ],
    hallazgos: [
      { codigo: "REPORT_SECTION_GRANULARITY_UNRESOLVED", campo: null, motivo: "La sección puede agrupar calles o componentes; no acredita una obra única.", tratamiento: "PUBLISHED_LITERAL", recursoId, columna: "sectionReported", politicaVersion: "publicacion-homogenea@2" },
    ],
    licencias: snapshot.licencias.map(license => ({ ...structuredClone(license), codigo: "lujan-documentos" })),
  },
};
