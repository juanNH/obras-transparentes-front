import type { WorkDetail } from "../api/client";
import { locationPresentation } from "../lib/presentation";

export function LocationQuality({ location }: { location: Pick<WorkDetail["ubicaciones"][number], "condicion" | "crs" | "precision"> }) {
  const presentation = locationPresentation(location);
  return <div className="location-quality">
    <p><strong>{presentation.label}.</strong></p>
    <p>{presentation.explanation}</p>
    {presentation.reference && <p className="muted">{presentation.reference}</p>}
  </div>;
}
