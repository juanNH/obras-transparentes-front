/** @file Pasarela GET de mismo origen para rutas públicas admitidas; valida consultas y oculta detalles internos. */
import { PublicApiError } from "../../../../api/client";
import { parseExplorerQuery, isUUID } from "../../../../lib/explorer-query";
import { publicApi } from "../../../../lib/public-api";

/** Evita caché de rutas BFF para consultar la versión vigente del catálogo. */
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const allowed = new Set(["fuente", "estado", "sector", "provinciaCodigo", "partidos", "territorioEsquema", "municipioCodigo", "partidoId", "partidoVerificadoId", "gestionMunicipalId", "organizacionId", "rolInstitucional", "periodoDesde", "periodoHasta", "tieneGeometria", "bbox", "cursor"]);
/**
 * Acepta lista, GeoJSON, ficha y catálogos públicos de provincias/partidos/instituciones; los catálogos no admiten filtros y usan presupuestos independientes.
 * @param request - GET de mismo origen; su señal cancela la lectura upstream.
 * @param params - Segmentos de la ruta pública resueltos por App Router.
 * @returns JSON validado sin caché o un error público que no revela URLs internas.
 */
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path;
  const url = new URL(request.url);
  let validated = false;
  try {
    const api = publicApi();
    let result: unknown;
    if (path.length === 2 && path.join("/") === "territorios/provincias") {
      if (url.searchParams.size) throw new TypeError("El catálogo provincial no recibe filtros de obras.");
      validated = true;
      result = await api.provinces({ signal: request.signal });
    } else if (path.length === 1 && path[0] === "organizaciones-institucionales") {
      if (url.searchParams.size) throw new TypeError("El catálogo institucional no recibe filtros de obras.");
      validated = true;
      result = await api.organizations({ signal: request.signal });
    } else if (path.length === 4 && path.join("/") === "territorios/pba/partidos/limites") {
      const version = url.searchParams.get("version");
      if ([...url.searchParams.keys()].some(key => key !== "version") || url.searchParams.getAll("version").length !== 1 || !version || !/^[a-z0-9][a-z0-9@._-]{0,127}$/.test(version))
        throw new TypeError("Los límites requieren una versión y no reciben filtros de obras.");
      validated = true;
      const boundaries = await api.boundaries(version, { signal: request.signal });
      if (boundaries.metadata.version !== version) throw new TypeError("La versión territorial recibida no coincide.");
      result = boundaries;
    } else if (path.length === 3 && path.join("/") === "territorios/pba/partidos") {
      if (url.searchParams.size) throw new TypeError("La nómina no recibe filtros de obras.");
      validated = true;
      result = await api.parties({ signal: request.signal });
    } else if (path.length === 2 && path[0] === "obras" && path[1] && isUUID(path[1])) {
      if ([...url.searchParams.keys()].some(key => key !== "revisionId") || url.searchParams.getAll("revisionId").length > 1) throw new TypeError("Parámetro de ficha inválido.");
      const revision = url.searchParams.get("revisionId") || undefined;
      if (revision && !isUUID(revision)) throw new TypeError("Revisión inválida.");
      validated = true;
      result = await api.detail(path[1], revision, { signal: request.signal });
    } else if (path.length === 1 && ["obras", "geojson"].includes(path[0] ?? "")) {
      if ([...url.searchParams.keys()].some(key => !allowed.has(key))) throw new TypeError("Filtro desconocido.");
      const { query } = parseExplorerQuery(url.searchParams);
      if (path[0] === "geojson") {
        if (!query.bbox) throw new TypeError("La consulta de mapa requiere área.");
        validated = true;
        result = await api.geojson({ ...query, bbox: query.bbox, limit: 100 }, { signal: request.signal });
      } else { validated = true; result = await api.list(query, { signal: request.signal }); }
    } else return Response.json({ error: { code: "NOT_FOUND", message: "Ruta pública inexistente." } }, { status: 404, headers });
    return Response.json(result, { headers });
  } catch (error) {
    const status = error instanceof PublicApiError ? error.status : !validated && error instanceof TypeError ? 400 : 503;
    const code = error instanceof PublicApiError ? error.code : status === 400 ? "INVALID_QUERY" : "UNAVAILABLE";
    // Do not expose internal addresses or upstream diagnostic payloads.
    const message = code === "CATALOG_CHANGED" ? "El catálogo cambió. Reiniciá la consulta." : code === "RESPONSE_BUDGET" ? path[0] === "organizaciones-institucionales" ? "No se pudo cargar el catálogo institucional dentro del límite de lectura." : path[0] === "territorios" ? "No se pudo cargar la referencia territorial dentro del límite de lectura." : "Esta zona contiene demasiados datos. Acercá el mapa o ajustá los filtros." : status === 400 ? "Revisá los filtros del enlace." : status === 404 ? "No encontramos esa publicación." : "El catálogo no está disponible en este momento. Intentá nuevamente.";
    return Response.json({ error: { code, message } }, { status, headers });
  }
}
