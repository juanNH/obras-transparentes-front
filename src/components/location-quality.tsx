import { locationPresentation, type LocationQuality as LocationQualityData } from "../lib/presentation";

export function LocationQuality({ location }: { location: LocationQualityData }) {
  const presentation = locationPresentation(location);
  return <div className="location-quality">
    <p><strong>{presentation.label}.</strong></p>
    <p>{presentation.explanation}</p>
    {presentation.reference && <p className="muted">{presentation.reference}</p>}
  </div>;
}
