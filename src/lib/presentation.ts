/** @file Etiquetas públicas y formatos que conservan desconocidos, precisión decimal y semántica de fechas. */
import type { WorkDetail, WorkSummary } from "../api/client.js";

/** Explica el estado como reportado por la fuente y conserva el desconocido como no informado. */
export function stateLabel(state: WorkSummary["estado"]): string {
  return state === null ? "Estado no informado" : {
    COMPLETED: "Finalizada según la fuente",
    IN_PROGRESS: "En ejecución según la fuente",
    OTHER_REPORTED: "Otro estado informado",
  }[state];
}

/** Traduce códigos de catálogos a sus nombres de referencia sin atribuir responsabilidad a la fuente. */
export function sourceLabel(source: WorkSummary["fuentes"][number]["codigo"]): string {
  return {
    "pba-edificios": "Edificios escolares de Buenos Aires",
    "caba-actualizado": "Obras de la Ciudad de Buenos Aires",
    "nacion-obras": "Obras de Nación",
    "vl-obras": "Obras de Vicente López",
  }[source];
}

/** Format digits directly: Number would round large or high-precision amounts. */
export function formatExactDecimal(value: string | null | undefined): string {
  if (value === null || value === undefined) return "No informado";
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return value;
  const integer = match[2]!.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${match[1]}${integer}${match[3] === undefined ? "" : `,${match[3]}`}`;
}

/** Admite sólo enlaces HTTP(S) sin usuario/contraseña; las referencias inválidas no se vuelven clickeables. */
export function safeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
      ? url.href : null;
  } catch { return null; }
}

/** A civil date is not an instant and must never move a day with the timezone. */
export function civilDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

/** Formatea un instante explícitamente en UTC, preservando la diferencia con la fecha del dato fuente. */
export function publicationDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return `${new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }).format(date)} UTC`;
}

/** Distingue año conocido de día civil y evita desplazar este último por zona horaria. */
export function reportedDate(value: WorkDetail["fechasInformadas"][number]): string {
  return "anio" in value ? `${value.anio} (solo se conoce el año)` : civilDate(value.diaCivil);
}

/** Explica el alcance de la precisión informada; un establecimiento no acredita la extensión de la obra. */
export function locationPrecision(value: WorkDetail["ubicaciones"][number]["precision"]): string {
  return {
    ubicacion_establecimiento_reportada: "Ubicación reportada del establecimiento; no indica el alcance de la obra.",
    coordenada_reportada_sin_precision: "Coordenada reportada sin precisión documentada.",
    geometria_reportada_sin_precision: "Geometría reportada sin precisión documentada.",
  }[value];
}

/** Aspectos de calidad necesarios para explicar ubicación sin copiar la geometría. */
export type LocationQuality = Pick<WorkDetail["ubicaciones"][number], "condicion" | "crs" | "precision" | "origenGeometria">;

/** Acceptance, precision and a reviewed CRS assumption are separate facts. */
export function locationPresentation(location: LocationQuality): { label: string; explanation: string; reference: string | null } {
  const assumed = location.crs?.fundamento === "REVIEW_DECISION" && location.crs.condicion === "APPROVED_ASSUMPTION";
  const serviceReference = location.crs?.fundamento === "OFFICIAL_SERVICE" && location.crs.condicion === "SERVICE_REFERENCE";
  const undocumentedPrecision = location.precision !== "ubicacion_establecimiento_reportada";
  const reference = location.crs
    ? `Referencia geográfica ${location.crs.codigo}: ${assumed ? "supuesto aprobado mediante revisión" : serviceReference ? "salida del servicio oficial; no declara el sistema de coordenadas de la fuente" : "informada por el catálogo de origen"}.`
    : null;
  if (location.condicion === "ACCEPTED" && location.origenGeometria === "ADDRESS_GEOCODE") {
    return {
      label: "Domicilio geocodificado · ubicación orientativa",
      explanation: "La fuente no informó coordenadas. El servicio oficial Georef obtuvo un punto a partir de la dirección. Su precisión no está verificada. El punto no acredita el sitio exacto ni el alcance de la obra.",
      reference,
    };
  }
  if (location.condicion === "ACCEPTED" && assumed && undocumentedPrecision) {
    return {
      label: "Ubicación orientativa · precisión no informada",
      explanation: "La fuente no informó el sistema de coordenadas. Se aprobó interpretarlas como WGS84 durante la revisión. El punto no acredita el sitio exacto ni el alcance de la obra.",
      reference,
    };
  }
  const condition = { ACCEPTED: "Ubicación aprobada", PENDING_REVIEW: "Ubicación pendiente de revisión", OMITTED: "Ubicación omitida", INVALID: "Ubicación inválida" };
  return {
    label: location.condicion !== "ACCEPTED" ? condition[location.condicion]
      : location.precision === "ubicacion_establecimiento_reportada" ? "Ubicación reportada del establecimiento"
      : "Ubicación reportada · precisión no informada",
    explanation: locationPrecision(location.precision),
    reference,
  };
}

const fields: Record<string, string> = {
  nombre: "Nombre", estado: "Estado", avanceFisico: "Avance físico", avanceFinanciero: "Avance financiero",
  clasificaciones: "Clasificaciones", programas: "Programas", territorios: "Territorios",
  ubicaciones: "Ubicaciones", importes: "Importes", fechasInformadas: "Fechas informadas",
  educacion: "Información educativa", participantes: "Participantes", contratacion: "Contratación",
  atributosFuente: "Otros datos de la fuente", nacional: "Datos de Nación", municipal: "Datos municipales",
  jurisdiccionReportada: "Jurisdicción reportada", razonSocial: "Razón social reportada", cuit: "CUIT reportado",
  ejercicio: "Ejercicio", numero: "Número", procedimiento: "Procedimiento", expediente: "Expediente",
  gestion: "Gestión reportada", subfuente: "Subfuente", descripcion: "Descripción", objetivo: "Objetivo",
  duracionDias: "Duración informada en días", estadoFuente: "Estado en la fuente", sectorFuente: "Sector en la fuente",
  tipoProyectoFuente: "Tipo de proyecto en la fuente", monedaFuente: "Moneda en la fuente", programaFuente: "Programa en la fuente",
  referencias: "Referencias", idproyecto: "Identificador del proyecto", numeroObra: "Número de obra", bapin: "BAPIN",
  operacionFinanciera: "Operación financiera", perfilObra: "Perfil de obra", ejecutor: "Ejecutor reportado",
  financiadores: "Financiadores reportados", territorio: "Territorio reportado", provincia: "Provincia",
  departamento: "Departamento", codigoBahra: "Código BAHRA", contraparteRol: "Rol de contraparte",
  contraparteNombre: "Nombre de contraparte", contraparteCuit: "CUIT de contraparte", contraparteModalidad: "Modalidad de contraparte",
  accionClimatica: "Acción climática", odsIncidencia: "Incidencia en ODS", lugarReportado: "Lugar reportado",
  areaResponsableReportada: "Área responsable reportada", tipoFuente: "Tipo en la fuente", establecimientos: "Establecimientos",
  clave: "Clave", idFuente: "Identificador en la fuente", cui: "CUI", matricula: "Matrícula informada",
  periodo: "Período", regionEducativa: "Región educativa", tipoIntervencion: "Intervención", inicio: "Inicio", fin: "Fin",
};

/** Traduce cada segmento de un campo de procedencia y conserva las claves desconocidas como referencia. */
export function fieldLabel(value: string): string {
  return value.split(".").map((part) => fields[part] ?? part).join(" · ");
}

/** Traduce estados de calidad sin confundir dato desconocido, no aplicable, inválido o pendiente. */
export function qualityLabel(value: WorkDetail["calidadCampos"][string]["estado"]): string {
  return { KNOWN: "Informado", NOT_REPORTED: "No informado", NOT_APPLICABLE: "No corresponde", INVALID: "Dato inválido", PENDING_REVIEW: "Pendiente de revisión" }[value];
}
