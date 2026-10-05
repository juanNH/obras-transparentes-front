/** @file Presupuestos de features y posiciones para mapa/selección, sin simplificar ni inventar geometrías. */
import type { WorkGeoJSON } from "../api/client.js";

/** Ubicación GeoJSON tipada usada para contar features y posiciones del mapa. */
type MapFeature = WorkGeoJSON["features"][number];
/** Máximo conjunto de ubicaciones representables entre catálogo y selección. */
export const MAX_MAP_FEATURES = 500;
/** Presupuesto de posiciones reales del renderer; no cuenta ordenadas individuales. */
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

/**
 * Catalogue and selection share one rendering budget. An accepted selection
 * takes priority and replaces only the same work, revision and location from
 * the catalogue; another revision remains a distinct public geometry.
 */
export function limitMapLayers(
  catalogue: readonly MapFeature[],
  selected: readonly MapFeature[],
): {
  catalog: MapFeature[];
  selection: MapFeature[];
  truncated: boolean;
  positions: number;
} {
  const catalog: MapFeature[] = [];
  const selection: MapFeature[] = [];
  const selectedKeys = new Set<string>();
  let positions = 0;
  let truncated = false;
  /** Identifica obra/revisión/ubicación para evitar duplicados entre catálogo y selección. */
  const key = (feature: MapFeature) => JSON.stringify([
    feature.properties.obraId,
    feature.properties.revisionId,
    feature.properties.ubicacionId,
  ]);
  /** Conserva features completas que caben en ambos presupuestos, identificando cualquier omisión como mapa parcial. */
  const retain = (feature: MapFeature, target: MapFeature[]): boolean => {
    if (catalog.length + selection.length === MAX_MAP_FEATURES) {
      truncated = true;
      return false;
    }
    const size = countPositions(feature.geometry, MAX_MAP_POSITIONS - positions);
    if (positions + size > MAX_MAP_POSITIONS) {
      truncated = true;
      return false;
    }
    target.push(feature);
    positions += size;
    return true;
  };

  for (const feature of selected) {
    if (retain(feature, selection)) selectedKeys.add(key(feature));
  }
  for (const feature of catalogue) {
    if (!selectedKeys.has(key(feature))) retain(feature, catalog);
  }
  return { catalog, selection, truncated, positions };
}
