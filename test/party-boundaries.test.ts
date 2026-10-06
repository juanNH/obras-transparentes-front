/** @file Comprueba 135 límites GeoRef reales, presupuesto separado, conciliación de UUID y caché inmutable acotada, sin API activa. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import catalogFixture from "./fixtures/pba-parties.json" with { type: "json" };
import boundaryFixture from "./fixtures/pba-party-boundaries.json" with { type: "json" };
import type { PartyBoundaries, PartyCatalog } from "../src/api/client";
import { parsePublicResponse } from "../src/api/contract";

const transport = vi.hoisted(() => ({ readPublic: vi.fn() }));
vi.mock("../src/lib/browser-api", () => transport);
const catalog = parsePublicResponse<PartyCatalog>("PublicPartyCatalogResponse", catalogFixture);
const boundaries = parsePublicResponse<PartyBoundaries>("PublicPartyBoundaryFeatureCollection", boundaryFixture);
beforeEach(() => { vi.resetModules(); transport.readPublic.mockReset(); transport.readPublic.mockResolvedValue(boundaries); });

describe("capa territorial independiente", () => {
  it("conserva 135 límites reales y 55.842 posiciones aunque excedan el presupuesto de obras", async () => {
    const { validatePartyBoundaries, MAX_PARTY_BOUNDARY_BYTES } = await import("../src/lib/party-boundaries");
    expect(validatePartyBoundaries(boundaries, catalog)).toBe(boundaries);
    expect(boundaries.features).toHaveLength(135);
    expect(boundaries.metadata.validacion.posiciones).toBe(55842);
    expect(Buffer.byteLength(JSON.stringify(boundaries))).toBeLessThan(MAX_PARTY_BOUNDARY_BYTES);
  });
  it("rechaza distribución parcial, UUID repetido, código incompatible y exceso de posiciones completos", async () => {
    const { validatePartyBoundaries } = await import("../src/lib/party-boundaries");
    expect(() => validatePartyBoundaries({ ...boundaries, features: boundaries.features.slice(0, 134) }, catalog)).toThrow(TypeError);
    const duplicated = structuredClone(boundaries);
    duplicated.features[1] = structuredClone(duplicated.features[0]!);
    expect(() => validatePartyBoundaries(duplicated, catalog)).toThrow(TypeError);
    const changed = structuredClone(boundaries);
    changed.features[0]!.properties.indecDepartamento = "06999";
    expect(() => validatePartyBoundaries(changed, catalog)).toThrow(TypeError);
    const excessive = structuredClone(boundaries);
    excessive.features[0]!.geometry.coordinates = [[Array.from({ length: 100001 }, () => [-59, -35] as [number, number])]];
    expect(() => validatePartyBoundaries(excessive, catalog)).toThrow(TypeError);
  });
  it("reutiliza una sola distribución por versión/hash y cancela antes de leer", async () => {
    const { readPartyBoundaries, MAX_PARTY_BOUNDARY_BYTES } = await import("../src/lib/party-boundaries");
    const controller = new AbortController();
    await readPartyBoundaries(catalog, controller.signal);
    await readPartyBoundaries(catalog, controller.signal);
    expect(transport.readPublic).toHaveBeenCalledTimes(1);
    expect(transport.readPublic).toHaveBeenCalledWith("territorios/pba/partidos/limites?version=pba-partidos-limites%401", controller.signal, MAX_PARTY_BOUNDARY_BYTES);
    const changed = structuredClone(catalog);
    if (changed.limites.estado !== "VALIDATED_FOR_DISPLAY") throw new Error("Expected final boundary fixture");
    changed.limites.sha256 = "b".repeat(64);
    await readPartyBoundaries(changed, controller.signal);
    expect(transport.readPublic).toHaveBeenCalledTimes(2);
    controller.abort();
    await expect(readPartyBoundaries(changed, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(transport.readPublic).toHaveBeenCalledTimes(2);
  });
});
