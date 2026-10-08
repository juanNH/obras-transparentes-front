/** @file Presenta cobertura por fuente con estados explícitos, corte de catálogo compartido y acceso directo a lista. */
import { sourceListHref } from "../lib/explorer-query";
import type { PublicSourceCoverage } from "../lib/source-coverage";

/** Renderiza cifras globales sólo para fuentes verificadas contra la versión actual del listado. */
export function SourceCoveragePanel({ coverage, catalogoVersion, stale = false }: { coverage: readonly PublicSourceCoverage[]; catalogoVersion: string | null; stale?: boolean }) {
  return <section className="source-coverage" aria-labelledby="source-coverage-title">
    <h2 id="source-coverage-title">Publicaciones por fuente y disponibilidad en el mapa</h2>
    <p className="results-footnote">Conteos globales del catálogo público; no cambian con filtros, área o paginación. La fuente de datos no acredita quién ejecuta o financia una obra. {catalogoVersion && !stale ? <>Las cifras visibles comparten corte con el listado y las fichas: versión <strong>{catalogoVersion}</strong>.</> : "La versión común con el listado no está confirmada; las cifras quedan como desconocidas."}</p>
    <p className="results-footnote">Una obra puede estar vinculada a varias fuentes: sus cantidades no se suman para obtener obras únicas.</p>
    {stale && <p className="source-coverage-notice" role="status">El catálogo cambió durante la consulta. Actualizá para volver a comparar las fuentes con el listado.</p>}
    <ul className="source-coverage-list">{coverage.map(source => {
      const status = stale && source.estado === "AVAILABLE" ? "UNKNOWN" : source.estado;
      const available = status === "AVAILABLE";
      const published = source.obrasPublicadas;
      const located = source.obrasConGeometria;
      const unlocated = source.obrasSinGeometria;
      const stateLabel = status === "ERROR" ? "Error de lectura" : status === "UNKNOWN" ? "Desconocido" : published === 0 ? "Fuente sin publicaciones" : located === 0 ? "Publicadas; sin ubicación en el mapa" : unlocated && unlocated > 0 ? "Hay publicaciones sin ubicación" : "Publicaciones disponibles";
      return <li key={source.codigo}>
        <h3>{source.nombre}</h3>
        <p className="source-coverage-status" data-status={status}>{stateLabel}</p>
        {available ? <>
          <dl>
            <div><dt>Publicadas</dt><dd>{published}</dd></div>
            <div><dt>Con ubicación aprobada</dt><dd>{located}</dd></div>
            <div><dt>Sin ubicación en el mapa</dt><dd>{unlocated}</dd></div>
          </dl>
          <p>{published === 0 ? "Esta fuente no tiene publicaciones en este corte del catálogo." : located === 0 ? "Las publicaciones siguen disponibles en lista y ficha; no tienen ubicación aprobada para representarlas en el mapa." : unlocated && unlocated > 0 ? `${unlocated} publicaciones siguen en lista y ficha sin ubicación aprobada para el mapa.` : "Las publicaciones con ubicación aprobada pueden representarse en el mapa."}</p>
          {source.inventario && <p>{source.inventario.recursos.some(resource => resource.unidadDocumental === "COMPLETED_SCHOOL_BUILDING_RECORD") ? "El recurso principal describe edificios escolares finalizados." : "El recurso principal describe registros de obra."} {source.inventario.recursos.some(resource => resource.unidadDocumental === "SPATIAL_LOCATION_RECORD") && "El recurso espacial describe localizaciones vinculadas; no agrega obras al conteo."}</p>}
        </> : <p>{status === "ERROR" ? "No se pudo consultar esta fuente. El error no significa que tenga cero publicaciones." : "No hay un conteo verificable para el mismo corte del listado; no se informa como cero."}</p>}
        <a href={sourceListHref(source.codigo)}>Ver listado de esta fuente<span className="sr-only">: {source.nombre}</span></a>
      </li>;
    })}</ul>
    {(stale || coverage.some(source => source.estado !== "AVAILABLE")) && <a className="button secondary source-coverage-retry" href="">Actualizar consulta</a>}
  </section>;
}
