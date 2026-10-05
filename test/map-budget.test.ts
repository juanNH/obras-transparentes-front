import { describe, expect, it } from "vitest";
import examples from "../contracts/examples.json" with { type: "json" };
import type { WorkGeoJSON } from "../src/api/client.js";
import { parsePublicResponse } from "../src/api/contract.js";
import { limitMapFeatures, limitMapLayers, MAX_MAP_FEATURES, MAX_MAP_POSITIONS } from "../src/lib/map-budget.js";

const seed = parsePublicResponse<WorkGeoJSON>("PublicGeoFeatureCollection", examples.geojsonPopulated).features[0]!;
const point = [-58, -34];
const ring = [[-58, -34], [-59, -34], [-59, -35], [-58, -34]];
const feature = (geometry: typeof seed.geometry): typeof seed => ({ ...seed, geometry });
const locatedFeature = (
  geometry: typeof seed.geometry,
  ubicacionId: string,
  revisionId = seed.properties.revisionId,
  obraId = seed.properties.obraId,
): typeof seed => ({
  ...feature(geometry),
  id: ubicacionId,
  properties: { ...seed.properties, ubicacionId, revisionId, obraId },
});

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

describe("presupuesto compartido entre catálogo y selección", () => {
  it("reserva posiciones para la selección y omite ubicaciones completas al superar el total", () => {
    const large = locatedFeature({ type: "MultiPoint", coordinates: Array.from({ length: MAX_MAP_POSITIONS - 1 }, () => point) }, "large");
    const tail = locatedFeature({ type: "Point", coordinates: point }, "tail");
    const selected = locatedFeature({ type: "Point", coordinates: [-64, -31] }, "selected");
    const result = limitMapLayers([large, tail], [selected]);
    expect(result).toEqual({ catalog: [large], selection: [selected], truncated: true, positions: MAX_MAP_POSITIONS });
    expect(result.catalog[0]).toBe(large);
    expect(result.selection[0]).toBe(selected);
    const exact = locatedFeature({ type: "MultiPoint", coordinates: Array.from({ length: MAX_MAP_POSITIONS }, () => point) }, "exact");
    expect(limitMapLayers([exact], [selected])).toEqual({ catalog: [], selection: [selected], truncated: true, positions: 1 });
    expect(exact.geometry.coordinates).toHaveLength(MAX_MAP_POSITIONS);
  });

  it("reemplaza sólo la ubicación de la misma obra y revisión con la geometría de selección", () => {
    const current = locatedFeature({ type: "Point", coordinates: point }, "same-location");
    const selected = locatedFeature({ type: "Point", coordinates: [-64, -31] }, "same-location");
    const historical = locatedFeature({ type: "Point", coordinates: [-65, -32] }, "same-location", "historical-revision");
    const anotherWork = locatedFeature({ type: "Point", coordinates: [-66, -33] }, "same-location", seed.properties.revisionId, "another-work");
    expect(limitMapLayers([current, historical, anotherWork], [selected])).toEqual({
      catalog: [historical, anotherWork], selection: [selected], truncated: false, positions: 3,
    });
  });

  it("una selección enorme se omite entera y no elimina una ubicación del catálogo que sí cabe", () => {
    const oversized = locatedFeature({ type: "MultiPolygon", coordinates: [[Array.from({ length: MAX_MAP_POSITIONS + 1 }, () => point)]] }, "same-location");
    const small = locatedFeature({ type: "Point", coordinates: point }, "same-location");
    const result = limitMapLayers([small], [oversized]);
    expect(result).toEqual({ catalog: [small], selection: [], truncated: true, positions: 1 });
    expect(oversized.geometry.coordinates).toEqual([[Array.from({ length: MAX_MAP_POSITIONS + 1 }, () => point)]]);
  });

  it("la suma de ambas capas respeta 500 ubicaciones y la selección desplaza el último elemento del catálogo", () => {
    const catalog = Array.from({ length: MAX_MAP_FEATURES }, (_, index) => locatedFeature({ type: "Point", coordinates: point }, `catalog-${index}`));
    const selected = locatedFeature({ type: "Point", coordinates: point }, "selected");
    const result = limitMapLayers(catalog, [selected]);
    expect(result.catalog).toEqual(catalog.slice(0, MAX_MAP_FEATURES - 1));
    expect(result.selection).toEqual([selected]);
    expect(result.positions).toBe(MAX_MAP_FEATURES);
    expect(result.truncated).toBe(true);
    expect(limitMapLayers(catalog.slice(0, MAX_MAP_FEATURES - 1), [selected]).truncated).toBe(false);
  });

  it("la duplicación exacta no consume presupuesto ni provoca un aviso parcial", () => {
    const selected = locatedFeature({ type: "MultiPoint", coordinates: Array.from({ length: MAX_MAP_POSITIONS }, () => point) }, "selected");
    expect(limitMapLayers([selected], [selected])).toEqual({ catalog: [], selection: [selected], truncated: false, positions: MAX_MAP_POSITIONS });
    expect(limitMapLayers([], [])).toEqual({ catalog: [], selection: [], truncated: false, positions: 0 });
  });
});
