/** @file Copia de citas iniciada por el visitante con alternativa textual accesible cuando el portapapeles no está disponible. */
"use client";
import { useState } from "react";

/** Conserva una cita seleccionable sin JavaScript; el botón usa el portapapeles sólo por acción explícita. */
export function ReportedRecordCitation({ citation }: { citation: string }) {
  const [message, setMessage] = useState("");
  return <div className="record-citation">
    <label>Referencia para citar<textarea readOnly rows={6} value={citation} /></label>
    <button type="button" className="button secondary" onClick={async () => {
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(citation.replace(/\/registros\/[a-f0-9-]+$/i, window.location.origin + window.location.pathname));
        setMessage("Referencia copiada.");
      } catch { setMessage("No se pudo copiar automáticamente. Seleccioná y copiá la referencia del cuadro."); }
    }}>Copiar referencia</button>
    <p role="status">{message}</p>
  </div>;
}
