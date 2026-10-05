/** @file Presentación de aceptación, precisión y referencia geográfica sin convertir supuestos en exactitud. */
import { locationPresentation, type LocationQuality as LocationQualityData } from "../lib/presentation";

/** Muestra condición, precisión y referencia geográfica por separado; los supuestos siguen identificados como tales. */
export function LocationQuality({ location }: { location: LocationQualityData }) {
  const presentation = locationPresentation(location);
  return <div className="location-quality">
    <p><strong>{presentation.label}.</strong></p>
    <p>{presentation.explanation}</p>
    {presentation.reference && <p className="muted">{presentation.reference}</p>}
  </div>;
}
