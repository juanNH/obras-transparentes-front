/** @file Cliente de lectura pública independiente de Next.js, con tipos generados y validación runtime de contrato. */
import type { components, paths } from "./generated.js";
import { ApiContractError, parsePublicResponse } from "./contract.js";

/** Página pública de obras y versión del catálogo, tomada del contrato generado. */
export type WorkList = components["schemas"]["PublicWorkListResponse"];
/** Detalle público de una revisión con procedencia, calidad y ubicaciones según el contrato generado. */
export type WorkDetail = components["schemas"]["PublicWorkDetail"];
/** Resumen de una obra publicada; `tieneGeometria` indica disponibilidad de ubicación aprobada. */
export type WorkSummary = components["schemas"]["PublicWorkSummary"];
/** Página de ubicaciones aceptadas y su versión, tomada del contrato GeoJSON generado. */
export type WorkGeoJSON = components["schemas"]["PublicGeoFeatureCollection"];
/** Sobre público de error que permite conservar código e identificador de solicitud. */
type ErrorEnvelope = components["schemas"]["PublicApiError"];
/** Área WGS84 en orden oeste, sur, este, norte; no admite cruce del antimeridiano. */
export type BoundingBox = readonly [number, number, number, number];

/** Parámetros del listado derivados de OpenAPI para evitar duplicar su contrato a mano. */
type ListParameters = NonNullable<
  paths["/api/v1/obras"]["get"]["parameters"]["query"]
>;
/** Filtros compartidos de obras/ubicaciones; el booleano de geometría se serializa al crear la consulta. */
export type PublicFilters = Omit<
  ListParameters,
  "bbox" | "limit" | "cursor" | "tieneGeometria"
> & { tieneGeometria?: boolean };
/** Consulta paginada; un área limita el listado a obras con ubicaciones aprobadas que la intersectan. */
export type ListQuery = PublicFilters &
  Pick<ListParameters, "limit" | "cursor"> & { bbox?: BoundingBox };
/** Consulta cartográfica que requiere área explícita además de los filtros públicos. */
export interface GeoQuery extends ListQuery {
  bbox: BoundingBox;
}
/** Cancelación aportada por el consumidor para una lectura pública. */
export interface RequestOptions {
  signal?: AbortSignal;
}

/** Error HTTP compatible con el contrato; diferencia cambio de catálogo de una falla de transporte. */
export class PublicApiError extends Error {
  readonly code: string;
  readonly requestId: string | null;
  /** Conserva estado, código y requestId del sobre validado para que el consumidor pueda recuperarse. */
  constructor(
    readonly status: number,
    error: ErrorEnvelope["error"],
  ) {
    super(error.message);
    this.name = "PublicApiError";
    this.code = error.code;
    this.requestId = error.requestId;
  }
  /** Indica que ninguna página anterior debe mezclarse con la nueva versión del catálogo. */
  get requiresPaginationRestart() {
    return this.code === "CATALOG_CHANGED";
  }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * Valida un UUID antes de incorporarlo a una ruta y normaliza sus letras.
 * @throws TypeError Si la identidad no tiene formato UUID.
 */
function identifier(value: string): string {
  if (!uuid.test(value))
    throw new TypeError("El identificador debe ser un UUID.");
  return value.toLowerCase();
}

/**
 * Valida límites WGS84 crecientes y serializa el área en orden oeste,sur,este,norte.
 * @param bbox - Rectángulo sin cruce del antimeridiano.
 * @returns Área lista para el parámetro bbox.
 * @throws TypeError Si hay coordenadas no finitas o límites inválidos.
 */
export function serializeBBox(bbox: BoundingBox): string {
  const [west, south, east, north] = bbox;
  if (
    bbox.length !== 4 ||
    !bbox.every(Number.isFinite) ||
    west < -180 ||
    east > 180 ||
    south < -90 ||
    north > 90 ||
    west >= east ||
    south >= north
  ) {
    throw new TypeError(
      "El área debe ser west,south,east,north en WGS84, sin cruzar el antimeridiano.",
    );
  }
  return bbox.join(",");
}

/** Serializa exclusivamente filtros públicos con límites de página y pares esquema/código territorial válidos. */
function queryParameters(
  query: ListQuery,
  maxLimit: number,
  defaultLimit: number,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of [
    "fuente",
    "estado",
    "sector",
    "territorioEsquema",
    "municipioCodigo",
  ] as const) {
    const value = query[key];
    if (value !== undefined) params.set(key, value);
  }
  if (Boolean(query.territorioEsquema) !== Boolean(query.municipioCodigo)) {
    throw new TypeError(
      "El código de municipio requiere su esquema territorial.",
    );
  }
  if (
    query.municipioCodigo !== undefined &&
    !/^[0-9]{1,32}$/.test(query.municipioCodigo)
  ) {
    throw new TypeError(
      "El código de municipio debe conservar sus dígitos y ceros iniciales.",
    );
  }
  if (query.tieneGeometria !== undefined)
    params.set("tieneGeometria", String(query.tieneGeometria));
  if (query.bbox !== undefined) params.set("bbox", serializeBBox(query.bbox));
  const limit = query.limit ?? defaultLimit;
  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit)
    throw new TypeError("Límite de página inválido.");
  params.set("limit", String(limit));
  if (query.cursor !== undefined) {
    if (!query.cursor || query.cursor.length > 4096)
      throw new TypeError("Cursor inválido.");
    params.set("cursor", query.cursor);
  }
  return params;
}

/**
 * Crea un cliente anónimo GET con validación runtime y rechazo de redirecciones.
 * @param options - Base pública y fetch inyectable para servidor, navegador o pruebas.
 * @returns Lecturas tipadas de lista, GeoJSON y ficha por revisión.
 * @throws TypeError Si la base incluye credenciales o una ruta relativa insegura.
 */
export function createPublicApi(
  options: { baseUrl?: string; fetch?: typeof fetch } = {},
) {
  const base = (options.baseUrl ?? "/api/v1").replace(/\/$/, "");
  if (/^[a-z]+:/i.test(base)) {
    const url = new URL(base);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new TypeError("URL pública de API inválida.");
    }
  } else if (
    !base.startsWith("/") ||
    base.startsWith("//") ||
    /[?#]/.test(base)
  ) {
    throw new TypeError("La API relativa debe usar una ruta de mismo origen.");
  }
  const request = options.fetch ?? globalThis.fetch;
  /** Lee JSON sin credenciales, valida el sobre de error o la respuesta y preserva cancelaciones de transporte. */
  async function read<T>(
    path: string,
    schema: string,
    requestOptions: RequestOptions,
  ): Promise<T> {
    const response = await request(base + path, {
      method: "GET",
      credentials: "omit",
      redirect: "error",
      headers: { Accept: "application/json" },
      ...(requestOptions.signal ? { signal: requestOptions.signal } : {}),
    });
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ApiContractError(
          "La API no devolvió una respuesta JSON válida.",
        );
      }
      throw error;
    }
    if (!response.ok) {
      const envelope = parsePublicResponse<ErrorEnvelope>(
        "PublicApiError",
        body,
      );
      throw new PublicApiError(response.status, envelope.error);
    }
    return parsePublicResponse<T>(schema, body);
  }
  return {
    /**
     * Obtiene una página de publicaciones; sin área incluye obras sin geometría aprobada.
     * @param query - Filtros y cursor de la misma consulta/versionado.
     * @param requestOptions - Señal opcional de cancelación.
     * @returns Página validada, sin deducir un total del catálogo.
     */
    list(
      query: ListQuery = {},
      requestOptions: RequestOptions = {},
    ): Promise<WorkList> {
      return read(
        "/obras?" + queryParameters(query, 200, 20),
        "PublicWorkListResponse",
        requestOptions,
      );
    },
    /**
     * Obtiene ubicaciones aceptadas en un área; varias features pueden pertenecer a una sola obra.
     * @param query - Área WGS84 obligatoria y filtros públicos.
     * @param requestOptions - Señal opcional de cancelación.
     * @returns Página GeoJSON validada con cursor de continuación.
     */
    geojson(
      query: GeoQuery,
      requestOptions: RequestOptions = {},
    ): Promise<WorkGeoJSON> {
      if (!query.bbox)
        throw new TypeError("La consulta cartográfica requiere un área.");
      return read(
        "/obras/geojson?" + queryParameters(query, 500, 100),
        "PublicGeoFeatureCollection",
        requestOptions,
      );
    },
    /**
     * Consulta la ficha actual o una revisión pública exacta sin sustituir silenciosamente la identidad solicitada.
     * @param id - Identificador UUID de obra.
     * @param revisionId - Revisión publicada, si se requiere una lectura histórica/exacta.
     * @param requestOptions - Señal opcional de cancelación.
     * @returns Detalle público validado.
     */
    detail(
      id: string,
      revisionId?: string,
      requestOptions: RequestOptions = {},
    ): Promise<WorkDetail> {
      const params = revisionId ? "?revisionId=" + identifier(revisionId) : "";
      return read(
        "/obras/" + identifier(id) + params,
        "PublicWorkDetail",
        requestOptions,
      );
    },
  };
}

/** No mezcla páginas ni mapa/listado que provengan de distintas publicaciones. */
export function assertSameCatalog(
  ...responses: { catalogoVersion: string }[]
): void {
  if (
    responses.some(
      (response) => response.catalogoVersion !== responses[0]?.catalogoVersion,
    )
  ) {
    throw new PublicApiError(409, {
      code: "CATALOG_CHANGED",
      message:
        "El catálogo cambió; reiniciá la consulta conservando los filtros.",
      requestId: null,
    });
  }
}
