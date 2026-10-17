/** @file Permite buscar y desplegar fuentes agrupadas con HTML nativo, sin inferir ubicaciones ni sumar publicaciones por procedencia. */
"use client";
import { useState } from "react";
import { sourceListHref, SOURCES } from "../lib/explorer-query";
import { reportedRecordsHref } from "../api/reported-records";
import type { ReportedRecordCounts } from "../api/reported-records";
import {
  filterSourceCoverageGroups,
  groupSourceCoverage,
} from "../lib/source-coverage";
import type {
  PublicSourceCode,
  PublicSourceCoverage,
} from "../lib/source-coverage";

/** Filtra sólo la presentación del inventario; sus controles no modifican la consulta de obras ni consumen la API. */
export function SourceCoverageBrowser({
  coverage,
  stale,
  activeSource,
  reportedRecordCounts = null,
}: {
  coverage: readonly PublicSourceCoverage[];
  stale: boolean;
  activeSource?: PublicSourceCode | undefined;
  reportedRecordCounts?: ReportedRecordCounts | null;
}) {
  const [query, setQuery] = useState("");
  const groups = filterSourceCoverageGroups(
    groupSourceCoverage(coverage),
    query,
  );
  const found = groups.reduce(
    (count, group) => count + group.fuentes.length,
    0,
  );
  return (
    <div className="source-coverage-browser">
      <div className="source-coverage-search">
        <label htmlFor="source-coverage-search">
          Buscar provincia, municipio o fuente
        </label>
        <input
          id="source-coverage-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ej.: Buenos Aires o Vicente López"
        />
        <p className="results-footnote">
          Esta búsqueda sólo organiza las fuentes; no filtra obras.
        </p>
        {query && (
          <p role="status">
            {found} {found === 1 ? "fuente encontrada" : "fuentes encontradas"}.
          </p>
        )}
        <noscript>
          <p>
            Podés abrir cada grupo y sus fuentes sin JavaScript. La búsqueda
            requiere JavaScript.
          </p>
        </noscript>
      </div>
      {groups.length ? (
        <div className="source-coverage-groups">
          {groups.map((group) => (
            <details
              key={group.id}
              className="source-coverage-group"
              data-scope={group.id}
              open={
                query.trim() ||
                group.fuentes.some((source) => source.codigo === activeSource)
                  ? true
                  : undefined
              }
            >
              <summary>
                <span>{group.nombre}</span>
                <span className="source-coverage-group-count">
                  {group.fuentes.length}{" "}
                  {group.fuentes.length === 1 ? "fuente" : "fuentes"}
                </span>
              </summary>
              {group.nivel === "UNKNOWN" && (
                <p className="results-footnote">
                  No se pudo confirmar el alcance de estas fuentes. Sus nombres
                  no bastan para asignar una provincia.
                </p>
              )}
              <ul className="source-coverage-list">
                {group.fuentes.map((source) => (
                  <SourceCoverageRow
                    key={source.codigo}
                    source={source}
                    stale={stale}
                    active={source.codigo === activeSource}
                    reportedRecordCounts={reportedRecordCounts}
                  />
                ))}
              </ul>
            </details>
          ))}
        </div>
      ) : (
        <p className="source-coverage-empty">
          No hay fuentes que coincidan. Probá con otro nombre o borrá la
          búsqueda.
        </p>
      )}
    </div>
  );
}

/** Muestra el desglose de una fuente y acceso a lista; un error o un corte distinto nunca se presentan como cero. */
function SourceCoverageRow({
  source,
  stale,
  active,
  reportedRecordCounts,
}: {
  source: PublicSourceCoverage;
  stale: boolean;
  active: boolean;
  reportedRecordCounts: ReportedRecordCounts | null;
}) {
  const status =
    stale && source.estado === "AVAILABLE" ? "UNKNOWN" : source.estado;
  const available = status === "AVAILABLE";
  const published = source.obrasPublicadas;
  const located = source.obrasConGeometria;
  const unlocated = source.obrasSinGeometria;
  const documentReport = source.codigo === "lujan-documentos" || source.codigo === "coronel-suarez-documentos" || (source.inventario?.recursos.some(
    (resource) => resource.unidadDocumental === "DOCUMENT_REPORT_SECTION",
  ) ?? false);
  const procurementAct = source.codigo === "mendoza-obras" || source.codigo === "general-rodriguez-documentos" || source.codigo === "tandil-documentos" || (source.inventario?.recursos.some(
    (resource) => resource.unidadDocumental === "PROCUREMENT_ACT_RECORD",
  ) ?? false);
  const sourceRecords = source.codigo === "general-pueyrredon-registros";
  const recordOnly = documentReport || procurementAct || sourceRecords;
  const recordsPublished = reportedRecordCounts
    ? reportedRecordCounts.porFuente.find((item) => item.codigo === source.codigo)?.cantidad ?? 0
    : null;
  const stateLabel =
    status === "ERROR"
      ? "Error de lectura"
      : status === "UNKNOWN"
        ? "Desconocido"
        : documentReport
          ? "Fuente de informes documentales"
        : procurementAct
          ? "Fuente de actos de contratación"
        : sourceRecords
          ? "Fuente de registros municipales informados"
        : published === 0
          ? "Fuente sin publicaciones"
          : located === 0
            ? "Publicadas; sin ubicación en el mapa"
            : unlocated && unlocated > 0
              ? "Hay publicaciones sin ubicación"
              : "Publicaciones disponibles";
  const scopeLabel =
    source.alcanceTerritorial?.nivel === "MUNICIPAL"
      ? `Fuente municipal · ${source.alcanceTerritorial.municipio?.nombre ?? "Municipio por confirmar"}`
      : source.alcanceTerritorial?.nivel === "MULTIPROVINCIAL"
        ? `Fuente de varias provincias · ${source.alcanceTerritorial.provincias.map((province) => province.nombre).join(" · ")}`
        : source.alcanceTerritorial?.nivel === "PROVINCIAL"
          ? "Fuente provincial"
          : source.alcanceTerritorial?.nivel === "NACIONAL"
            ? "Fuente nacional"
            : "Alcance por confirmar";
  return (
    <li data-source={source.codigo}>
      <details
        className="source-coverage-source"
        open={active ? true : undefined}
      >
        <summary>
          <h3>{source.nombre}</h3>
          <span className="source-coverage-published">
            {available && !recordOnly ? `${published} obras publicadas` : stateLabel}
          </span>
        </summary>
        <p className="source-coverage-scope">{scopeLabel}</p>
        <p className="source-coverage-status" data-status={status}>
          {stateLabel}
        </p>
        {available ? (
          <>
            <dl>
              <div>
                <dt>Obras consolidadas publicadas</dt>
                <dd>{published}</dd>
              </div>
              <div>
                <dt>Con ubicación aprobada</dt>
                <dd>{located}</dd>
              </div>
              <div>
                <dt>Sin ubicación en el mapa</dt>
                <dd>{unlocated}</dd>
              </div>
              {source.localidadesConObrasPublicadas !== null && (
                <div>
                  <dt>Localidades con obras publicadas</dt>
                  <dd>{source.localidadesConObrasPublicadas}</dd>
                </div>
              )}
            </dl>
            <p>Registros informados publicados: <strong>{recordsPublished ?? "No disponible"}</strong>
              {reportedRecordCounts && <> · catálogo de registros {reportedRecordCounts.catalogoVersion}</>}.</p>
            <p>
              {sourceRecords
                ? "Este corte conserva registros de distinta naturaleza, incluidos trabajos en vía pública y trámites relacionados. Se consultan por su unidad en el catálogo de registros informados."
                : documentReport
                ? "Las secciones de informes se consultan en el catálogo de registros. Este conteo corresponde a obras consolidadas y no cuenta secciones documentales."
                : procurementAct
                ? "Los actos de contratación se consultan en el catálogo de registros. Su publicación no acredita una obra única ni su estado de ejecución."
                : published === 0
                ? "Esta fuente no tiene publicaciones en este corte del catálogo."
                : located === 0
                  ? "Las publicaciones siguen disponibles en lista y ficha; no tienen ubicación aprobada para representarlas en el mapa."
                  : unlocated && unlocated > 0
                    ? `${unlocated} publicaciones siguen en lista y ficha sin ubicación aprobada para el mapa.`
                    : "Las publicaciones con ubicación aprobada pueden representarse en el mapa."}
            </p>
            {source.inventario && (
              <p>
                {sourceRecords
                  ? "El CSV conserva cuatro filas que informan Obra nueva y 214 trabajos o trámites. La publicación de sus registros no resuelve la identidad de una obra ni publica geometrías."
                  : source.inventario.recursos.some(
                  (resource) =>
                    resource.unidadDocumental ===
                    "COMPLETED_SCHOOL_BUILDING_RECORD",
                )
                  ? "El recurso principal describe edificios escolares finalizados."
                  : source.inventario.recursos.some(
                        (resource) =>
                          resource.unidadDocumental === "DOCUMENT_REPORT_SECTION",
                      )
                    ? "El recurso principal describe secciones de un informe documental; no acredita obras únicas ni ubicaciones aprobadas."
                  : source.inventario.recursos.some(
                        (resource) =>
                          resource.unidadDocumental === "PROCUREMENT_ACT_RECORD",
                      )
                    ? "El recurso principal describe actos de contratación; sus filas no acreditan obras únicas."
                  : source.inventario.recursos.some(
                        (resource) =>
                          resource.unidadDocumental === "WORK_RECORD",
                      )
                    ? "El recurso principal describe registros de obra."
                    : ""}{" "}
                {source.inventario.recursos.some(
                  (resource) =>
                    resource.unidadDocumental === "SPATIAL_LOCATION_RECORD",
                ) &&
                  "El recurso espacial describe localizaciones vinculadas; no agrega obras al conteo."}
              </p>
            )}
          </>
        ) : (
          <p>
            {status === "ERROR"
              ? "No se pudo consultar esta fuente. El error no significa que tenga cero publicaciones."
              : "No hay un conteo verificable para el mismo corte del listado; no se informa como cero."}
          </p>
        )}
      </details>
      <a
        href={sourceRecords
          ? reportedRecordsHref({ fuente: source.codigo })
          : procurementAct
          ? reportedRecordsHref({ fuente: source.codigo, tipo: "PROCUREMENT_ACT_RECORD" })
          : documentReport
          ? reportedRecordsHref({ fuente: source.codigo, tipo: "DOCUMENT_REPORT_SECTION" })
          : sourceListHref(source.codigo as keyof typeof SOURCES)}
        aria-current={active ? "page" : undefined}
      >
        {sourceRecords ? "Ver registros informados de esta fuente" : procurementAct ? "Ver actos de contratación de esta fuente" : documentReport ? "Ver secciones documentales de esta fuente" : "Ver listado de esta fuente"}
        <span className="sr-only">: {source.nombre}</span>
      </a>
      {source.codigo === "olavarria-obras" && <p><a href="/bases/olavarria-obras">Base derivada de Olavarría: estado, avisos y descarga</a></p>}
      {sourceRecords && <p><a href="/bases/general-pueyrredon-registros">Base derivada de General Pueyrredón: estado, avisos y descarga</a></p>}
    </li>
  );
}
