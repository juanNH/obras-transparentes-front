/** @file Conversión de ubicaciones aprobadas a capas 2D, preservando identidad de obra, revisión y ubicación. */
import type { Feature, FeatureCollection, Geometry, Point } from "geojson";
import type { BoundingBox, WorkDetail, WorkGeoJSON } from "../api/client.js";
import { mapOriginCategory, type MapOriginCategory } from "./map-origin.js";

/** Propiedades compactas que conservan identidad y calidad y agregan categoría visual por fuente. */
export type MapProperties = Pick<WorkGeoJSON["features"][number]["properties"], "obraId" | "revisionId" | "ubicacionId" | "nombre" | "calidad" | "fuentes"> & {
  nivelFuente: MapOriginCategory;
};
/** Colección de figuras reales con identidad de obra, revisión y ubicación preservada. */
export type MapCollection = FeatureCollection<Geometry, MapProperties>;

/** Preserve the requested public revision; only approved, real locations can be drawn. */
export function detailMapFeatures(work: WorkDetail): WorkGeoJSON["features"] {
  const features: WorkGeoJSON["features"] = [];
  const seen = new Set<string>();
  for (const location of work.ubicaciones) {
    if (location.condicion !== "ACCEPTED" || !location.geometria || seen.has(location.ubicacionId)) continue;
    seen.add(location.ubicacionId);
    features.push({
      type: "Feature",
      id: location.ubicacionId,
      geometry: location.geometria,
      properties: {
        obraId: work.obraId,
        revisionId: work.revisionId,
        ubicacionId: location.ubicacionId,
        nombre: work.nombre,
        estado: work.estado,
        clasificaciones: work.clasificaciones,
        fuentes: work.fuentes,
        calidad: {
          condicion: location.condicion,
          controles: location.controles,
          crs: location.crs,
          precision: location.precision,
          ...(location.origenGeometria ? { origenGeometria: location.origenGeometria } : {}),
        },
      },
    });
  }
  return features;
}

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
      ubicacionId: feature.properties.ubicacionId,
      nombre: feature.properties.nombre,
      calidad: feature.properties.calidad,
      fuentes: feature.properties.fuentes,
      nivelFuente: mapOriginCategory(feature.properties.fuentes),
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

/**
 * Filtra la colección por obra y, cuando se especifican, revisión y ubicación exactas.
 * @returns Colección vacía si no hay selección, sin reemplazar una ubicación ausente por otra.
 */
export function selectedMapFeatures(
  collection: MapCollection,
  obraId: string | null,
  ubicacionId?: string | null,
  revisionId?: string | null,
): MapCollection {
  return {
    type: "FeatureCollection",
    features: obraId === null ? [] : collection.features.filter((feature) => feature.properties.obraId === obraId &&
      (!revisionId || feature.properties.revisionId === revisionId) &&
      (!ubicacionId || feature.properties.ubicacionId === ubicacionId)),
  };
}
