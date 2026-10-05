import { describe, expect, it, vi } from "vitest";
import type { Attribution } from "ol/source/Source.js";
import { canvasMapStyle, MAP_FONT_STYLESHEET, withoutOptionalOpenFreeMapCredit } from "../src/lib/map-style";

describe("Canvas basemap style", () => {
  it("keeps two-dimensional buildings and their zoom range without mutating the provider style", () => {
    const style = { version: 8, sources: { map: {} }, layers: [
      { id: "roads", type: "line", paint: { "line-color": "#fff" } },
      { id: "buildings", type: "fill-extrusion", source: "map", minzoom: 14,
        paint: { "fill-extrusion-color": "#ccc", "fill-extrusion-opacity": 0.8, "fill-extrusion-height": ["get", "height"] } },
    ] };
    const output = canvasMapStyle(style);
    expect(output.layers).toEqual([style.layers[0], {
      id: "buildings", type: "fill", source: "map", minzoom: 14,
      paint: { "fill-color": "#ccc", "fill-opacity": 0.8 },
    }]);
    expect(style.layers[1]?.type).toBe("fill-extrusion");
    expect(output.sources).toEqual(style.sources);
  });
  it("overrides a provider font CDN with the bundled stylesheet", () => {
    const output = canvasMapStyle({ version: 8, layers: [], metadata: { "ol:webfonts": "https://example.invalid/fonts.css", name: "test" } });
    expect(output.metadata).toEqual({ "ol:webfonts": MAP_FONT_STYLESHEET, name: "test" });
  });
  it.each([null, {}, { version: 7, layers: [] }, { version: 8, layers: {} }])("rejects incompatible styles", value => {
    expect(() => canvasMapStyle(value)).toThrow("El estilo del mapa no es compatible.");
  });
});

describe("Optional OpenFreeMap attribution", () => {
  const optionalCredit = '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> ';
  const dataCredits = '<a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

  it("removes only the optional brand link from the provider's TileJSON attribution", () => {
    expect(withoutOptionalOpenFreeMapCredit(optionalCredit + dataCredits)).toBe(dataCredits);
  });

  it("retains additional providers, license text and attribution order without mutating a list", () => {
    const extraCredit = '<a href="https://example.invalid/credits">Otro proveedor</a> · Licencia de datos';
    const credits = [optionalCredit + dataCredits, extraCredit];
    expect(withoutOptionalOpenFreeMapCredit(credits)).toEqual([dataCredits, extraCredit]);
    expect(credits).toEqual([optionalCredit + dataCredits, extraCredit]);
    expect(withoutOptionalOpenFreeMapCredit(undefined)).toBeUndefined();
  });

  it("preserves dynamic attribution callbacks and forwards their original frame state", () => {
    const frame = { time: 1 } as unknown as Parameters<Attribution>[0];
    const original = vi.fn<Attribution>().mockReturnValueOnce(optionalCredit + dataCredits).mockReturnValueOnce([optionalCredit + dataCredits, "Crédito según el encuadre"]);
    const adapted = withoutOptionalOpenFreeMapCredit(original);
    expect(typeof adapted).toBe("function");
    if (typeof adapted !== "function") throw new Error("Missing attribution callback");
    expect(adapted(frame)).toBe(dataCredits);
    expect(adapted(frame)).toEqual([dataCredits, "Crédito según el encuadre"]);
    expect(original).toHaveBeenCalledTimes(2);
    expect(original).toHaveBeenNthCalledWith(1, frame);
    expect(original).toHaveBeenNthCalledWith(2, frame);
  });

  it.each([
    "OpenFreeMap · OpenMapTiles · OpenStreetMap",
    '<a href="https://example.invalid/">OpenFreeMap</a> Otro crédito',
    '<a href="https://openfreemap.org.example.invalid/">OpenFreeMap</a> Otro crédito',
    '<a href="https://openfreemap.org/other">OpenFreeMap</a> Otro crédito',
    '<a href="https://openfreemap.org">OpenFreeMap contributors</a> Otro crédito',
    '<a data-href="https://openfreemap.org">OpenFreeMap</a> Otro crédito',
  ])("keeps unexpected credits intact: %s", credit => {
    expect(withoutOptionalOpenFreeMapCredit(credit)).toBe(credit);
  });
});
