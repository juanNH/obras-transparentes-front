import type { WorkGeoJSON } from "../api/client.js";

type MapFeature = WorkGeoJSON["features"][number];
export const MAX_MAP_FEATURES = 500;
export const MAX_MAP_POSITIONS = 10_000;

/** Count position tuples, not their ordinates, without recursively walking input. */
function countPositions(geometry: MapFeature["geometry"], remaining: number): number {
  switch (geometry.type) {
    case "Point": return 1;
    case "MultiPoint":
    case "LineString": return geometry.coordinates.length;
    case "MultiLineString":
    case "Polygon": {
      let positions = 0;
      for (const line of geometry.coordinates) {
        positions += line.length;
        if (positions > remaining) break;
      }
      return positions;
    }
    case "MultiPolygon": {
      let positions = 0;
      for (const polygon of geometry.coordinates) {
        for (const ring of polygon) {
          positions += ring.length;
          if (positions > remaining) return positions;
        }
      }
      return positions;
    }
  }
}

/**
 * The API contract is validated before this function. Retain original Features
 * whole: partial rings, guessed points and simplified geometry would change data.
 * A skipped location must be disclosed as a partial map; the full list remains
 * the way to explore its work, including every omitted location's description.
 */
export function limitMapFeatures(input: readonly MapFeature[]): {
  features: MapFeature[];
  truncated: boolean;
  positions: number;
} {
  const features: MapFeature[] = [];
  let positions = 0;
  let truncated = false;
  for (const feature of input) {
    if (features.length === MAX_MAP_FEATURES) { truncated = true; break; }
    const size = countPositions(feature.geometry, MAX_MAP_POSITIONS - positions);
    if (positions + size > MAX_MAP_POSITIONS) { truncated = true; continue; }
    features.push(feature);
    positions += size;
  }
  return { features, truncated, positions };
}
