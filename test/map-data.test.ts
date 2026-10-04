import { describe, expect, it } from "vitest";
import examples from "../contracts/examples.json" with { type: "json" };
import { parsePublicResponse } from "../src/api/contract.js";
import { clampMapBBox, partitionMapFeatures, selectedMapFeatures } from "../src/lib/map-data.js";
import type { WorkGeoJSON } from "../src/api/client.js";

const seed = parsePublicResponse<WorkGeoJSON>("PublicGeoFeatureCollection", examples.geojsonPopulated).features[0]!;
function feature(geometry: WorkGeoJSON["features"][number]["geometry"]): WorkGeoJSON["features"][number] {
  return { ...seed, geometry };
}

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

  it("limita el viewport visible a WGS84/Mercator sin cruzar el antimeridiano", () => {
    expect(clampMapBBox([-200, -90, 200, 90])).toEqual([-180, -85.051129, 180, 85.051129]);
    expect(clampMapBBox([-59, -35, -58, -34])).toEqual([-59, -35, -58, -34]);
    expect(clampMapBBox([170, -20, -170, 20])).toBeNull();
    expect(clampMapBBox([1, 2, 1, 3])).toBeNull();
    expect(clampMapBBox([0, 0, Number.POSITIVE_INFINITY, 2])).toBeNull();
  });
});
