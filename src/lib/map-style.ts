import type { AttributionLike } from "ol/source/Source.js";

export const MAP_FONT_STYLESHEET = "/map-fonts/5.3.0/noto-sans.css";

function removeOptionalOpenFreeMapLink(attribution: string): string {
  return attribution.replace(/<a\b([^>]*)>\s*OpenFreeMap\s*<\/a>\s*/gi, (link, attributes: string) => {
    const href = /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(attributes);
    if (!href) return link;
    const target = href[1] ?? href[2] ?? href[3];
    if (!target) return link;
    try {
      const url = new URL(target);
      return url.origin === "https://openfreemap.org" && !url.username && !url.password &&
        url.pathname === "/" && !url.search && !url.hash ? "" : link;
    } catch {
      return link;
    }
  });
}

/** OpenFreeMap permits omitting its name (https://openfreemap.org/#attribution).
 * Apply to the resolved source credits: Liberty obtains them from external TileJSON.
 * Retain every other provider/data credit, including credits that change with the view.
 */
export function withoutOptionalOpenFreeMapCredit(attributions: AttributionLike | undefined): AttributionLike | undefined {
  if (typeof attributions === "function") {
    return frameState => {
      const credits = attributions(frameState);
      // TileJSON's runtime callback returns null outside its bounds.
      if (credits == null) return [];
      return typeof credits === "string" ? removeOptionalOpenFreeMapLink(credits) : credits.map(removeOptionalOpenFreeMapLink);
    };
  }
  if (typeof attributions === "string") return removeOptionalOpenFreeMapLink(attributions);
  return attributions?.map(removeOptionalOpenFreeMapLink);
}

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
