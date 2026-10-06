/** @file Validación y serialización de filtros públicos, presentación y selección mediante URLs compartibles. */
import type { BoundingBox, ListQuery } from "../api/client";

/** Cámara inicial de Argentina; no limita silenciosamente el catálogo textual. */
export const DEFAULT_BBOX: BoundingBox = [-73.6, -55.2, -53.5, -21.7];
// Initial camera and geometry read are different: never silently filter the list.
// Read the representable world with the same page/byte/position budgets.
/** Área mundial representable en Mercator para leer geometrías cuando el usuario no confirmó un bbox. */
export const MAP_READ_BBOX: BoundingBox = [-180, -85.051129, 180, 85.051129];
/** Jurisdicciones habilitadas para filtros explícitos; la entrada sin selección conserva todo el catálogo. */
export const AVAILABLE_PROVINCE_CODES = ["02", "06"] as const;
/** Fuentes de catálogo admitidas en filtros públicos; sus nombres no atribuyen responsabilidad de la obra. */
export const SOURCES = { "pba-edificios": "PBA · edificios escolares", "caba-actualizado": "CABA · obras", "nacion-obras": "Nación · obras", "vl-obras": "Vicente López · obras", "bahia-obras": "Municipalidad de Bahía Blanca", "olavarria-obras": "Municipalidad de Olavarría", "pergamino-obras": "Municipalidad de Pergamino" } as const;
/** Traducciones de estados informados; no se infieren del avance ni de la ausencia de datos. */
export const STATES = { COMPLETED: "Finalizada", IN_PROGRESS: "En ejecución", OTHER_REPORTED: "Otro estado informado" } as const;
/** Roles institucionales publicados tras revisión; la fuente de datos no determina ninguno de estos roles. */
export const INSTITUTIONAL_ROLES = { PROMOTOR: "Promotor", CONTRATANTE: "Contratante", EJECUTOR: "Ejecutor", FINANCIADOR: "Financiador", CONTRATISTA: "Contratista" } as const;
/** Consulta de API separada de presentación y selección compartible del explorador. */
export type ExplorerQuery = { query: ListQuery; view: "lista" | "mapa"; showBoundaries?: boolean; obra?: string; revisionId?: string; ubicacionId?: string };
/** Comprueba el formato UUID antes de incorporar una selección a ruta/consulta pública. */
export const isUUID = (value: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
/** Comprueba una fecha civil ISO completa, incluidos días de cada mes y años bisiestos, sin convertirla a hora local. */
export function isCivilDate(value: string): boolean {
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Valida filtros, área y selección; sólo provinciaCodigo y partidos admiten valores repetidos con semántica OR.
 * @param params - Parámetros de URL sin deduplicar previamente.
 * @returns Consulta global con página de 20 obras salvo filtros explícitos, y presentación/selección separadas.
 * @throws TypeError Si el enlace contiene valores o relaciones inválidas.
 */
export function parseExplorerQuery(params: URLSearchParams): ExplorerQuery {
  for (const key of new Set(params.keys())) {
    if (key !== "provinciaCodigo" && key !== "partidos" && params.getAll(key).length > 1) throw new TypeError("Hay parámetros repetidos en el enlace.");
  }
  const query: ListQuery = { limit: 20 };
  const provinces = params.getAll("provinciaCodigo");
  if (provinces.length > 24 || provinces.some(value => !AVAILABLE_PROVINCE_CODES.some(code => code === value)))
    throw new TypeError("La provincia requiere un código activo válido y hasta 24 valores.");
  if (provinces.length) query.provinciaCodigo = [...new Set(provinces)].sort();
  const fuente = params.get("fuente");
  if (fuente) { if (!Object.hasOwn(SOURCES, fuente)) throw new TypeError("Fuente desconocida."); query.fuente = fuente as keyof typeof SOURCES; }
  const estado = params.get("estado");
  if (estado) { if (!Object.hasOwn(STATES, estado)) throw new TypeError("Estado desconocido."); query.estado = estado as keyof typeof STATES; }
  const sector = params.get("sector");
  if (sector) { if (sector !== "educacion") throw new TypeError("Sector desconocido."); query.sector = sector; }
  const geometry = params.get("tieneGeometria");
  if (geometry) { if (!["true", "false"].includes(geometry)) throw new TypeError("Filtro de ubicación inválido."); query.tieneGeometria = geometry === "true"; }
  const scheme = params.get("territorioEsquema");
  const code = params.get("municipioCodigo");
  const party = params.get("partidoId");
  const parties = params.getAll("partidos");
  if (parties.length > 135 || parties.some(value => !isUUID(value)))
    throw new TypeError("Los partidos requieren identidades UUID válidas y hasta 135 valores.");
  if (params.has("partidos") && (params.has("partidoId") || params.has("territorioEsquema") || params.has("municipioCodigo")))
    throw new TypeError("Elegí partidos o el filtro territorial anterior, sin combinarlos.");
  if (parties.length) query.partidos = [...new Set(parties.map(value => value.toLowerCase()))].sort();
  if (party) {
    if (!isUUID(party) || params.has("territorioEsquema") || params.has("municipioCodigo")) throw new TypeError("El partido requiere una identidad válida y no se combina con el filtro territorial anterior.");
    query.partidoId = party.toLowerCase();
  }
  if (scheme || code) {
    if (scheme !== "pba.municipio" || !code || !/^\d{1,32}$/.test(code)) throw new TypeError("El municipio requiere un código y esquema PBA válidos.");
    query.territorioEsquema = scheme; query.municipioCodigo = code;
  }
  for (const key of ["partidoVerificadoId", "gestionMunicipalId", "organizacionId"] as const) {
    const value = params.get(key);
    if (value) {
      if (!isUUID(value)) throw new TypeError("La asociación requiere una identidad válida.");
      query[key] = value.toLowerCase();
    }
  }
  const role = params.get("rolInstitucional");
  if (role) {
    if (!Object.hasOwn(INSTITUTIONAL_ROLES, role)) throw new TypeError("Rol institucional desconocido.");
    query.rolInstitucional = role as keyof typeof INSTITUTIONAL_ROLES;
  }
  for (const key of ["periodoDesde", "periodoHasta"] as const) {
    const value = params.get(key);
    if (value) {
      if (!isCivilDate(value)) throw new TypeError("La vigencia del rol requiere una fecha válida.");
      query[key] = value;
    }
  }
  if (Boolean(query.periodoDesde) !== Boolean(query.periodoHasta)) throw new TypeError("El período de vigencia requiere ambas fechas.");
  if (query.periodoDesde && query.periodoHasta && query.periodoDesde > query.periodoHasta) throw new TypeError("El período de vigencia no puede terminar antes de comenzar.");
  const area = params.get("bbox");
  if (area) {
    const pieces = area.split(",");
    const nums = pieces.map(Number);
    if (pieces.some(p => !p.trim()) || nums.length !== 4 || !nums.every(Number.isFinite)) throw new TypeError("Área inválida.");
    const [west, south, east, north] = nums as [number, number, number, number];
    if (west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) throw new TypeError("Área fuera de los límites admitidos.");
    if (query.tieneGeometria === false) throw new TypeError("Quitá el área para consultar obras sin ubicación.");
    query.bbox = [west, south, east, north];
  }
  const cursor = params.get("cursor");
  if (cursor) { if (cursor.length > 4096) throw new TypeError("Página inválida."); query.cursor = cursor; }
  const view = params.get("vista") || "mapa";
  if (view !== "lista" && view !== "mapa") throw new TypeError("Vista desconocida.");
  const boundaries = params.get("limites");
  if (boundaries && boundaries !== "mostrar") throw new TypeError("Presentación de límites desconocida.");
  const obra = params.get("obra"); const revisionId = params.get("revisionId"); const ubicacionId = params.get("ubicacionId");
  if ((obra && !isUUID(obra)) || (revisionId && (!obra || !isUUID(revisionId))) ||
    (ubicacionId !== null && (!obra || !revisionId || !isUUID(ubicacionId)))) throw new TypeError("Selección inválida.");
  return { query, view, ...(boundaries === "mostrar" ? { showBoundaries: true } : {}), ...(obra ? { obra: obra.toLowerCase() } : {}), ...(revisionId ? { revisionId: revisionId.toLowerCase() } : {}), ...(ubicacionId ? { ubicacionId: ubicacionId.toLowerCase() } : {}) };
}

/** Serializa filtros sin el límite interno; provincia y partidos usan valores repetidos, bbox usa comas y los códigos conservan ceros. */
export function queryParams(query: ListQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || key === "limit") continue;
    if (Array.isArray(value) && key !== "bbox") value.forEach(item => params.append(key, String(item)));
    else params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  return params;
}

/** Genera un enlace de consulta, incluyendo vista lista cuando se solicita; no incorpora una selección ajena. */
export function explorerHref(query: ListQuery, view: "lista" | "mapa" = "mapa", showBoundaries = false): string {
  const params = queryParams(query);
  if (view === "lista") params.set("vista", "lista");
  if (showBoundaries) params.set("limites", "mostrar");
  return "/mapa" + (params.size ? "?" + params : "");
}

/**
 * Abre las publicaciones sin ubicación en la vista textual conservando los demás filtros.
 * @param query - Consulta actual; el área y el cursor no son válidos para esta nueva consulta.
 * @returns Enlace a la primera página sin área, con `tieneGeometria=false` y vista lista.
 */
export function unlocatedListHref(query: ListQuery): string {
  const { bbox: _bbox, cursor: _cursor, ...filters } = query;
  return explorerHref({ ...filters, tieneGeometria: false }, "lista");
}

/** Convierte searchParams de App Router conservando valores repetidos para validar arrays y rechazar escalares ambiguos. */
export function searchParamsOf(values: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach(v => params.append(key, v));
    else if (value !== undefined) params.set(key, value);
  }
  return params;
}
