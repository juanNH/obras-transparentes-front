/** @file Traslado explícito de fuente y territorio compatibles entre obras y registros informados. */
import type { ListQuery, PartyCatalog } from "../api/client";
import { reportedRecordParams, type ReportedRecordQuery } from "../api/reported-records";

/** Conserva filtros escalares compatibles sin transformar selecciones múltiples en una intersección diferente. */
export function recordsFromWorksHref(query: ListQuery, parties: PartyCatalog | null): string {
  const target: ReportedRecordQuery = {};
  if (query.fuente) target.fuente = query.fuente;
  if (query.provinciaCodigo?.length === 1) target.provinciaCodigo = query.provinciaCodigo[0]!;
  if (query.localidadCodigo?.length === 1) target.localidadCodigo = query.localidadCodigo[0]!;
  const partyIds = query.partidos ?? (query.partidoId ? [query.partidoId] : []);
  if (partyIds.length === 1) {
    const party = parties?.items.find(item => item.partidoId === partyIds[0]);
    if (party) target.partidoCodigo = party.codigos.indecDepartamento;
  }
  if (query.territorioEsquema === "pba.municipio" && query.municipioCodigo) {
    const party = parties?.items.find(item => item.equivalenciasPbaMunicipio.some(code => code.codigo === query.municipioCodigo));
    if (party) target.partidoCodigo = party.codigos.indecDepartamento;
  }
  const params = reportedRecordParams(target, false);
  return "/registros" + (params.size ? "?" + params.toString() : "");
}
