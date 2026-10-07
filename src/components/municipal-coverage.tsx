/** @file Explica publicaciones y disponibilidad cartográfica de las fuentes piloto con totales públicos globales en HTML. */
import type { MunicipalCoverage } from "../api/client";

/** Presenta un corte global al abrir la consulta; los enlaces cambian explícitamente a lista por fuente y descartan filtros previos. */
export function MunicipalCoveragePanel({ coverage, error }: { coverage: MunicipalCoverage | null; error: "UNAVAILABLE" | "CATALOG_CHANGED" | null }) {
  return <section className="municipal-coverage" aria-labelledby="municipal-coverage-title">
    <h2 id="municipal-coverage-title">Fuentes municipales piloto: publicaciones y mapa</h2>
    {coverage ? <>
      <p className="results-footnote">Totales de estas tres fuentes en el catálogo público al abrir esta consulta; no cambian con los filtros ni el área del mapa. La fuente de los datos no acredita quién gestiona la obra.</p>
      <ul className="municipal-coverage-list">{coverage.fuentes.map(source => <li key={source.fuenteId}>
        <h3>{source.nombre}</h3>
        <dl>
          <div><dt>Publicadas</dt><dd>{source.obrasPublicadas}</dd></div>
          <div><dt>Con ubicación aprobada</dt><dd>{source.obrasConGeometria}</dd></div>
          <div><dt>Sin ubicación en el mapa</dt><dd>{source.obrasSinGeometria}</dd></div>
        </dl>
        <p>{source.obrasPublicadas === 0 ? "Esta fuente todavía no tiene obras publicadas." : source.obrasConGeometria === 0 ? "Sus obras están publicadas y se consultan en lista y ficha. Todavía no tienen una ubicación aprobada para el mapa." : "Las obras con ubicación aprobada pueden representarse en el mapa; el área y los filtros de la consulta determinan cuáles se cargan."}</p>
        {source.obrasPublicadas > 0 && <a href={`/mapa?${new URLSearchParams({ fuente: source.codigo, vista: "lista" })}`}>Ver publicaciones de esta fuente<span className="sr-only">: {source.nombre}</span></a>}
      </li>)}</ul>
    </> : <p className="results-footnote">{error === "CATALOG_CHANGED" ? "El catálogo cambió durante la lectura. Actualizá la consulta para ver totales y publicaciones de la misma versión." : "No se pudieron consultar los totales municipales. Esto no significa que sean cero; podés seguir consultando la lista y el mapa."} <a href="">Actualizar consulta</a></p>}
  </section>;
}
