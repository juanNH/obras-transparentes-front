/** @file Correspondencia entre fuentes y referencias visuales por nivel; no deduce jurisdicción de una ubicación. */
import type { WorkGeoJSON } from "../api/client.js";

/** Paleta, figuras y trazos por nivel de fuente para que las diferencias no dependan sólo del color. */
export const MAP_ORIGINS = {
  nation: {
    label: "Nación",
    color: "#0077A8",
    fill: "rgba(0,119,168,0.22)",
    marker: "circle",
    lineDash: undefined,
  },
  caba: {
    label: "Ciudad de Buenos Aires",
    color: "#B42332",
    fill: "rgba(180,35,50,0.22)",
    marker: "square",
    lineDash: [8, 4],
  },
  province: {
    label: "Provincia de Buenos Aires",
    color: "#287A3A",
    fill: "rgba(40,122,58,0.22)",
    marker: "triangle",
    lineDash: [3, 3],
  },
  municipality: {
    label: "Municipio · Vicente López",
    color: "#946800",
    fill: "rgba(148,104,0,0.22)",
    marker: "diamond",
    lineDash: [10, 3, 2, 3],
  },
  mixed: {
    label: "Fuentes de distintos niveles",
    color: "#334155",
    fill: "rgba(51,65,85,0.22)",
    marker: "hexagon",
    lineDash: [8, 3],
  },
  unknown: {
    label: "Fuente no informada",
    color: "#596979",
    fill: "rgba(89,105,121,0.22)",
    marker: "circle",
    lineDash: [2, 3],
  },
} as const;

/** Categoría de referencia de fuente, incluidas procedencias mixtas o desconocidas. */
export type MapOriginCategory = keyof typeof MAP_ORIGINS;
/** Recurso de origen del contrato público utilizado para clasificar el catálogo fuente. */
type PublicSource = WorkGeoJSON["features"][number]["properties"]["fuentes"][number];

const SOURCE_CATEGORY: Record<PublicSource["codigo"], Exclude<MapOriginCategory, "mixed" | "unknown">> = {
  "nacion-obras": "nation",
  "caba-actualizado": "caba",
  "pba-edificios": "province",
  "vl-obras": "municipality",
};

/** Maps the public source catalog to its jurisdiction level, never from the work's location. */
export function mapOriginCategory(sources: readonly Pick<PublicSource, "codigo">[]): MapOriginCategory {
  const categories = new Set(sources.map(({ codigo }) => SOURCE_CATEGORY[codigo]));
  if (categories.size > 1) return "mixed";
  return categories.values().next().value ?? "unknown";
}
