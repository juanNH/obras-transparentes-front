/**
 * @file Indica si una publicación cuenta con una ubicación aprobada para el mapa.
 * La ausencia de geometría no cambia la publicación ni el estado informado de la obra.
 */

/**
 * Muestra el alcance cartográfico con texto e icono decorativo, sin depender del color.
 * @param props - Disponibilidad de geometría aprobada y vigencia de la revisión pública.
 * @returns Etiqueta legible también en fichas históricas y resúmenes.
 */
export function MapAvailability({ hasGeometry, publishedCurrently = true }: { hasGeometry: boolean; publishedCurrently?: boolean }) {
  return <span className={`map-availability${hasGeometry ? "" : " without-map-location"}`}>
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 21s7-7.2 7-13a7 7 0 0 0-14 0c0 5.8 7 13 7 13Z" />
      <circle cx="12" cy="8" r="2.5" />
      {!hasGeometry && <path d="m3 3 18 18" strokeWidth="2.4" />}
    </svg>
    <span>{hasGeometry ? "Con ubicación en el mapa" : publishedCurrently ? "Publicada · Sin ubicación en el mapa" : "Revisión sin ubicación en el mapa"}</span>
  </span>;
}
