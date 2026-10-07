/** @file Conteos del catálogo filtrado independientes de paginación; el área sólo clasifica publicaciones con ubicación aprobada. */
import type { ListQuery, WorkCounts } from "../api/client";
import { unlocatedListHref } from "../lib/explorer-query";

/** Presenta cifras coherentes con la lista o un estado desconocido; nunca asigna al área las obras sin geometría. */
export function WorkCountsPanel({ counts, error, query }: { counts: WorkCounts | null; error: "UNAVAILABLE" | "CATALOG_CHANGED" | null; query: ListQuery }) {
  return <section className="work-counts" aria-labelledby="work-counts-title">
    <h2 id="work-counts-title">Cuántas obras podés consultar</h2>
    {counts ? <>
      <p className="results-footnote">Totales con los filtros de fuente, territorio, estado y roles elegidos. No dependen de las páginas cargadas, del área ni del filtro de disponibilidad de ubicación. Cada obra se cuenta una vez.</p>
      <dl className="work-counts-values">
        <div><dt>Publicadas</dt><dd>{counts.totalPublicadas}</dd></div>
        <div><dt>Con ubicación aprobada</dt><dd>{counts.totalConGeometria}</dd></div>
        <div><dt>Sin ubicación en el mapa</dt><dd>{counts.totalSinGeometria}</dd></div>
        {counts.area && <>
          <div><dt>Con ubicación dentro del área consultada</dt><dd>{counts.area.obrasEnMapa}</dd></div>
          <div><dt>Con ubicación fuera del área consultada</dt><dd>{counts.area.obrasFueraDelArea}</dd></div>
        </>}
      </dl>
      {counts.area ? <p><strong>{counts.totalSinGeometria} {counts.totalSinGeometria === 1 ? "obra sin ubicación no puede asignarse" : "obras sin ubicación no pueden asignarse"} a esta área.</strong> El total dentro del área indica ubicaciones aprobadas que la intersectan; el mapa puede cargar menos obras por sus límites de lectura o representación.</p> : <p>Las publicaciones sin ubicación siguen disponibles en lista y ficha. Tener ubicación aprobada permite representar una obra; el encuadre y los límites del mapa determinan cuáles se ven.</p>}
    </> : <p>{error === "CATALOG_CHANGED" ? "El catálogo cambió durante la lectura. Actualizá la consulta para ver cifras de la misma versión." : "No se pudieron consultar los conteos. Los totales son desconocidos; esto no significa que sean cero."} <a href="">Actualizar conteos</a></p>}
    <a href={unlocatedListHref(query)}>Consultar publicaciones sin ubicación<span className="sr-only"> conservando los demás filtros y quitando el área</span></a>
  </section>;
}
