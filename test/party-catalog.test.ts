/** @file Comprueba nómina territorial atribuida y búsqueda local sin inventar cobertura de obras, con fixture nominal versionado. */
import { describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/pba-parties.json" with { type: "json" };
import { createPublicApi, type PartyCatalog } from "../src/api/client";
import { ApiContractError, parsePublicResponse } from "../src/api/contract";
import { matchingParties } from "../src/lib/party-catalog";

const catalog = parsePublicResponse<PartyCatalog>("PublicPartyCatalogResponse", fixture);
describe("catálogo nominal independiente", () => {
  it("conserva 135 identidades distintas y códigos de namespaces separados", () => {
    expect(catalog.items).toHaveLength(135);
    expect(new Set(catalog.items.map(party => party.partidoId)).size).toBe(135);
    expect(catalog.items[0]!.codigos).toEqual({ indecDepartamento: "06854", georefMunicipio: "060854" });
    expect(catalog.items.filter(party => party.equivalenciasPbaMunicipio.length)).toHaveLength(95);
    expect(() => parsePublicResponse("PublicPartyCatalogResponse", { ...fixture, items: fixture.items.slice(0, 134) })).toThrow(ApiContractError);
  });
  it("busca por nombres sin tildes/mayúsculas y por ambos códigos externos", () => {
    expect(matchingParties(catalog, " ZARATE ").map(party => party.nombre)).toEqual(["Zárate"]);
    expect(matchingParties(catalog, "capitan sarmiento").map(party => party.nombre)).toEqual(["Capitán Sarmiento"]);
    expect(matchingParties(catalog, "060854").map(party => party.nombre)).toEqual(["25 de Mayo"]);
    expect(matchingParties(catalog, "06854").map(party => party.nombre)).toEqual(["25 de Mayo"]);
    expect(matchingParties(catalog, "sin coincidencia")).toEqual([]);
    expect(matchingParties(catalog, "")).toHaveLength(135);
  });
  it("lee sólo el endpoint territorial con señal y validación generada", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(fixture));
    const controller = new AbortController();
    const received = await createPublicApi({ fetch: request }).parties({ signal: controller.signal });
    expect(received).toEqual(catalog);
    expect(String(request.mock.calls[0]![0])).toBe("/api/v1/territorios/pba/partidos");
    expect(request.mock.calls[0]![1]).toMatchObject({ credentials: "omit", redirect: "error", signal: controller.signal });
  });
});
