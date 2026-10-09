/** @file Presentación compartida de evidencia pública de procedencia y roles, con enlaces seguros y sin información de actores privados. */
import type { WorkDetail } from "../api/client";
import {
  fieldLabel,
  publicationDate,
  safeSourceUrl,
} from "../lib/presentation";

/** Describe evidencia de celda, catálogo o decisión y enlaza revisiones base sin exponer campos privados. */
export function Evidence({
  evidence,
  obraId,
}: {
  evidence: WorkDetail["procedencia"][string]["evidencias"][number];
  obraId: string;
}) {
  if (evidence.tipo === "SOURCE_CELL") {
    const location = evidence.localizador;
    return (
      <>
        <p>Dato del archivo fuente · columna {evidence.columna}.</p>
        <p>
          {location.format === "CSV"
            ? `CSV · líneas ${location.lineStart} a ${location.lineEnd}.`
            : location.format === "JSON"
              ? `JSON · registro ${location.dataOrdinal} · referencia ${location.pointer} · bytes ${location.byteStart} a ${location.byteEndExclusive} (fin exclusivo).`
              : `Hoja ${location.worksheet} · fila ${location.row} · celdas ${location.cells.join(", ")}.`}
        </p>
        <p className="muted">
          Recurso: <span className="technical-id">{evidence.recursoId}</span>
        </p>
      </>
    );
  }
  if (evidence.tipo === "CATALOG_METADATA") {
    const href = safeSourceUrl(evidence.referencia.url);
    return (
      <>
        <p>
          Metadato del catálogo: {evidence.clave} · {evidence.valor}
        </p>
        <p>
          {href ? (
            <a href={href} rel="noreferrer">
              Consultar referencia de origen
            </a>
          ) : (
            <span>Referencia de origen (enlace no disponible)</span>
          )}{" "}
          · versión {evidence.referencia.version}.
        </p>
        <p>
          Referencia consultada el{" "}
          {publicationDate(evidence.referencia.consultadoEn)}.
        </p>
      </>
    );
  }
  if (evidence.tipo === "GEOREF_LOCALITY") {
    const href = safeSourceUrl(evidence.referencia.url);
    return (
      <>
        <p>
          Referencia GeoRef de localidad: {evidence.nombre} · código{" "}
          {evidence.codigo}.
        </p>
        <p>
          {evidence.provinciaNombre} ({evidence.provinciaCodigo}) · departamento{" "}
          {evidence.departamentoNombre} ({evidence.departamentoCodigo}).
        </p>
        <p>
          {href ? (
            <a href={href} rel="noreferrer">
              Consultar referencia territorial
            </a>
          ) : (
            <span>Referencia territorial (enlace no disponible)</span>
          )}{" "}
          · versión {evidence.referencia.version}.
        </p>
        <p>
          Referencia consultada el{" "}
          {publicationDate(evidence.referencia.consultadoEn)}.
        </p>
      </>
    );
  }
  if (evidence.tipo === "BASE_REVISION")
    return (
      <p>
        Dato conservado de una{" "}
        <a
          href={`/obras/${evidence.obraId || obraId}?revisionId=${evidence.revisionId}`}
        >
          revisión anterior
        </a>
        : {fieldLabel(evidence.campo)}.
      </p>
    );
  return (
    <p>
      Decisión de revisión sobre {fieldLabel(evidence.campo)}. Referencia:{" "}
      <span className="technical-id">{evidence.decisionId}</span>.
    </p>
  );
}
