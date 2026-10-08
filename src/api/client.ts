/** @file Cliente de lectura pública independiente de Next.js, con tipos generados y validación runtime de contrato. */
import type { components, paths } from "./generated.js";
import { ApiContractError, parsePublicResponse } from "./contract.js";
import { isKnownProvinceCode } from "./territory-codes.js";

/** Página pública de obras y versión del catálogo, tomada del contrato generado. */
export type WorkList = components["schemas"]["PublicWorkListResponse"];
/** Detalle público de una revisión con procedencia, calidad y ubicaciones según el contrato generado. */
export type WorkDetail = components["schemas"]["PublicWorkDetail"];
/** Resumen de una obra publicada; `tieneGeometria` indica disponibilidad de ubicación aprobada. */
export type WorkSummary = components["schemas"]["PublicWorkSummary"];
/** Página de ubicaciones aceptadas y su versión, tomada del contrato GeoJSON generado. */
export type WorkGeoJSON = components["schemas"]["PublicGeoFeatureCollection"];
/** Nómina oficial versionada de los 135 partidos, con códigos separados y estado de límites. */
export type PartyCatalog = components["schemas"]["PublicPartyCatalogResponse"];
/** Provincias y ciudades autónomas habilitadas, con códigos INDEC y procedencia del catálogo versionado. */
export type ProvinceCatalog = components["schemas"]["PublicProvinceCatalog"];
/** Catálogo oficial completo de localidades y jerarquía GeoRef independiente de las publicaciones. */
export type LocalityCatalog = components["schemas"]["PublicLocalityCatalog"];
/** Límites versionados para representación territorial; no prueban ubicación de obras. */
export type PartyBoundaries =
  components["schemas"]["PublicPartyBoundaryFeatureCollection"];
/** Organizaciones con roles verificados en publicaciones actuales; sus identidades son independientes de las organizaciones de seguridad. */
export type InstitutionalOrganizationCatalog =
  paths["/api/v1/organizaciones-institucionales"]["get"]["responses"][200]["content"]["application/json"];
/** Totales globales de las tres fuentes piloto en una versión del catálogo público; no son conteos de filtros ni gestión municipal. */
export type MunicipalCoverage =
  components["schemas"]["PublicMunicipalCoverage"];
/** Inventario público de Provincia/Nación con unidad documental, ubicaciones y evidencia de licencia del corte publicado. */
export type SourceCoverage = components["schemas"]["PublicSourceCoverage"];
/** Fuentes habilitadas para el agregado de cobertura, conservadas desde el contrato generado. */
export type SourceCoverageCode = SourceCoverage["fuentes"][number]["codigo"];
/** Pares documentales publicados por cada perfil vigente; una localización nunca ocupa el rol de registro principal de obra. */
const sourceDocumentResources = {
  "pba-edificios": [
    { rol: "principal", unidadDocumental: "COMPLETED_SCHOOL_BUILDING_RECORD" },
  ],
  "nacion-obras": [
    { rol: "principal", unidadDocumental: "WORK_RECORD" },
    { rol: "geometrias", unidadDocumental: "SPATIAL_LOCATION_RECORD" },
  ],
} as const satisfies Record<
  SourceCoverageCode,
  readonly SourceCoverage["fuentes"][number]["recursos"][number][]
>;
/** Totales de obras por filtros sin paginación; el área particiona sólo publicaciones con geometría aprobada. */
export type WorkCounts = components["schemas"]["PublicWorkCounts"];
/** Sobre público de error que permite conservar código e identificador de solicitud. */
type ErrorEnvelope = components["schemas"]["PublicApiError"];
/** Área WGS84 en orden oeste, sur, este, norte; no admite cruce del antimeridiano. */
export type BoundingBox = readonly [number, number, number, number];

/** Parámetros del listado derivados de OpenAPI para evitar duplicar su contrato a mano. */
type ListParameters = NonNullable<
  paths["/api/v1/obras"]["get"]["parameters"]["query"]
>;
/** Filtros de obras/ubicaciones derivados del contrato; arrays readonly territoriales se serializan como valores repetidos. */
export type PublicFilters = Omit<
  ListParameters,
  | "bbox"
  | "limit"
  | "cursor"
  | "tieneGeometria"
  | "provinciaCodigo"
  | "partidos"
  | "localidadCodigo"
> & { tieneGeometria?: boolean } & {
  [Key in "provinciaCodigo" | "partidos" | "localidadCodigo"]?: Readonly<
    NonNullable<ListParameters[Key]>
  >;
};
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

/** Serializa filtros públicos sin provincia predeterminada, con arrays OR normalizados y límites crudos previos a deduplicar. */
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
    "partidoId",
    "partidoVerificadoId",
    "gestionMunicipalId",
    "organizacionId",
    "rolInstitucional",
    "periodoDesde",
    "periodoHasta",
  ] as const) {
    const value = query[key];
    if (value !== undefined) params.set(key, value);
  }
  if (query.provinciaCodigo !== undefined) {
    if (
      !Array.isArray(query.provinciaCodigo) ||
      query.provinciaCodigo.length < 1 ||
      query.provinciaCodigo.length > 24 ||
      query.provinciaCodigo.some(
        (value) => typeof value !== "string" || !/^\d{2}$/.test(value),
      )
    )
      throw new TypeError(
        "La provincia requiere un código INDEC de dos dígitos y hasta 24 valores.",
      );
    [...new Set(query.provinciaCodigo)]
      .sort()
      .forEach((value) => params.append("provinciaCodigo", value));
  }
  if (query.partidos !== undefined) {
    if (
      !Array.isArray(query.partidos) ||
      query.partidos.length < 1 ||
      query.partidos.length > 135 ||
      query.partidos.some(
        (value) => typeof value !== "string" || !uuid.test(value),
      )
    )
      throw new TypeError(
        "Los partidos requieren identidades UUID válidas y hasta 135 valores.",
      );
    if (
      query.partidoId !== undefined ||
      query.territorioEsquema !== undefined ||
      query.municipioCodigo !== undefined
    )
      throw new TypeError(
        "Elegí partidos o el filtro territorial anterior, sin combinarlos.",
      );
    [...new Set(query.partidos.map((value) => identifier(value)))]
      .sort()
      .forEach((value) => params.append("partidos", value));
  }
  if (query.localidadCodigo !== undefined) {
    if (
      !Array.isArray(query.localidadCodigo) ||
      query.localidadCodigo.length < 1 ||
      query.localidadCodigo.length > 100 ||
      query.localidadCodigo.some(
        (value) => typeof value !== "string" || !/^\d{8,10}$/.test(value),
      )
    )
      throw new TypeError(
        "La localidad requiere un código GeoRef de 8 o 10 dígitos y hasta 100 valores.",
      );
    [...new Set(query.localidadCodigo)]
      .sort()
      .forEach((value) => params.append("localidadCodigo", value));
  }
  if (Boolean(query.territorioEsquema) !== Boolean(query.municipioCodigo)) {
    throw new TypeError(
      "El código de municipio requiere su esquema territorial.",
    );
  }
  if (query.partidoId !== undefined) {
    identifier(query.partidoId);
    if (
      query.territorioEsquema !== undefined ||
      query.municipioCodigo !== undefined
    )
      throw new TypeError(
        "Elegí un partido o el filtro territorial anterior, sin combinarlos.",
      );
  }
  for (const key of [
    "partidoVerificadoId",
    "gestionMunicipalId",
    "organizacionId",
  ] as const) {
    if (query[key] !== undefined) params.set(key, identifier(query[key]));
  }
  if (Boolean(query.periodoDesde) !== Boolean(query.periodoHasta))
    throw new TypeError("El período de vigencia requiere ambas fechas.");
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
     * Lee cobertura provincial/nacional sin filtros de obras y comprueba las particiones que JSON Schema no expresa.
     * @param fuentes - Hasta dos códigos del contrato; omitidos solicita ambas fuentes, sin sumar registros espaciales como obras.
     * @param requestOptions - Señal de cancelación, sin credenciales de administración.
     * @returns Inventario del mismo corte, con obras únicas separadas de los totales por fuente que pueden solaparse.
     * @throws ApiContractError Si falta una fuente solicitada o los conteos de ubicaciones, licencias o solapamiento son inconsistentes.
     */
    async sourceCoverage(
      fuentes?: readonly SourceCoverageCode[],
      requestOptions: RequestOptions = {},
    ): Promise<SourceCoverage> {
      const codes = fuentes ?? ["pba-edificios", "nacion-obras"];
      if (
        !Array.isArray(codes) ||
        codes.length < 1 ||
        codes.length > 2 ||
        codes.some(
          (code) => code !== "pba-edificios" && code !== "nacion-obras",
        )
      )
        throw new TypeError(
          "La cobertura admite hasta dos fuentes de Provincia o Nación.",
        );
      const expected = [...new Set(codes)].sort();
      const params = new URLSearchParams();
      if (fuentes) expected.forEach((code) => params.append("fuente", code));
      const coverage = await read<SourceCoverage>(
        "/obras/cobertura-fuentes" + (params.size ? "?" + params : ""),
        "PublicSourceCoverage",
        requestOptions,
      );
      const received = coverage.fuentes.map((source) => source.codigo).sort();
      const totalBySource = coverage.fuentes.reduce(
        (sum, source) => sum + source.obrasPublicadas,
        0,
      );
      if (
        received.join(",") !== expected.join(",") ||
        coverage.obrasCompartidasEntreFuentes >
          coverage.obrasPublicadasUnicas ||
        (received.length === 1 &&
          coverage.obrasCompartidasEntreFuentes !== 0) ||
        totalBySource !==
          coverage.obrasPublicadasUnicas +
            coverage.obrasCompartidasEntreFuentes ||
        coverage.fuentes.some(
          (source) =>
            source.obrasPublicadas > coverage.obrasPublicadasUnicas ||
            coverage.obrasCompartidasEntreFuentes > source.obrasPublicadas ||
            source.obrasPublicadas !==
              source.obrasConUbicacionAprobada +
                source.obrasSinUbicacionAprobada ||
            source.obrasPublicadas !==
              source.obrasConEvidenciaLicenciaPublicada +
                source.obrasSinEvidenciaLicenciaPublicada ||
            source.ubicacionesAprobadas < source.obrasConUbicacionAprobada ||
            source.recursos.length !==
              sourceDocumentResources[source.codigo].length ||
            sourceDocumentResources[source.codigo].some(
              (expected) =>
                !source.recursos.some(
                  (resource) =>
                    resource.rol === expected.rol &&
                    resource.unidadDocumental === expected.unidadDocumental,
                ),
            ),
        )
      )
        throw new ApiContractError(
          "El inventario de cobertura no es consistente con las fuentes solicitadas.",
        );
      return coverage;
    },
    /** Lee conteos por filtros sin limitar la población por bbox; verifica las particiones y el área solicitada antes de presentarlos. */
    async counts(
      query: Omit<ListQuery, "cursor" | "limit"> = {},
      requestOptions: RequestOptions = {},
    ): Promise<WorkCounts> {
      const params = queryParameters(query, 200, 20);
      params.delete("limit");
      params.delete("cursor");
      const counts = await read<WorkCounts>(
        "/obras/conteos?" + params,
        "PublicWorkCounts",
        requestOptions,
      );
      if (
        counts.totalPublicadas !==
          counts.totalConGeometria + counts.totalSinGeometria ||
        Boolean(counts.area) !== Boolean(query.bbox) ||
        (counts.area &&
          (counts.area.obrasEnMapa + counts.area.obrasFueraDelArea !==
            counts.totalConGeometria ||
            counts.area.bbox.join(",") !== query.bbox?.join(",")))
      )
        throw new ApiContractError(
          "Los conteos de obras no son consistentes con la consulta.",
        );
      return counts;
    },
    /** Lee publicaciones actuales y disponibilidad de geometría por fuente, sin filtros, ubicación candidata ni datos privados. */
    async municipalCoverage(
      requestOptions: RequestOptions = {},
    ): Promise<MunicipalCoverage> {
      const coverage = await read<MunicipalCoverage>(
        "/obras/cobertura-municipal",
        "PublicMunicipalCoverage",
        requestOptions,
      );
      if (
        new Set(coverage.fuentes.map((source) => source.codigo)).size !== 3 ||
        coverage.fuentes.some(
          (source) =>
            source.obrasPublicadas !==
            source.obrasConGeometria + source.obrasSinGeometria,
        )
      )
        throw new ApiContractError(
          "Los totales de cobertura municipal no son consistentes.",
        );
      return coverage;
    },
    /** Lee sólo identidades institucionales con roles verificados en revisiones actualmente publicadas, sin filtros de obras. */
    organizations(
      requestOptions: RequestOptions = {},
    ): Promise<InstitutionalOrganizationCatalog> {
      return read(
        "/organizaciones-institucionales",
        "PublicInstitutionalOrganizationCatalogResponse",
        requestOptions,
      );
    },
    /** Lee la nómina territorial independiente del catálogo de obras y de sus geometrías. */
    parties(requestOptions: RequestOptions = {}): Promise<PartyCatalog> {
      return read(
        "/territorios/pba/partidos",
        "PublicPartyCatalogResponse",
        requestOptions,
      );
    },
    /** Lee provincias y ciudades autónomas habilitadas sin filtros de obras ni provincia implícita. */
    provinces(requestOptions: RequestOptions = {}): Promise<ProvinceCatalog> {
      return read(
        "/territorios/provincias",
        "PublicProvinceCatalog",
        requestOptions,
      );
    },
    /** Lee el catálogo oficial de localidades sin afirmar cuántas tienen obras publicadas. */
    async localities(
      provinceCodes?: readonly string[],
      requestOptions: RequestOptions = {},
    ): Promise<LocalityCatalog> {
      const params = new URLSearchParams();
      if (provinceCodes !== undefined) {
        if (
          !Array.isArray(provinceCodes) ||
          provinceCodes.length < 1 ||
          provinceCodes.length > 24 ||
          provinceCodes.some((code) => !isKnownProvinceCode(code))
        )
          throw new TypeError(
            "La consulta de localidades requiere hasta 24 códigos INDEC provinciales.",
          );
        [...new Set(provinceCodes)]
          .sort()
          .forEach((code) => params.append("provinciaCodigo", code));
      }
      const catalog = await read<LocalityCatalog>(
        "/territorios/localidades" + (params.size ? "?" + params : ""),
        "PublicLocalityCatalog",
        requestOptions,
      );
      if (
        provinceCodes?.length &&
        catalog.items.some(
          (item) => !provinceCodes.includes(item.provinciaCodigo),
        )
      )
        throw new ApiContractError(
          "El catálogo de localidades no coincide con las provincias consultadas.",
        );
      return catalog;
    },
    /** Lee una distribución territorial explícitamente versionada sin incorporar filtros de obras. */
    boundaries(
      version: string,
      requestOptions: RequestOptions = {},
    ): Promise<PartyBoundaries> {
      if (!/^[a-z0-9][a-z0-9@._-]{0,127}$/.test(version))
        throw new TypeError("Versión de límites inválida.");
      return read(
        "/territorios/pba/partidos/limites?" + new URLSearchParams({ version }),
        "PublicPartyBoundaryFeatureCollection",
        requestOptions,
      );
    },
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
