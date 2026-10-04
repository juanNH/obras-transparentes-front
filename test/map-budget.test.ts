import { describe, expect, it } from "vitest";
import examples from "../contracts/examples.json" with { type: "json" };
import type { WorkGeoJSON } from "../src/api/client.js";
import { parsePublicResponse } from "../src/api/contract.js";
import { limitMapFeatures, MAX_MAP_FEATURES, MAX_MAP_POSITIONS } from "../src/lib/map-budget.js";

const seed = parsePublicResponse<WorkGeoJSON>("PublicGeoFeatureCollection", examples.geojsonPopulated).features[0]!;
const point = [-58, -34];
const ring = [[-58, -34], [-59, -34], [-59, -35], [-58, -34]];
const feature = (geometry: typeof seed.geometry): typeof seed => ({ ...seed, geometry });

describe("presupuesto del mapa por posiciones", () => {
  it("cuenta tuplas de los seis tipos, incluidos todos los anillos y polígonos", () => {
    const input = [
      feature({ type: "Point", coordinates: point }),
      feature({ type: "MultiPoint", coordinates: [point, point] }),
      feature({ type: "LineString", coordinates: [point, point, point] }),
      feature({ type: "MultiLineString", coordinates: [[point, point], [point, point]] }),
      feature({ type: "Polygon", coordinates: [ring, ring] }),
      feature({ type: "MultiPolygon", coordinates: [[ring, ring], [ring]] }),
    ];
    const result = limitMapFeatures(input);
    expect(result.positions).toBe(30);
    expect(result.truncated).toBe(false);
    input.forEach((item, index) => expect(result.features[index]).toBe(item));
  });
  it("omite una geometría enorme completa sin impedir una ubicación posterior pequeña", () => {
    const oversized = feature({ type: "MultiPoint", coordinates: Array.from({ length: MAX_MAP_POSITIONS + 1 }, () => point) });
    const small = feature({ type: "Point", coordinates: point });
    const result = limitMapFeatures([oversized, small]);
    expect(result).toEqual({ features: [small], truncated: true, positions: 1 });
    expect(oversized.geometry.coordinates).toHaveLength(MAX_MAP_POSITIONS + 1);
  });
  it("no corta polígonos al superar el presupuesto acumulado", () => {
    const first = feature({ type: "MultiPoint", coordinates: Array.from({ length: MAX_MAP_POSITIONS - 3 }, () => point) });
    const polygon = feature({ type: "MultiPolygon", coordinates: [[ring]] });
    const final = feature({ type: "Point", coordinates: point });
    const result = limitMapFeatures([first, polygon, final]);
    expect(result.features).toEqual([first, final]);
    expect(result.positions).toBe(MAX_MAP_POSITIONS - 2);
    expect(result.truncated).toBe(true);
    expect(polygon.geometry.coordinates).toEqual([[ring]]);
  });
  it("acepta el límite exacto y aplica también el máximo de ubicaciones", () => {
    const exact = feature({ type: "MultiPoint", coordinates: Array.from({ length: MAX_MAP_POSITIONS }, () => point) });
    expect(limitMapFeatures([exact])).toEqual({ features: [exact], truncated: false, positions: MAX_MAP_POSITIONS });
    const many = Array.from({ length: MAX_MAP_FEATURES + 1 }, () => feature({ type: "Point", coordinates: point }));
    const result = limitMapFeatures(many);
    expect(result.features).toHaveLength(MAX_MAP_FEATURES);
    expect(result.positions).toBe(MAX_MAP_FEATURES);
    expect(result.truncated).toBe(true);
    expect(limitMapFeatures(many.slice(0, MAX_MAP_FEATURES)).truncated).toBe(false);
    expect(limitMapFeatures([])).toEqual({ features: [], truncated: false, positions: 0 });
  });
});
