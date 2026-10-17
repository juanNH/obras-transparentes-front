/** @file Filtros territoriales por nombres con catálogos públicos, URLs estables y formulario HTML sin exigir códigos al visitante. */
import type { LocalityCatalog, PartyCatalog, ProvinceCatalog } from "../api/client";
import type { ReportedRecordQuery } from "../api/reported-records";

/** Opciones nominales independientes de la existencia de registros y de sus geometrías. */
type TerritoryFilterProps = {
  query: ReportedRecordQuery;
  provinces: ProvinceCatalog | null;
  parties: PartyCatalog | null;
  localities: LocalityCatalog | null;
};

/** Conserva un filtro compartido si falta su catálogo; el código es sólo una referencia de recuperación. */
function missingOption(value: string | undefined, present: boolean) {
  return value && !present ? <option value={value}>Selección del enlace ({value}); nombre no disponible</option> : null;
}

/** Ofrece nombres oficiales; elegir provincia y aplicar carga sus localidades sin JavaScript obligatorio. */
export function ReportedRecordTerritoryFilters({ query, provinces, parties, localities }: TerritoryFilterProps) {
  const provinceOptions = provinces?.items ?? [];
  const partyOptions = parties?.items ?? [];
  const localityOptions = (localities?.items ?? []).filter(locality => !query.partidoCodigo || locality.departamentoCodigo === query.partidoCodigo);
  return <fieldset className="record-territory-filters">
    <legend>Territorio informado</legend>
    <label>Disponibilidad del territorio<select name="territorio" defaultValue={query.territorio ?? ""}>
      <option value="">Con o sin territorio informado</option>
      <option value="UNKNOWN">Territorio no informado</option>
    </select></label>
    <label>Provincia informada<select name="provinciaCodigo" defaultValue={query.provinciaCodigo ?? ""}>
      <option value="">Todas las provincias</option>
      {missingOption(query.provinciaCodigo, provinceOptions.some(item => item.codigo === query.provinciaCodigo))}
      {provinceOptions.map(item => <option key={item.codigo} value={item.codigo}>{item.nombre}</option>)}
    </select></label>
    <label>Partido bonaerense informado<select name="partidoCodigo" defaultValue={query.partidoCodigo ?? ""}>
      <option value="">Todos los partidos</option>
      {missingOption(query.partidoCodigo, partyOptions.some(item => item.codigos.indecDepartamento === query.partidoCodigo))}
      {partyOptions.map(item => <option key={item.partidoId} value={item.codigos.indecDepartamento}>{item.nombre}</option>)}
    </select></label>
    <label>Localidad informada<select name="localidadCodigo" defaultValue={query.localidadCodigo ?? ""}>
      <option value="">Todas las localidades</option>
      {missingOption(query.localidadCodigo, localityOptions.some(item => item.codigo === query.localidadCodigo))}
      {localityOptions.map(item => <option key={item.codigo} value={item.codigo}>{item.nombre} · {item.departamentoNombre}</option>)}
    </select></label>
    <p className="muted">Elegí una provincia y aplicá los filtros para cargar sus localidades. Para consultar territorio no informado, dejá provincia, partido y localidad en «Todos». Los nombres provienen del catálogo territorial; no garantizan que haya registros publicados.</p>
    {(!provinces || !parties || (query.provinciaCodigo && !localities)) && <p className="notice">Una referencia territorial no pudo cargarse. Podés seguir consultando los registros y volver a intentar.</p>}
  </fieldset>;
}
