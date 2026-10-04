import type { BoundingBox, ListQuery } from "../api/client";

export const DEFAULT_BBOX: BoundingBox = [-73.6, -55.2, -53.5, -21.7];
export const SOURCES = { "pba-edificios": "PBA · edificios escolares", "caba-actualizado": "CABA · obras", "nacion-obras": "Nación · obras", "vl-obras": "Vicente López · obras" } as const;
export const STATES = { COMPLETED: "Finalizada", IN_PROGRESS: "En ejecución", OTHER_REPORTED: "Otro estado informado" } as const;
export type ExplorerQuery = { query: ListQuery; view: "lista" | "mapa"; obra?: string; revisionId?: string };
export const isUUID = (value: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);

export function parseExplorerQuery(params: URLSearchParams): ExplorerQuery {
  for (const key of new Set(params.keys())) {
    if (params.getAll(key).length > 1) throw new TypeError("Hay parámetros repetidos en el enlace.");
  }
  const query: ListQuery = { limit: 20 };
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
  if (scheme || code) {
    if (scheme !== "pba.municipio" || !code || !/^\d{1,32}$/.test(code)) throw new TypeError("El municipio requiere un código y esquema PBA válidos.");
    query.territorioEsquema = scheme; query.municipioCodigo = code;
  }
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
  const view = params.get("vista") || "lista";
  if (view !== "lista" && view !== "mapa") throw new TypeError("Vista desconocida.");
  if (view === "mapa") {
    if (query.tieneGeometria === false) throw new TypeError("Las obras sin ubicación se exploran en la lista.");
    query.bbox ??= DEFAULT_BBOX;
  }
  const obra = params.get("obra"); const revisionId = params.get("revisionId");
  if ((obra && !isUUID(obra)) || (revisionId && (!obra || !isUUID(revisionId)))) throw new TypeError("Selección inválida.");
  return { query, view, ...(obra ? { obra: obra.toLowerCase() } : {}), ...(revisionId ? { revisionId: revisionId.toLowerCase() } : {}) };
}

export function queryParams(query: ListQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && key !== "limit") params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  return params;
}

export function explorerHref(query: ListQuery, view: "lista" | "mapa" = "lista"): string {
  const params = queryParams(query);
  if (view === "mapa") params.set("vista", "mapa");
  return "/mapa" + (params.size ? "?" + params : "");
}

export function searchParamsOf(values: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach(v => params.append(key, v));
    else if (value !== undefined) params.set(key, value);
  }
  return params;
}
