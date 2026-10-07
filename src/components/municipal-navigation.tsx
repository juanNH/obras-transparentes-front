/** @file Navegación explícita entre procedencias municipales; conserva los filtros sin atribuir territorio ni gestión. */
import type { ListQuery } from "../api/client";
import { municipalSourceHref } from "../lib/explorer-query";

/** Fuentes piloto disponibles como procedencia, aunque su catálogo todavía no tenga publicaciones. */
const MUNICIPAL_SOURCES = { "bahia-obras": "Bahía Blanca", "pergamino-obras": "Pergamino", "olavarria-obras": "Olavarría" } as const;

/** Cambia únicamente la procedencia y reinicia la página; la vista y los filtros activos permanecen explícitos en cada enlace. */
export function MunicipalNavigation({ query, view, showBoundaries }: { query: ListQuery; view: "lista" | "mapa"; showBoundaries: boolean }) {
  return <nav className="municipal-navigation" aria-label="Consultar fuentes municipales">
    <p><strong>Datos publicados por municipios</strong></p>
    <ul>{Object.entries(MUNICIPAL_SOURCES).map(([code, name]) => <li key={code}><a href={municipalSourceHref(query, code as keyof typeof MUNICIPAL_SOURCES, view, showBoundaries)} aria-current={query.fuente === code ? "page" : undefined}>{name}</a></li>)}</ul>
    <p className="results-footnote">Elegir un municipio cambia la fuente de los datos y conserva los demás filtros. La procedencia no acredita ubicación en ese partido ni gestión municipal. Los totales de las tres fuentes de arriba permiten abrir todas sus publicaciones.</p>
  </nav>;
}
