/** @file Comprueba geometrías aceptadas, partición real de puntos/figuras y selección exacta por revisión/ubicación. */
import { describe, expect, it } from "vitest";
import examples from "../contracts/examples.json" with { type: "json" };
import { parsePublicResponse } from "../src/api/contract.js";
import { clampMapBBox, detailMapFeatures, partitionMapFeatures, selectedMapFeatures } from "../src/lib/map-data.js";
import { mapOriginCategory } from "../src/lib/map-origin.js";
import type { WorkDetail, WorkGeoJSON } from "../src/api/client.js";

const seed = parsePublicResponse<WorkGeoJSON>("PublicGeoFeatureCollection", examples.geojsonPopulated).features[0]!;
const detailSeed = parsePublicResponse<WorkDetail>("PublicWorkDetail", examples.detailPopulated);
type ApprovedLocation = Extract<WorkDetail["ubicaciones"][number], { condicion: "ACCEPTED" }>;
const approved = detailSeed.ubicaciones.find((location): location is ApprovedLocation => location.condicion === "ACCEPTED")!;
function feature(geometry: WorkGeoJSON["features"][number]["geometry"]): WorkGeoJSON["features"][number] {
  return { ...seed, geometry };
}

describe("ubicaciones de la revisión pública seleccionada", () => {
  const geometries: WorkGeoJSON["features"][number]["geometry"][] = [
    { type: "Point", coordinates: [-58, -34] },
    { type: "MultiPoint", coordinates: [[-58, -34], [-59, -35]] },
    { type: "LineString", coordinates: [[-58, -34], [-59, -35]] },
    { type: "MultiLineString", coordinates: [[[-58, -34], [-59, -35]]] },
    { type: "Polygon", coordinates: [[[-58, -34], [-59, -34], [-59, -35], [-58, -34]]] },
    { type: "MultiPolygon", coordinates: [[[[-58, -34], [-59, -34], [-59, -35], [-58, -34]]]] },
  ];

  it.each(geometries)("conserva la geometría $type aprobada completa y conforme al contrato", geometry => {
    const work: WorkDetail = { ...detailSeed, ubicaciones: [{ ...approved, geometria: geometry }] };
    const features = detailMapFeatures(work);
    expect(features).toHaveLength(1);
    expect(features[0]!.geometry).toBe(geometry);
    expect(features[0]!.id).toBe(approved.ubicacionId);
    expect(features[0]!.properties.ubicacionId).toBe(approved.ubicacionId);
    expect(features[0]!.properties.calidad).toEqual({
      condicion: "ACCEPTED", controles: approved.controles, crs: approved.crs, precision: approved.precision,
    });
    expect(() => parsePublicResponse("PublicGeoFeatureCollection", {
      type: "FeatureCollection", features, nextCursor: null, catalogoVersion: work.catalogoVersion,
    })).not.toThrow();
  });

  it("mantiene la identidad de la revisión pedida incluso cuando es histórica", () => {
    const work: WorkDetail = { ...detailSeed, revisionId: "20000000-0000-4000-8000-000000000099", publicadaActualmente: false };
    const result = detailMapFeatures(work)[0]!;
    expect(result.properties).toMatchObject({
      obraId: work.obraId, revisionId: work.revisionId, nombre: work.nombre, estado: work.estado,
      fuentes: work.fuentes, clasificaciones: work.clasificaciones,
    });
    expect(work.ubicaciones).toEqual(detailSeed.ubicaciones);
  });

  it("no representa ubicaciones omitidas, pendientes ni inválidas", () => {
    const ubicaciones: WorkDetail["ubicaciones"] = (["PENDING_REVIEW", "OMITTED", "INVALID"] as const).map(condicion => ({
      ...approved, condicion, geometria: null, ubicacionId: null,
    }));
    expect(detailMapFeatures({ ...detailSeed, ubicaciones })).toEqual([]);
    expect(detailMapFeatures({ ...detailSeed, ubicaciones: [] })).toEqual([]);
  });

  it("conserva varias ubicaciones reales sin duplicar una misma ubicación", () => {
    const other = { ...approved, clave: "otra-ubicacion", ubicacionId: "40000000-0000-4000-8000-000000000099" };
    const work: WorkDetail = { ...detailSeed, ubicaciones: [approved, other, approved] };
    expect(detailMapFeatures(work).map(item => item.id)).toEqual([approved.ubicacionId, other.ubicacionId]);
    expect(work.ubicaciones).toHaveLength(3);
  });

  it("lleva el origen de domicilio geocodificado desde la ficha hasta la calidad del mapa", () => {
    const derived: ApprovedLocation = {
      ...approved, clave: "domicilio", origenGeometria: "ADDRESS_GEOCODE",
      ubicacionId: "40000000-0000-4000-8000-000000000088",
      crs: { codigo: "EPSG:4326", fundamento: "OFFICIAL_SERVICE", condicion: "SERVICE_REFERENCE" },
      precision: "coordenada_reportada_sin_precision",
    };
    const work: WorkDetail = { ...detailSeed, ubicaciones: [approved, derived] };
    const input = structuredClone(work);
    const features = detailMapFeatures(work);
    expect(features[1]!.properties.calidad).toEqual({
      condicion: "ACCEPTED", controles: derived.controles, crs: derived.crs,
      precision: derived.precision, origenGeometria: "ADDRESS_GEOCODE",
    });
    expect(features[0]!.properties.calidad.origenGeometria).toBeUndefined();
    expect(parsePublicResponse("PublicGeoFeatureCollection", { type: "FeatureCollection", features, nextCursor: null, catalogoVersion: work.catalogoVersion })).toMatchObject({ features });
    expect(work).toEqual(input);
  });
});

describe("datos del mapa móvil", () => {
  it("agrupa Point/MultiPoint conservando las coordenadas y la identidad de obra/revisión", () => {
    const data = partitionMapFeatures([
      feature({ type: "Point", coordinates: [-58, -34] }),
      feature({ type: "MultiPoint", coordinates: [[-58.1, -34.2], [-58.2, -34.3]] }),
    ]);
    expect(data.points.features.map((point) => point.geometry.coordinates)).toEqual([[-58, -34], [-58.1, -34.2], [-58.2, -34.3]]);
    expect(data.points.features.every((point) => point.properties.obraId === seed.properties.obraId && point.properties.revisionId === seed.properties.revisionId)).toBe(true);
    expect(data.shapes.features).toEqual([]);
    expect(data.all.features).toHaveLength(2);
  });

  it("conserva las líneas y polígonos completos, sin convertirlos en centroides", () => {
    const geometries: WorkGeoJSON["features"][number]["geometry"][] = [
      { type: "LineString", coordinates: [[-58, -34], [-59, -35]] },
      { type: "MultiLineString", coordinates: [[[-58, -34], [-59, -35]]] },
      { type: "Polygon", coordinates: [[[-58, -34], [-59, -34], [-59, -35], [-58, -34]]] },
      { type: "MultiPolygon", coordinates: [[[[-58, -34], [-59, -34], [-59, -35], [-58, -34]]]] },
    ];
    const data = partitionMapFeatures(geometries.map(feature));
    expect(data.points.features).toEqual([]);
    expect(data.shapes.features.map((shape) => shape.geometry)).toEqual(geometries);
  });

  it("selecciona todas las ubicaciones de una obra incluso si uno de sus puntos está agrupado", () => {
    const first = feature({ type: "Point", coordinates: [-58, -34] });
    const second = feature({ type: "MultiPoint", coordinates: [[-58, -34], [-59, -35]] });
    const other = { ...first, properties: { ...first.properties, obraId: "otra-obra" } };
    const data = partitionMapFeatures([first, second, other]);
    expect(selectedMapFeatures(data.all, first.properties.obraId).features).toHaveLength(2);
    expect(selectedMapFeatures(data.all, null).features).toEqual([]);
  });

  it("conserva las fuentes públicas y su categoría para estilizar la geometría", () => {
    const featureData = { ...seed, properties: { ...seed.properties, fuentes: [{ ...seed.properties.fuentes[0]!, codigo: "caba-actualizado" as const }] } };
    const mapped = partitionMapFeatures([featureData]).all.features[0]!;
    expect(mapped.properties.fuentes).toEqual(featureData.properties.fuentes);
    expect(mapped.properties.nivelFuente).toBe(mapOriginCategory(featureData.properties.fuentes));
    expect(mapped.properties.nivelFuente).toBe("caba");
  });

  it("limita el viewport visible a WGS84/Mercator sin cruzar el antimeridiano", () => {
    expect(clampMapBBox([-200, -90, 200, 90])).toEqual([-180, -85.051129, 180, 85.051129]);
    expect(clampMapBBox([-59, -35, -58, -34])).toEqual([-59, -35, -58, -34]);
    expect(clampMapBBox([170, -20, -170, 20])).toBeNull();
    expect(clampMapBBox([1, 2, 1, 3])).toBeNull();
    expect(clampMapBBox([0, 0, Number.POSITIVE_INFINITY, 2])).toBeNull();
  });
});
