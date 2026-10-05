import { describe, expect, it } from "vitest";
import examples from "../contracts/examples.json" with { type: "json" };
import { parsePublicResponse } from "../src/api/contract.js";
import type { WorkGeoJSON } from "../src/api/client.js";
import { partitionMapFeatures, selectedMapFeatures } from "../src/lib/map-data.js";
import { locationPresentation } from "../src/lib/presentation.js";

const seed = parsePublicResponse<WorkGeoJSON>("PublicGeoFeatureCollection", examples.geojsonPopulated).features[0]!;
const assumption: typeof seed.properties.calidad = {
  condicion: "ACCEPTED",
  crs: { codigo: "EPSG:4326", fundamento: "REVIEW_DECISION", condicion: "APPROVED_ASSUMPTION" },
  precision: "coordenada_reportada_sin_precision",
  controles: ["WGS84_ASSUMPTION_APPROVED", "MANUALLY_ACCEPTED", "POSTGIS_VALID"],
};

describe("calidad de la ubicación representada", () => {
  it.each(["coordenada_reportada_sin_precision", "geometria_reportada_sin_precision", "ubicacion_establecimiento_reportada"] as const)("un domicilio geocodificado distingue su origen aunque conserve precision=%s", precision => {
    const derived: typeof assumption = {
      ...assumption, origenGeometria: "ADDRESS_GEOCODE", precision,
      crs: { codigo: "EPSG:4326", fundamento: "OFFICIAL_SERVICE", condicion: "SERVICE_REFERENCE" },
    };
    expect(locationPresentation(derived)).toEqual({
      label: "Domicilio geocodificado · ubicación orientativa",
      explanation: "La fuente no informó coordenadas. El servicio oficial Georef obtuvo un punto a partir de la dirección. Su precisión no está verificada. El punto no acredita el sitio exacto ni el alcance de la obra.",
      reference: "Referencia geográfica EPSG:4326: salida del servicio oficial; no declara el sistema de coordenadas de la fuente.",
    });
    expect(JSON.stringify(locationPresentation(derived))).not.toMatch(/coordenada reportada|geometría reportada|supuesto aprobado|catálogo de origen/i);
    expect(derived.precision).toBe(precision);
  });

  it("explica el supuesto aprobado sin inventar exactitud ni una distancia de error", () => {
    expect(locationPresentation(assumption)).toEqual({
      label: "Ubicación orientativa · precisión no informada",
      explanation: "La fuente no informó el sistema de coordenadas. Se aprobó interpretarlas como WGS84 durante la revisión. El punto no acredita el sitio exacto ni el alcance de la obra.",
      reference: "Referencia geográfica EPSG:4326: supuesto aprobado mediante revisión.",
    });
  });

  it("conserva la referencia reportada del establecimiento sin etiquetarla como un supuesto", () => {
    const presentation = locationPresentation({ ...assumption, crs: { codigo: "EPSG:4326", fundamento: "CATALOG_METADATA", condicion: "REPORTED_REFERENCE" }, precision: "ubicacion_establecimiento_reportada" });
    expect(presentation.label).toBe("Ubicación reportada del establecimiento");
    expect(presentation.explanation).toContain("no indica el alcance de la obra");
    expect(presentation.reference).toContain("informada por el catálogo de origen");
    expect(JSON.stringify(presentation)).not.toMatch(/orientativa|supuesto/);
  });

  it.each(["PENDING_REVIEW", "OMITTED", "INVALID"] as const)("un punto %s no se presenta como aprobado bajo supuesto", condicion => {
    expect(locationPresentation({ ...assumption, condicion, crs: null }).label).not.toMatch(/orientativa|aprobada/);
  });

  it("conserva calidad e identidad de ubicación al separar MultiPoint y geometrías", () => {
    const point: typeof seed = { ...seed, geometry: { type: "MultiPoint", coordinates: [[-58.42, -34.60], [-58.41, -34.61]] }, properties: { ...seed.properties, calidad: assumption } };
    const other: typeof seed = { ...seed, id: "40000000-0000-4000-8000-000000000099", geometry: { type: "LineString", coordinates: [[-58.42, -34.60], [-58.41, -34.61]] }, properties: { ...seed.properties, ubicacionId: "40000000-0000-4000-8000-000000000099" } };
    const input = structuredClone([point, other]);
    const maps = partitionMapFeatures(input);
    expect(maps.points.features).toHaveLength(2);
    for (const member of maps.points.features) {
      expect(member.properties.ubicacionId).toBe(seed.properties.ubicacionId);
      expect(member.properties.calidad).toEqual(assumption);
    }
    expect(maps.shapes.features[0]!.properties.calidad).toEqual(other.properties.calidad);
    expect(input).toEqual([point, other]);
  });

  it("el origen derivado se conserva al particionar y seleccionar junto a otra ubicación reportada", () => {
    const quality: typeof assumption = { ...assumption, origenGeometria: "ADDRESS_GEOCODE", crs: { codigo: "EPSG:4326", fundamento: "OFFICIAL_SERVICE", condicion: "SERVICE_REFERENCE" } };
    const derived = { ...seed, id: "40000000-0000-4000-8000-000000000088", properties: { ...seed.properties, ubicacionId: "40000000-0000-4000-8000-000000000088", calidad: quality } };
    const input = structuredClone([seed, derived]);
    const maps = partitionMapFeatures(input);
    expect(maps.points.features[1]!.properties.calidad.origenGeometria).toBe("ADDRESS_GEOCODE");
    expect(selectedMapFeatures(maps.all, seed.properties.obraId, derived.properties.ubicacionId, seed.properties.revisionId).features[0]!.properties.calidad).toEqual(quality);
    expect(maps.points.features[0]!.properties.calidad.origenGeometria).toBeUndefined();
    expect(input).toEqual([seed, derived]);
  });

  it("selecciona la ubicación y revisión exactas, sin sustituirlas por otro punto de la misma obra", () => {
    const other = { ...seed, id: "40000000-0000-4000-8000-000000000099", properties: { ...seed.properties, ubicacionId: "40000000-0000-4000-8000-000000000099", calidad: assumption } };
    const historical = { ...other, properties: { ...other.properties, revisionId: "20000000-0000-4000-8000-000000000099" } };
    const maps = partitionMapFeatures([seed, other, historical]);
    const selected = selectedMapFeatures(maps.all, seed.properties.obraId, other.properties.ubicacionId, seed.properties.revisionId);
    expect(selected.features).toHaveLength(1);
    expect(selected.features[0]!.properties.calidad).toEqual(assumption);
    expect(selectedMapFeatures(maps.all, seed.properties.obraId, "ubicacion-ausente", seed.properties.revisionId).features).toEqual([]);
  });
});
