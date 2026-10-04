import type { components, paths } from "./generated.js";
import { ApiContractError, parsePublicResponse } from "./contract.js";

export type WorkList = components["schemas"]["PublicWorkListResponse"];
export type WorkDetail = components["schemas"]["PublicWorkDetail"];
export type WorkSummary = components["schemas"]["PublicWorkSummary"];
export type WorkGeoJSON = components["schemas"]["PublicGeoFeatureCollection"];
type ErrorEnvelope = components["schemas"]["PublicApiError"];
export type BoundingBox = readonly [number, number, number, number];

type ListParameters = NonNullable<
  paths["/api/v1/obras"]["get"]["parameters"]["query"]
>;
export type PublicFilters = Omit<
  ListParameters,
  "bbox" | "limit" | "cursor" | "tieneGeometria"
> & { tieneGeometria?: boolean };
export type ListQuery = PublicFilters &
  Pick<ListParameters, "limit" | "cursor"> & { bbox?: BoundingBox };
export interface GeoQuery extends ListQuery {
  bbox: BoundingBox;
}
export interface RequestOptions {
  signal?: AbortSignal;
}

export class PublicApiError extends Error {
  readonly code: string;
  readonly requestId: string | null;
  constructor(
    readonly status: number,
    error: ErrorEnvelope["error"],
  ) {
    super(error.message);
    this.name = "PublicApiError";
    this.code = error.code;
    this.requestId = error.requestId;
  }
  get requiresPaginationRestart() {
    return this.code === "CATALOG_CHANGED";
  }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function identifier(value: string): string {
  if (!uuid.test(value))
    throw new TypeError("El identificador debe ser un UUID.");
  return value.toLowerCase();
}

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
