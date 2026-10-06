/** @file Comprueba serialización, validación de contrato y errores de transporte del cliente público. */
import { describe, expect, it, vi } from "vitest";
import examples from "../contracts/examples.json" with { type: "json" };
import {
  createPublicApi,
  PublicApiError,
  assertSameCatalog,
  serializeBBox,
} from "../src/api/client.js";
import { ApiContractError, parsePublicResponse } from "../src/api/contract.js";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const mockedFetch = (body: unknown, status = 200) =>
  vi.fn<typeof fetch>().mockResolvedValue(json(body, status));

describe("Contrato público del consumidor", () => {
  it("acepta origen ADDRESS_GEOCODE con referencia de servicio y conserva la precisión de origen", () => {
    const detail = structuredClone(examples.detailPopulated);
    const location = { ...detail.ubicaciones[0]!, origenGeometria: "ADDRESS_GEOCODE", crs: { codigo: "EPSG:4326", fundamento: "OFFICIAL_SERVICE", condicion: "SERVICE_REFERENCE" } };
    const publicDetail = { ...detail, ubicaciones: [location] };
    expect(parsePublicResponse("PublicWorkDetail", publicDetail)).toEqual(publicDetail);
    const collection = structuredClone(examples.geojsonPopulated);
    const feature = collection.features[0]!;
    const quality = { ...feature.properties.calidad, origenGeometria: "ADDRESS_GEOCODE", crs: location.crs };
    const publicMap = { ...collection, features: [{ ...feature, properties: { ...feature.properties, calidad: quality } }] };
    expect(parsePublicResponse("PublicGeoFeatureCollection", publicMap)).toEqual(publicMap);
    expect(location.precision).toBe(detail.ubicaciones[0]!.precision);
    expect(quality.precision).toBe(feature.properties.calidad.precision);
  });

  it("rechaza informes privados de geocodificación en ubicación pública y calidad GeoJSON", () => {
    const detail = structuredClone(examples.detailPopulated);
    const location = detail.ubicaciones[0]!;
    const collection = structuredClone(examples.geojsonPopulated);
    const feature = collection.features[0]!;
    for (const privateField of ["geocodificacionDireccion", "corroboracionCrs"]) {
      const privateReport = { estado: "COMPATIBLE", evidencias: [{ respuesta: { informacion: "EJEMPLO SINTÉTICO PRIVADO" } }] };
      expect(() => parsePublicResponse("PublicWorkDetail", { ...detail, ubicaciones: [{ ...location, [privateField]: privateReport }] })).toThrow(ApiContractError);
      expect(() => parsePublicResponse("PublicGeoFeatureCollection", { ...collection, features: [{ ...feature, properties: { ...feature.properties, calidad: { ...feature.properties.calidad, [privateField]: privateReport } } }] })).toThrow(ApiContractError);
    }
  });

  it("conserva los rangos posicionales de longitud y latitud", () => {
    const value = structuredClone(examples.geojsonPopulated);
    value.features[0]!.geometry = { type: "Point", coordinates: [0, 100] };
    expect(() =>
      parsePublicResponse("PublicGeoFeatureCollection", value),
    ).toThrow(ApiContractError);
    value.features[0]!.geometry = { type: "Point", coordinates: [181, 0] };
    expect(() =>
      parsePublicResponse("PublicGeoFeatureCollection", value),
    ).toThrow(ApiContractError);
  });
  it.each([
    ["PublicWorkListResponse", "listPopulated"],
    ["PublicWorkListResponse", "listEmpty"],
    ["PublicWorkDetail", "detailPopulated"],
    ["PublicWorkDetail", "detailPartial"],
    ["PublicGeoFeatureCollection", "geojsonPopulated"],
    ["PublicGeoFeatureCollection", "geojsonEmpty"],
    ["PublicApiError", "errorCatalogChanged"],
    ["PublicApiError", "errorValidation"],
    ["PublicApiError", "errorNotFound"],
    ["PublicApiError", "errorBroadBbox"],
  ])("acepta ejemplo sintético %s / %s", (schema, key) => {
    const value = examples[key as keyof typeof examples];
    expect(parsePublicResponse(schema, value)).toEqual(value);
  });

  it("rechaza un detalle incompatible en lugar de presentar una ficha incorrecta", () => {
    const value = structuredClone(examples.detailPopulated);
    value.avanceFisico = "101";
    expect(() => parsePublicResponse("PublicWorkDetail", value)).toThrow(
      ApiContractError,
    );
    expect(() =>
      parsePublicResponse("PublicWorkDetail", {
        ...examples.detailPopulated,
        candidata: { type: "Point", coordinates: [0, 0] },
      }),
    ).toThrow(ApiContractError);
  });

  it("no acepta null como cero ni una versión de catálogo numérica", () => {
    expect(() =>
      parsePublicResponse("PublicWorkListResponse", {
        ...examples.listEmpty,
        catalogoVersion: 0,
      }),
    ).toThrow(ApiContractError);
    const value = structuredClone(examples.detailPartial);
    expect(parsePublicResponse("PublicWorkDetail", value)).toEqual(value);
  });

  it("rechaza geometría pública no aprobada y referencias CRS contradictorias", () => {
    const detail = examples.detailPopulated;
    const location = detail.ubicaciones[0]!;
    for (const invalid of [
      { ...location, condicion: "PENDING_REVIEW" },
      { ...location, geometria: null },
      { ...location, ubicacionId: null },
      {
        ...location,
        crs: { ...location.crs, condicion: "REPORTED_REFERENCE" },
      },
    ]) {
      expect(() =>
        parsePublicResponse("PublicWorkDetail", {
          ...detail,
          ubicaciones: [invalid],
        }),
      ).toThrow(ApiContractError);
    }
  });
});

describe("Cliente público", () => {
  it("serializa asociaciones y vigencia del rol iguales para lista y mapa sin parámetros de UI", async () => {
    const request = mockedFetch(examples.listEmpty);
    const api = createPublicApi({ fetch: request });
    const filters = { partidoVerificadoId: "AAAAAAAA-0000-4000-8000-000000000001", gestionMunicipalId: "bbbbbbbb-0000-4000-8000-000000000001", organizacionId: "cccccccc-0000-4000-8000-000000000001", rolInstitucional: "FINANCIADOR", periodoDesde: "2020-01-01", periodoHasta: "2026-12-31" } as const;
    await api.list(filters);
    const list = new URL(String(request.mock.calls[0]![0]), "http://127.0.0.1").searchParams;
    request.mockResolvedValue(json(examples.geojsonEmpty));
    await api.geojson({ ...filters, bbox: [-59, -35, -58, -34] });
    const map = new URL(String(request.mock.calls[1]![0]), "http://127.0.0.1").searchParams;
    for (const key of Object.keys(filters)) expect(map.get(key)).toBe(list.get(key));
    expect(list.get("partidoVerificadoId")).toBe(filters.partidoVerificadoId.toLowerCase());
    expect(map.get("bbox")).toBe("-59,-35,-58,-34");
  });
  it("conserva cancelaciones y fallas de lectura después de recibir cabeceras", async () => {
    for (const error of [
      new DOMException("Cancelado", "AbortError"),
      new TypeError("Falla de lectura"),
    ]) {
      const body = new ReadableStream({
        start(controller) {
          controller.error(error);
        },
      });
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(body));
      await expect(createPublicApi({ fetch: request }).list()).rejects.toBe(
        error,
      );
    }
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("<html>"));
    await expect(
      createPublicApi({ fetch: request }).list(),
    ).rejects.toBeInstanceOf(ApiContractError);
  });
  it("serializa área y códigos textuales sin trasladar parámetros de la interfaz", async () => {
    const request = mockedFetch(examples.listEmpty);
    const api = createPublicApi({ fetch: request });
    await api.list({
      bbox: [-59, -35, -58, -34],
      territorioEsquema: "pba.municipio",
      municipioCodigo: "001",
      tieneGeometria: true,
      ...{ vista: "mapa", zoom: 12 },
    });
    const [url, init] = request.mock.calls[0]!;
    const query = new URL(String(url), "http://127.0.0.1").searchParams;
    expect(query.get("municipioCodigo")).toBe("001");
    expect(query.get("bbox")).toBe("-59,-35,-58,-34");
    expect(query.get("tieneGeometria")).toBe("true");
    expect(query.get("limit")).toBe("20");
    expect(query.has("vista")).toBe(false);
    expect(query.has("zoom")).toBe(false);
    expect(init?.credentials).toBe("omit");
  });

  it("abre la revisión de la tarjeta con cancelación proporcionada por el consumidor", async () => {
    const request = mockedFetch(examples.detailPopulated);
    const controller = new AbortController();
    const api = createPublicApi({
      baseUrl: "http://127.0.0.1:3000/api/v1",
      fetch: request,
    });
    const detail = examples.detailPopulated;
    await api.detail(detail.obraId, detail.revisionId, {
      signal: controller.signal,
    });
    expect(String(request.mock.calls[0]![0])).toContain(
      `?revisionId=${detail.revisionId}`,
    );
    expect(request.mock.calls[0]![1]?.signal).toBe(controller.signal);
  });

  it("rechaza consultas inválidas antes de pedir datos", () => {
    const request = mockedFetch(examples.listEmpty);
    const api = createPublicApi({ fetch: request });
    expect(() => api.list({ limit: 201 })).toThrow(TypeError);
    expect(() => api.list({ municipioCodigo: "001" })).toThrow(TypeError);
    expect(() => serializeBBox([179, -10, -179, 10])).toThrow(TypeError);
    expect(() => serializeBBox([0, 0, Infinity, 1])).toThrow(TypeError);
    expect(() => api.detail("../admin")).toThrow(TypeError);
    expect(request).not.toHaveBeenCalled();
  });

  it("expone cambio de catálogo sin reintentos que mezclen páginas", async () => {
    const request = mockedFetch(examples.errorCatalogChanged, 409);
    const api = createPublicApi({ fetch: request });
    const error = await api
      .list({ cursor: "opaque-cursor" })
      .catch((error) => error as PublicApiError);
    expect(error).toBeInstanceOf(PublicApiError);
    expect((error as PublicApiError).requiresPaginationRestart).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    expect(() =>
      assertSameCatalog(
        { catalogoVersion: "9007199254740993" },
        { catalogoVersion: "9007199254740994" },
      ),
    ).toThrow(PublicApiError);
    expect(() =>
      assertSameCatalog(
        { catalogoVersion: "9007199254740993" },
        { catalogoVersion: "9007199254740993" },
      ),
    ).not.toThrow();
  });

  it("distingue datos inválidos de HTTP y de red/cancelación", async () => {
    await expect(
      createPublicApi({ fetch: mockedFetch({ items: [] }) }).list(),
    ).rejects.toBeInstanceOf(ApiContractError);
    await expect(
      createPublicApi({
        fetch: mockedFetch(examples.errorNotFound, 404),
      }).detail(examples.detailPopulated.obraId),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    const aborted = new DOMException("Cancelado", "AbortError");
    const request = vi.fn<typeof fetch>().mockRejectedValue(aborted);
    await expect(createPublicApi({ fetch: request }).list()).rejects.toBe(
      aborted,
    );
  });
});
