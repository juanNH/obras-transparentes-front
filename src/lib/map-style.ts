export const MAP_FONT_STYLESHEET = "/map-fonts/5.3.0/noto-sans.css";

/** Keep the public map two-dimensional and all font downloads on our origin. */
export function canvasMapStyle(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 8 ||
      !("layers" in value) || !Array.isArray(value.layers)) {
    throw new Error("El estilo del mapa no es compatible.");
  }
  const style = value as Record<string, unknown>;
  const metadata = style.metadata && typeof style.metadata === "object" ? style.metadata : {};
  return {
    ...style,
    metadata: { ...metadata, "ol:webfonts": MAP_FONT_STYLESHEET },
    layers: value.layers.map((layer: Record<string, unknown>) => {
      if (layer.type !== "fill-extrusion") return layer;
      const paint = (layer.paint ?? {}) as Record<string, unknown>;
      // Preserve building footprints at high zoom without a 3D renderer.
      return { ...layer, type: "fill", paint: {
        "fill-color": paint["fill-extrusion-color"] ?? "#d9d7d3",
        "fill-opacity": paint["fill-extrusion-opacity"] ?? 1,
      } };
    }),
  };
}
