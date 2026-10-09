/** @file Permite buscar y desplegar fuentes agrupadas con HTML nativo, sin inferir ubicaciones ni sumar publicaciones por procedencia. */
"use client";
import { useState } from "react";
import { sourceListHref } from "../lib/explorer-query";
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
}: {
  coverage: readonly PublicSourceCoverage[];
  stale: boolean;
  activeSource?: PublicSourceCode | undefined;
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
            Podés abrir cada provincia y sus fuentes sin JavaScript. La búsqueda
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
}: {
  source: PublicSourceCoverage;
  stale: boolean;
  active: boolean;
}) {
  const status =
    stale && source.estado === "AVAILABLE" ? "UNKNOWN" : source.estado;
  const available = status === "AVAILABLE";
  const published = source.obrasPublicadas;
  const located = source.obrasConGeometria;
  const unlocated = source.obrasSinGeometria;
  const stateLabel =
    status === "ERROR"
      ? "Error de lectura"
      : status === "UNKNOWN"
        ? "Desconocido"
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
            {available ? `${published} publicadas` : stateLabel}
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
                <dt>Publicadas</dt>
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
            <p>
              {published === 0
                ? "Esta fuente no tiene publicaciones en este corte del catálogo."
                : located === 0
                  ? "Las publicaciones siguen disponibles en lista y ficha; no tienen ubicación aprobada para representarlas en el mapa."
                  : unlocated && unlocated > 0
                    ? `${unlocated} publicaciones siguen en lista y ficha sin ubicación aprobada para el mapa.`
                    : "Las publicaciones con ubicación aprobada pueden representarse en el mapa."}
            </p>
            {source.inventario && (
              <p>
                {source.inventario.recursos.some(
                  (resource) =>
                    resource.unidadDocumental ===
                    "COMPLETED_SCHOOL_BUILDING_RECORD",
                )
                  ? "El recurso principal describe edificios escolares finalizados."
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
        href={sourceListHref(source.codigo)}
        aria-current={active ? "page" : undefined}
      >
        Ver listado de esta fuente
        <span className="sr-only">: {source.nombre}</span>
      </a>
    </li>
  );
}
