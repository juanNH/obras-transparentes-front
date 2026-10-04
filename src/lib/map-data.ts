import type { Feature, FeatureCollection, Geometry, Point } from "geojson";
import type { BoundingBox, WorkGeoJSON } from "../api/client.js";

type MapProperties = { obraId: string; revisionId: string };
export type MapCollection = FeatureCollection<Geometry, MapProperties>;

/** Mercator cannot display the poles; API queries must also have increasing bounds. */
export function clampMapBBox(bbox: BoundingBox): BoundingBox | null {
  if (!bbox.every(Number.isFinite)) return null;
  const [west, south, east, north] = bbox;
  const bounded: BoundingBox = [
    Math.max(-180, Math.min(180, west)),
    Math.max(-85.051129, Math.min(85.051129, south)),
    Math.max(-180, Math.min(180, east)),
    Math.max(-85.051129, Math.min(85.051129, north)),
  ];
  return bounded[0] < bounded[2] && bounded[1] < bounded[3] ? bounded : null;
}

/** Cluster real point positions only. Never replace an area/line with a guessed center. */
export function partitionMapFeatures(features: WorkGeoJSON["features"]): {
  points: FeatureCollection<Point, MapProperties>;
  shapes: MapCollection;
  all: MapCollection;
} {
  const points: Feature<Point, MapProperties>[] = [];
  const shapes: Feature<Geometry, MapProperties>[] = [];
  const all: Feature<Geometry, MapProperties>[] = [];
  for (const feature of features) {
    const properties = {
      obraId: feature.properties.obraId,
      revisionId: feature.properties.revisionId,
    };
    const compact: Feature<Geometry, MapProperties> = {
      type: "Feature",
      id: feature.id,
      properties,
      geometry: feature.geometry,
    };
    all.push(compact);
    if (feature.geometry.type === "Point") {
      points.push({ ...compact, geometry: feature.geometry });
    } else if (feature.geometry.type === "MultiPoint") {
      feature.geometry.coordinates.forEach((coordinates, index) => {
        points.push({
          type: "Feature",
          id: `${feature.id}:${index}`,
          properties,
          geometry: { type: "Point", coordinates },
        });
      });
    } else {
      shapes.push(compact);
    }
  }
  return {
    points: { type: "FeatureCollection", features: points },
    shapes: { type: "FeatureCollection", features: shapes },
    all: { type: "FeatureCollection", features: all },
  };
}

export function selectedMapFeatures(
  collection: MapCollection,
  obraId: string | null,
): MapCollection {
  return {
    type: "FeatureCollection",
    features: obraId === null ? [] : collection.features.filter((feature) => feature.properties.obraId === obraId),
  };
}
