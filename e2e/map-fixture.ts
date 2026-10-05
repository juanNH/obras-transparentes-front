/** @file Helpers E2E de red/cartografía sintéticas para verificar Canvas sin descargar servicios reales. */
import { expect, type Page } from "@playwright/test";

// This style draws synthetic geography in Canvas; it needs no remote tiles,
// sprites or fonts. A visible background alone would not prove map rendering.
const baseStyle = {
  version: 8,
  sources: {
    synthetic: {
      type: "geojson",
      attribution: "Cartografía sintética de prueba",
      data: {
        type: "FeatureCollection",
        features: [
          { type: "Feature", properties: { kind: "land" }, geometry: { type: "Polygon", coordinates: [[[-59, -35], [-58, -35], [-58, -34], [-59, -34], [-59, -35]]] } },
          { type: "Feature", properties: { kind: "road" }, geometry: { type: "LineString", coordinates: [[-58.9, -34.9], [-58.1, -34.1]] } },
        ],
      },
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#edf0e6" } },
    { id: "land", type: "fill", source: "synthetic", filter: ["==", "kind", "land"], paint: { "fill-color": "#e2ead9" } },
    { id: "road", type: "line", source: "synthetic", filter: ["==", "kind", "road"], paint: { "line-color": "#c4b99c", "line-width": 5 } },
  ],
};

/** Bloquea tráfico externo y conserva únicamente los servidores locales de prueba. */
export async function isolateMapNetwork(page: Page) {
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return route.continue();
    return route.abort();
  });
}

/** Sustituye el estilo del proveedor por geografía sintética pintada en Canvas, sin teselas remotas. */
export async function useSyntheticBasemap(page: Page) {
  await page.route("https://tiles.openfreemap.org/**", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(baseStyle),
  }));
}

/** Fuerza APIs WebGL no disponibles antes de cargar la página para comprobar la alternativa Canvas. */
export async function disableWebGL(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, name: string, ...args: unknown[]) {
      if (name === "webgl" || name === "webgl2" || name === "experimental-webgl") return null;
      return Reflect.apply(original, this, [name, ...args]);
    } as typeof original;
  });
}

/** Exige controles listos y un píxel pintado por capas reales del fixture, además de ausencia de fallas cartográficas. */
export async function expectCanvasMap(page: Page) {
  await expect(page.getByRole("button", { name: "Acercar mapa", exact: true })).toBeEnabled();
  await expect(page.locator(".map-canvas canvas").first()).toBeVisible();
  // At least one Canvas pixel must be painted by the synthetic vector layer.
  await expect.poll(() => page.locator(".map-canvas canvas").evaluateAll(canvases => canvases.some(element => {
    const canvas = element as HTMLCanvasElement;
    if (!canvas.width || !canvas.height) return false;
    const pixels = canvas.getContext("2d")?.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
    return Boolean(pixels && pixels[3] !== 0);
  }))).toBe(true);
  await expect(page.getByText(/No pudimos mostrar el mapa|No se pudo cargar una parte del mapa/)).toHaveCount(0);
}

/** Inspecciona píxeles Canvas con tolerancia RGB para probar que se dibujaron formas del escenario. */
export async function hasMapColor(page: Page, rgb: readonly [number, number, number]) {
  return page.locator(".map-canvas canvas").evaluateAll((canvases, color) => canvases.some(element => {
    const canvas = element as HTMLCanvasElement;
    if (!canvas.width || !canvas.height) return false;
    const pixels = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!pixels) return false;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      if (pixels[offset + 3]! > 240 && color.every((channel, index) => Math.abs(pixels[offset + index]! - channel) < 4)) return true;
    }
    return false;
  }), rgb);
}
