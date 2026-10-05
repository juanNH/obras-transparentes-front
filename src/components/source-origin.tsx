import { MAP_ORIGINS, mapOriginCategory, type MapOriginCategory } from "../lib/map-origin";

export function SourceSymbol({ category }: { category: MapOriginCategory }) {
  const origin = MAP_ORIGINS[category];
  const common = { fill: origin.color, stroke: "#ffffff", strokeWidth: 2 };
  return <svg className="map-origin-symbol" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {origin.marker === "circle" && <circle cx="12" cy="12" r="8" {...common} />}
    {origin.marker === "square" && <rect x="4" y="4" width="16" height="16" {...common} />}
    {origin.marker === "triangle" && <polygon points="12,3 21,20 3,20" {...common} />}
    {origin.marker === "diamond" && <polygon points="12,2 22,12 12,22 2,12" {...common} />}
    {origin.marker === "hexagon" && <polygon points="7,3 17,3 22,12 17,21 7,21 2,12" {...common} />}
  </svg>;
}

export function SourceBadge({ sources }: { sources: Parameters<typeof mapOriginCategory>[0] }) {
  const category = mapOriginCategory(sources);
  const origin = MAP_ORIGINS[category];
  return <span className="source-badge" data-source-origin={category} style={{ borderColor: origin.color }}>
    <SourceSymbol category={category} /><span>Datos de: {origin.label}</span>
  </span>;
}

export function SourceLegend() {
  return <div className="map-origin-key" role="group" aria-label="Referencia de fuente de datos">
    <p className="map-origin-title">Colores inspirados en las banderas</p>
    <ul>{Object.entries(MAP_ORIGINS).map(([key, origin]) => <li key={key}>
      <SourceSymbol category={key as MapOriginCategory} /><span>{origin.label}</span>
    </li>)}</ul>
    <p className="map-origin-note">El color y la forma identifican quién publica los datos. El responsable, el ejecutor y los financiadores se muestran en la ficha cuando están informados. <a href="/proyecto#colores">Por qué usamos estos colores</a>.</p>
  </div>;
}
