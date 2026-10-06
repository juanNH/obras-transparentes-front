/** @file Servidor E2E sintético de sólo lectura; no conecta ni persiste datos en la API activa. */
// Isolated, read-only E2E server. Never connects to the backend or persists fixtures.
import { createServer } from "node:http";
import { Ajv } from "ajv";
import { fullFormats } from "ajv-formats/dist/formats.js";
import examples from "../contracts/examples.json" with { type: "json" };
import schemas from "../contracts/schemas.json" with { type: "json" };
import partyCatalog from "../test/fixtures/pba-parties.json" with { type: "json" };
import partyBoundaries from "../test/fixtures/pba-party-boundaries.json" with { type: "json" };

const port = Number(process.env.MOCK_API_PORT ?? 4100);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid mock API port");

const ajv = new Ajv({ allErrors: true, strict: false, formats: fullFormats });
ajv.addSchema({ $id: "fixture-contract", components: { schemas } });
/** Comprueba las respuestas sintéticas contra los esquemas públicos antes de servirlas en E2E. */
function validate(schema, value) {
  const check = ajv.getSchema(`fixture-contract#/components/schemas/${schema}`);
  if (!check(value)) throw new Error(`Invalid synthetic fixture ${schema}: ${ajv.errorsText(check.errors)}`);
  return value;
}
validate("PublicPartyCatalogResponse", partyCatalog);
validate("PublicPartyBoundaryFeatureCollection", partyBoundaries);
/** Genera UUID estables sintéticos por tipo y ordinal para que las pruebas puedan seleccionar revisiones exactas. */
const id = (prefix, index) => `${prefix}0000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const catalogoVersion = "7";
// Only the isolated fixture exposes this in-memory ledger. It records transport
// shape/size so SSR reads can be measured without observing an active backend.
const requests = [];
const details = new Map();
const features = [];
const institutionalParty = partyCatalog.items.find(party => party.codigos.indecDepartamento === "06861");
const institutionalOrganization = { id: id("5", 1), nombre: "EJEMPLO SINTÉTICO — Organización municipal revisada", nivel: "MUNICIPAL", partidoId: institutionalParty.partidoId };
const institutionalCatalog = { items: [institutionalOrganization] };
const items = Array.from({ length: 24 }, (_, index) => {
  const number = index + 1;
  const located = number % 4 !== 0;
  const obraId = id("1", number);
  const revisionId = id("2", number);
  const nombre = `EJEMPLO SINTÉTICO — Obra ${String(number).padStart(2, "0")}`;
  const estado = number % 3 === 0 ? "COMPLETED" : "IN_PROGRESS";
  const fuentes = [{ ...examples.listPopulated.items[0].fuentes[0], codigo: number % 3 === 0 ? "caba-actualizado" : "nacion-obras" }];
  const item = { ...structuredClone(examples.listPopulated.items[0]), obraId, revisionId, nombre, estado, fuentes, tieneGeometria: located };
  const detail = { ...structuredClone(located ? examples.detailPopulated : examples.detailPartial), obraId, revisionId, nombre, estado, fuentes, publicadaActualmente: true, catalogoVersion };
  item.asociacionesEspaciales = []; item.rolesInstitucionales = [];
  detail.asociacionesEspaciales = []; detail.rolesInstitucionales = [];
  const party = partyCatalog.items.find(party => party.codigos.indecDepartamento === (number <= 12 ? "06854" : "06861"));
  const reported = { esquema: "indec.departamento", codigo: party.codigos.indecDepartamento, nombre: party.nombre, condicion: "REPORTED" };
  item.territorios = [...item.territorios, reported];
  detail.territorios = [...detail.territorios, reported];
  if (located) {
    const feature = structuredClone(examples.geojsonPopulated.features[0]);
    feature.id = id("4", number);
    const longitude = -58.45 + index * 0.004;
    const latitude = -34.55 + index * 0.002;
    feature.geometry = number === 2
      ? { type: "LineString", coordinates: [[longitude - 0.0005, latitude], [longitude + 0.0005, latitude]] }
      : number === 3
        ? { type: "Polygon", coordinates: [[[longitude - 0.0004, latitude - 0.0004], [longitude + 0.0004, latitude - 0.0004], [longitude + 0.0004, latitude + 0.0004], [longitude - 0.0004, latitude + 0.0004], [longitude - 0.0004, latitude - 0.0004]]] }
        : { type: "Point", coordinates: [longitude, latitude] };
    feature.properties = { ...feature.properties, obraId, revisionId, nombre, estado, fuentes, ubicacionId: feature.id, asociacionesEspaciales: [], rolesInstitucionales: [] };
    if (number === 5) {
      // One address-derived synthetic observation exercises SSR and the public BFF.
      feature.properties.calidad = { ...feature.properties.calidad, origenGeometria: "ADDRESS_GEOCODE", crs: { codigo: "EPSG:4326", fundamento: "OFFICIAL_SERVICE", condicion: "SERVICE_REFERENCE" } };
    }
    features.push(feature);
    detail.ubicaciones = [{ ...detail.ubicaciones[0], geometria: feature.geometry, ubicacionId: feature.id, ...feature.properties.calidad }];
  }
  if (number === 3 || number === 4) {
    // These relationships are deliberately synthetic public review outcomes.
    // Their party differs from the reported party; no GeoRef visual boundary is used to infer them.
    detail.schemaVersion = "obra@3";
    const decisionId = id("6", number);
    detail.rolesInstitucionales = [{ organizacion: institutionalOrganization, rol: "FINANCIADOR", condicion: "VERIFIED", vigencia: { inicio: { valor: "2020", precision: "YEAR" }, fin: { valor: "2026-12-31", precision: "DAY" } }, evidencias: [{ tipo: "REVIEW_DECISION", campo: "rolesInstitucionales", decisionId }], decisionId }];
    if (located) detail.asociacionesEspaciales = [{ ubicacionClave: detail.ubicaciones[0].clave, partidoId: institutionalParty.partidoId, condicion: "VERIFIED", relacion: "CROSSING", evidencia: { geometriaSha256: "a".repeat(64), limitesVersion: "limites-sinteticos-verificacion@1", limitesSha256: "b".repeat(64), metodo: "POSTGIS_INTERSECTION", metodoVersion: "pba-spatial@1", decisionId } }];
    item.asociacionesEspaciales = structuredClone(detail.asociacionesEspaciales);
    item.rolesInstitucionales = structuredClone(detail.rolesInstitucionales);
    const represented = features.find(feature => feature.properties.obraId === obraId);
    if (represented) {
      represented.properties.asociacionesEspaciales = structuredClone(detail.asociacionesEspaciales);
      represented.properties.rolesInstitucionales = structuredClone(detail.rolesInstitucionales);
    }
  }
  details.set(obraId, validate("PublicWorkDetail", detail));
  return item;
});
validate("PublicWorkListResponse", { items, nextCursor: null, limit: 24, catalogoVersion });
validate("PublicGeoFeatureCollection", { type: "FeatureCollection", features, nextCursor: null, catalogoVersion });
validate("PublicInstitutionalOrganizationCatalogResponse", institutionalCatalog);

/** Aplica intersección por extensión de figuras sintéticas; no simula ni acredita las reglas topológicas PostGIS. */
function inArea(item, area) {
  if (!area) return true;
  const [west, south, east, north] = area;
  return features.some(feature => {
    if (feature.properties.obraId !== item.obraId) return false;
    const positions = [];
    /** Extrae posiciones de coordenadas anidadas para calcular extensión del fixture sintético. */
    const collect = coordinates => {
      if (typeof coordinates[0] === "number") positions.push(coordinates);
      else coordinates.forEach(collect);
    };
    collect(feature.geometry.coordinates);
    return Math.max(...positions.map(position => position[0])) >= west &&
      Math.min(...positions.map(position => position[0])) <= east &&
      Math.max(...positions.map(position => position[1])) >= south &&
      Math.min(...positions.map(position => position[1])) <= north;
  });
}
/** Aplica filtros admitidos al catálogo sintético conservando obras sin geometría cuando no hay área. */
function filtered(params) {
  const area = params.has("bbox") ? params.get("bbox").split(",").map(Number) : null;
  const party = params.has("partidoId") ? partyCatalog.items.find(party => party.partidoId === params.get("partidoId")) : null;
  return items.filter(item =>
    (!params.has("fuente") || item.fuentes.some(source => source.codigo === params.get("fuente"))) &&
    (!params.has("estado") || item.estado === params.get("estado")) &&
    (!params.has("sector") || item.clasificaciones.some(value => value.esquema === "sector" && value.codigo === params.get("sector"))) &&
    (!params.has("tieneGeometria") || item.tieneGeometria === (params.get("tieneGeometria") === "true")) &&
    (!params.has("municipioCodigo") || item.territorios.some(territory => territory.esquema === params.get("territorioEsquema") && territory.codigo === params.get("municipioCodigo"))) &&
    (!params.has("partidoId") || (party && item.territorios.some(territory => territory.esquema === "indec.departamento" && territory.codigo === party.codigos.indecDepartamento && territory.condicion === "REPORTED"))) &&
    (!params.has("partidoVerificadoId") || item.asociacionesEspaciales.some(association => association.partidoId === params.get("partidoVerificadoId"))) &&
    (["gestionMunicipalId", "organizacionId", "rolInstitucional", "periodoDesde", "periodoHasta"].every(key => !params.has(key)) || item.rolesInstitucionales.some(role => {
      const start = role.vigencia.inicio?.precision === "YEAR" ? role.vigencia.inicio.valor + "-01-01" : role.vigencia.inicio?.valor;
      const end = role.vigencia.fin?.precision === "YEAR" ? role.vigencia.fin.valor + "-12-31" : role.vigencia.fin?.valor;
      return (!params.has("gestionMunicipalId") || (role.organizacion.nivel === "MUNICIPAL" && role.organizacion.partidoId === params.get("gestionMunicipalId") && role.rol !== "CONTRATISTA")) &&
        (!params.has("organizacionId") || role.organizacion.id === params.get("organizacionId")) &&
        (!params.has("rolInstitucional") || role.rol === params.get("rolInstitucional")) &&
        (!params.has("periodoDesde") || (end && end >= params.get("periodoDesde"))) &&
        (!params.has("periodoHasta") || (start && start <= params.get("periodoHasta")));
    })) &&
    inArea(item, area),
  );
}
/** Pagina fixtures por cursor sintético con límite acotado, sin persistir estado. */
function pageOf(values, params, defaultLimit) {
  const limit = Math.min(500, Math.max(1, Number(params.get("limit") || defaultLimit)));
  const cursor = params.get("cursor");
  const offset = cursor?.startsWith("fixture-offset-") ? Number(cursor.slice("fixture-offset-".length)) : 0;
  const page = values.slice(offset, offset + limit);
  return { page, limit, nextCursor: offset + limit < values.length ? `fixture-offset-${offset + limit}` : null };
}
const server = createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  const entry = url.pathname.startsWith("/api/v1/")
    ? { sequence: requests.length + 1, path: url.pathname, query: Object.fromEntries(url.searchParams) }
    : null;
  if (entry) requests.push(entry);
  /** Entrega JSON sin caché al consumidor E2E con el estado indicado. */
  const send = (status, value) => {
    const json = JSON.stringify(value);
    if (entry) { entry.status = status; entry.responseBytes = Buffer.byteLength(json); }
    response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(json);
  };
  if (request.method !== "GET") return send(405, { error: { code: "METHOD_NOT_ALLOWED", message: "Read-only fixture server", requestId: null } });
  if (url.pathname === "/__health") return send(200, { fixture: "synthetic-e2e-only" });
  if (url.pathname === "/__requests") return send(200, { fixture: "synthetic-e2e-only", requests });
  if (url.pathname === "/api/v1/organizaciones-institucionales") {
    if (url.searchParams.size) return send(422, { error: { code: "VALIDATION_FAILED", message: "Synthetic institutional catalog has no query parameters", requestId: null } });
    return send(200, institutionalCatalog);
  }
  if (url.pathname === "/api/v1/territorios/pba/partidos") {
    if (url.searchParams.size) return send(422, { error: { code: "VALIDATION_FAILED", message: "Synthetic party catalog has no query parameters", requestId: null } });
    return send(200, partyCatalog);
  }
  if (url.pathname === "/api/v1/territorios/pba/partidos/limites") {
    if (url.searchParams.get("version") !== partyBoundaries.metadata.version) return send(404, { error: { code: "BOUNDARY_VERSION_NOT_FOUND", message: "Fixture boundary version not found", requestId: null } });
    return send(200, partyBoundaries);
  }
  if (url.pathname === "/api/v1/obras") {
    const { page, limit, nextCursor } = pageOf(filtered(url.searchParams), url.searchParams, 20);
    return send(200, { items: page, limit, nextCursor, catalogoVersion });
  }
  if (url.pathname === "/api/v1/obras/geojson") {
    const allowed = new Set(filtered(url.searchParams).map(item => item.obraId));
    const { page, nextCursor } = pageOf(features.filter(feature => allowed.has(feature.properties.obraId)), url.searchParams, 100);
    return send(200, { type: "FeatureCollection", features: page, nextCursor, catalogoVersion });
  }
  const match = url.pathname.match(/^\/api\/v1\/obras\/([a-f0-9-]+)$/);
  if (match) {
    const detail = details.get(match[1]);
    if (detail && (!url.searchParams.has("revisionId") || url.searchParams.get("revisionId") === detail.revisionId)) return send(200, detail);
  }
  return send(404, { error: { code: "NOT_FOUND", message: "Synthetic publication not found", requestId: null } });
});
server.listen(port, "127.0.0.1", () => console.log(`Isolated synthetic public API: http://127.0.0.1:${port}`));
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.close(() => process.exit(0)));
