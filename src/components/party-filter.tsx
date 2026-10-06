/** @file Selector territorial HTML con búsqueda progresiva local y recuperación del catálogo oficial, sin asignar cobertura ni gestión municipal. */
"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { PartyCatalog } from "../api/client";
import { readPublic } from "../lib/browser-api";
import { matchingParties, MAX_PARTY_CATALOG_BYTES } from "../lib/party-catalog";

/** Datos versionados recibidos en servidor e identidad del partido aplicado a la consulta. */
export interface PartyFilterProps {
  catalog: PartyCatalog | null;
  partidoId?: string | undefined;
  partidoVerificadoId?: string | undefined;
  gestionMunicipalId?: string | undefined;
  showReported?: boolean;
}

/** Mantiene un select nativo completo sin JavaScript y permite buscar/reintentar sin cambiar obras antes de aplicar el formulario. */
export function PartyFilter({ catalog: initial, partidoId, partidoVerificadoId, gestionMunicipalId, showReported = true }: PartyFilterProps) {
  const [catalog, setCatalog] = useState(initial);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(partidoId ?? "");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const request = useRef<AbortController | null>(null);
  const control = useId();
  const explanation = useId();
  useEffect(() => { setHydrated(true); return () => request.current?.abort(); }, []);

  /** Recupera sólo la nómina territorial; conserva la consulta aplicada y cancela la lectura al desmontar. */
  async function retry() {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true);
    try {
      const next = await readPublic<PartyCatalog>("territorios/pba/partidos", AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]), MAX_PARTY_CATALOG_BYTES);
      if (!controller.signal.aborted) setCatalog(next);
    } catch { /* La recuperación permanece disponible y los resultados no se reemplazan. */ }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }

  if (!catalog) return <div className="party-filter">
    {partidoId && <input type="hidden" name="partidoId" value={partidoId} />}
    {partidoVerificadoId && <input type="hidden" name="partidoVerificadoId" value={partidoVerificadoId} />}
    {gestionMunicipalId && <input type="hidden" name="gestionMunicipalId" value={gestionMunicipalId} />}
    <p role="status">{loading ? "Cargando la nómina de partidos…" : "No pudimos cargar la nómina de partidos. Podés consultar los resultados y reintentar la selección."}</p>
    <button type="button" className="button secondary" disabled={!hydrated || loading} onClick={() => void retry()}>{loading ? "Cargando partidos…" : "Reintentar nómina de partidos"}</button>
    <noscript><p><a href="">Recargar la consulta para reintentar</a></p></noscript>
  </div>;

  const matches = matchingParties(catalog, search);
  const selectedParty = catalog.items.find(party => party.partidoId === selected);
  const options = selectedParty && !matches.includes(selectedParty) ? [selectedParty, ...matches] : matches;
  return <div className="party-filter">
    {showReported && <><label>Buscar partido (opcional)<input type="search" maxLength={100} value={search} disabled={!hydrated} onChange={event => setSearch(event.target.value)} aria-controls={control} placeholder="Nombre o código" /></label>
    <label htmlFor={control}>Partido de Buenos Aires</label>
    <select id={control} name="partidoId" value={selected} onChange={event => setSelected(event.target.value)} aria-describedby={explanation}>
      <option value="">Sin filtro por partido</option>
      {selected && !selectedParty && <option value={selected}>Partido no disponible en esta versión</option>}
      {options.map(party => <option key={party.partidoId} value={party.partidoId}>{party.nombre}</option>)}
    </select>
    {search && <p role="status">{matches.length} {matches.length === 1 ? "partido coincide" : "partidos coinciden"} con la búsqueda. Elegí uno y aplicá los filtros.</p>}
    <p id={explanation} className="party-filter-help">{catalog.items.length} partidos disponibles. El filtro usa el partido informado por la fuente; no acredita gestión municipal ni ubicación espacial verificada.</p></>}
    <label>Partido con ubicación verificada<select name="partidoVerificadoId" defaultValue={partidoVerificadoId ?? ""}>
      <option value="">Sin filtro de ubicación verificada</option>
      {partidoVerificadoId && !catalog.items.some(party => party.partidoId === partidoVerificadoId) && <option value={partidoVerificadoId}>Partido no disponible en esta versión</option>}
      {catalog.items.map(party => <option key={party.partidoId} value={party.partidoId}>{party.nombre}</option>)}
    </select></label>
    <p className="party-filter-help">Usa asociaciones espaciales verificadas y publicadas para la revisión; los límites visuales del mapa no verifican obras.</p>
    <label>Gestión municipal verificada<select name="gestionMunicipalId" defaultValue={gestionMunicipalId ?? ""}>
      <option value="">Sin filtro de gestión municipal</option>
      {gestionMunicipalId && !catalog.items.some(party => party.partidoId === gestionMunicipalId) && <option value={gestionMunicipalId}>Partido no disponible en esta versión</option>}
      {catalog.items.map(party => <option key={party.partidoId} value={party.partidoId}>{party.nombre}</option>)}
    </select></label>
    <p className="party-filter-help">Requiere una organización municipal con rol verificado de promotor, contratante, ejecutor o financiador. Una ubicación en el partido no acredita ese rol.</p>
    <details className="party-filter-help"><summary>Referencia de la nómina</summary><p>Versión {catalog.version}. Consulta de la nómina: {catalog.consultadoEn}.</p><ul>{catalog.fuentes.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.nombre}</a> · <a href={source.licencia.url} target="_blank" rel="noreferrer">{source.licencia.nombre}</a></li>)}</ul></details>
  </div>;
}
