/** @file Comprueba identidad territorial compartible y exclusión del filtro anterior, sin red ni datos de obras reales. */
import { describe, expect, it, vi } from "vitest";
import examples from "../contracts/examples.json" with { type: "json" };
import { createPublicApi } from "../src/api/client";
import { explorerHref, parseExplorerQuery, unlocatedListHref } from "../src/lib/explorer-query";

const party = "AAAAAAAA-1111-4111-8111-111111111111";
describe("identidad compartible del partido informado", () => {
  it("normaliza la identidad y conserva partido al alternar lista y consultar faltantes", () => {
    const state = parseExplorerQuery(new URLSearchParams({ partidoId: party, vista: "lista" }));
    expect(state.query).toEqual({ limit: 20, partidoId: party.toLowerCase() });
    expect(explorerHref(state.query)).toBe("/mapa?partidoId=" + party.toLowerCase());
    expect(unlocatedListHref({ ...state.query, cursor: "old", bbox: [-59, -35, -58, -34] })).toBe("/mapa?partidoId=" + party.toLowerCase() + "&tieneGeometria=false&vista=lista");
    expect(parseExplorerQuery(new URLSearchParams("partidoId="))).toEqual({ query: { limit: 20 }, view: "mapa" });
  });
  it("comparte la presentación de límites sin enviar ese estado a la consulta de obras", () => {
    const state = parseExplorerQuery(new URLSearchParams({ partidoId: party, limites: "mostrar", vista: "lista" }));
    expect(state.showBoundaries).toBe(true);
    expect(state.query).not.toHaveProperty("limites");
    expect(explorerHref(state.query, "lista", true)).toContain("limites=mostrar");
    expect(() => parseExplorerQuery(new URLSearchParams("limites=unknown"))).toThrow(TypeError);
  });
  it.each(["partidoId=invalid", `partidoId=${party}&partidoId=${party}`, `partidoId=${party}&territorioEsquema=pba.municipio&municipioCodigo=06854`, `partidoId=${party}&municipioCodigo=001`])("rechaza identidades o filtros ambiguos: %s", value => {
    expect(() => parseExplorerQuery(new URLSearchParams(value))).toThrow(TypeError);
  });
  it("envía partidoId a lista y GeoJSON manteniendo el bbox separado", async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(examples.listEmpty))
      .mockResolvedValueOnce(Response.json(examples.geojsonEmpty));
    const api = createPublicApi({ fetch: request });
    await api.list({ partidoId: party });
    await api.geojson({ partidoId: party, bbox: [-59, -35, -58, -34] });
    const list = new URL(String(request.mock.calls[0]![0]), "https://example.test");
    const map = new URL(String(request.mock.calls[1]![0]), "https://example.test");
    expect(list.searchParams.get("partidoId")).toBe(party);
    expect(list.searchParams.has("bbox")).toBe(false);
    expect(map.searchParams.get("partidoId")).toBe(party);
    expect(map.searchParams.get("bbox")).toBe("-59,-35,-58,-34");
    expect(() => api.list({ partidoId: party, territorioEsquema: "pba.municipio", municipioCodigo: "06854" })).toThrow(TypeError);
    expect(() => api.list({ partidoId: "../admin" })).toThrow(TypeError);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
