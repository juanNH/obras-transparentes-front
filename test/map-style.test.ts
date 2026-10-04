import { describe, expect, it } from "vitest";
import { canvasMapStyle, MAP_FONT_STYLESHEET } from "../src/lib/map-style";

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
