/** @file Selección múltiple de partidos reportados con formulario HTML, búsqueda local y recuperación del padrón; conserva separados ubicación y gestión verificadas. */
"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { PartyCatalog } from "../api/client";
import { readPublic } from "../lib/browser-api";
import { matchingParties, MAX_PARTY_CATALOG_BYTES } from "../lib/party-catalog";

/** Datos versionados recibidos en servidor e identidad del partido aplicado a la consulta. */
export interface PartyFilterProps {
  catalog: PartyCatalog | null;
  partidos?: readonly string[] | undefined;
  partidoId?: string | undefined;
  partidoVerificadoId?: string | undefined;
  gestionMunicipalId?: string | undefined;
  showReported?: boolean;
}

/** Ofrece los 135 checkboxes en HTML y conserva seleccionados al buscar o recuperar la nómina, hasta aplicar el formulario. */
export function PartyFilter({ catalog: initial, partidos, partidoId, partidoVerificadoId, gestionMunicipalId, showReported = true }: PartyFilterProps) {
  const [catalog, setCatalog] = useState(initial);
  const [search, setSearch] = useState("");
  const appliedSelection = [...new Set(partidos ?? (partidoId ? [partidoId] : []))].join(",");
  const [selected, setSelected] = useState<string[]>(appliedSelection ? appliedSelection.split(",") : []);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const request = useRef<AbortController | null>(null);
  const selectionSummary = useRef<HTMLElement | null>(null);
  const control = useId();
  const explanation = useId();
  useEffect(() => { setHydrated(true); return () => request.current?.abort(); }, []);
  useEffect(() => { setSelected(appliedSelection ? appliedSelection.split(",") : []); }, [appliedSelection]);
  useEffect(() => { setCatalog(initial); }, [initial]);

  /** Cambia sólo la selección reportada; los filtros de ubicación y gestión mantienen su valor propio. */
  function toggleParty(id: string, checked: boolean) {
    setSelected(current => checked ? [...new Set([...current, id])] : current.filter(value => value !== id));
  }

  /** Retira una selección y devuelve el foco al selector plegable, sin abrirlo ni enviar el formulario. */
  function removeParty(id: string) {
    toggleParty(id, false);
    selectionSummary.current?.focus();
  }

  /** Limpia partidos reportados y búsqueda local sin alterar otros controles ni resultados aplicados. */
  function clearReported() {
    setSelected([]);
    setSearch("");
    selectionSummary.current?.focus();
  }

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

  /** Presenta una selección removible sin crear controles de formulario duplicados; mantiene el foco en el selector. */
  function selectedChip(id: string) {
    const party = catalog?.items.find(item => item.partidoId === id);
    const name = party?.nombre ?? "Partido no disponible en esta versión";
    return <li key={id}><span>{name}</span><button type="button" disabled={!hydrated} onClick={() => removeParty(id)} aria-label={`Quitar ${name} del filtro de partidos`}>Quitar</button></li>;
  }

  if (!catalog) return <div className="party-filter">
    {showReported && selected.map(id => <input key={id} type="hidden" name="partidos" value={id} />)}
    {partidoVerificadoId && <input type="hidden" name="partidoVerificadoId" value={partidoVerificadoId} />}
    {gestionMunicipalId && <input type="hidden" name="gestionMunicipalId" value={gestionMunicipalId} />}
    <p role="status">{loading ? "Cargando la nómina de partidos…" : "No pudimos cargar la nómina de partidos. Podés consultar los resultados y reintentar la selección."}</p>
    <button type="button" className="button secondary" disabled={!hydrated || loading} onClick={() => void retry()}>{loading ? "Cargando partidos…" : "Reintentar nómina de partidos"}</button>
    <noscript><p><a href="">Recargar la consulta para reintentar</a></p></noscript>
  </div>;

  const matches = matchingParties(catalog, search);
  const matchingIds = new Set(matches.map(party => party.partidoId));
  const unavailable = selected.filter(id => !catalog.items.some(party => party.partidoId === id));
  return <div className="party-filter">
    {showReported && <fieldset className="reported-party-filter" aria-describedby={explanation}>
      <legend>Partidos de Buenos Aires</legend>
      <p id={explanation} className="party-filter-help">Opcional. Usa el partido informado por la fuente; no acredita ubicación verificada ni gestión municipal.</p>
      <div className="party-selection-summary">
        <p role="status">{selected.length ? `${selected.length} ${selected.length === 1 ? "partido seleccionado" : "partidos seleccionados"}.` : "Todos los partidos."}</p>
        <button type="button" className="button secondary party-clear" disabled={!hydrated || (!selected.length && !search)} onClick={clearReported}>Limpiar partidos</button>
      </div>
      {selected.length > 0 && <ul className="party-selected" aria-label="Partidos seleccionados">
        {selected.slice(0, 6).map(selectedChip)}
      </ul>}
      {selected.length > 6 && <details className="party-selected-overflow">
        <summary>Ver todos los partidos seleccionados</summary>
        <ul className="party-selected" aria-label="Otros partidos seleccionados">{selected.slice(6).map(selectedChip)}</ul>
      </details>}
      {unavailable.map(id => <input key={id} type="hidden" name="partidos" value={id} />)}
      <details className="party-picker">
      <summary ref={selectionSummary}>Seleccionar partidos{selected.length > 0 && <span className="muted"> · {selected.length} {selected.length === 1 ? "seleccionado" : "seleccionados"}</span>}</summary>
      <div className="party-picker-content">
      <label>Buscar partido (opcional)<input type="search" maxLength={100} value={search} disabled={!hydrated} onChange={event => setSearch(event.target.value)} aria-controls={control} placeholder="Nombre o código" /></label>
      <ul id={control} className="party-options" aria-label="Partidos disponibles">
        {catalog.items.map(party => <li key={party.partidoId} hidden={!matchingIds.has(party.partidoId)}>
          <label><input type="checkbox" name="partidos" value={party.partidoId} checked={selected.includes(party.partidoId)} onChange={event => toggleParty(party.partidoId, event.target.checked)} /><span>{party.nombre}</span></label>
        </li>)}
      </ul>
      {search && <p className="party-filter-help" role="status">{matches.length} {matches.length === 1 ? "partido coincide" : "partidos coinciden"} con la búsqueda. Los partidos seleccionados se conservan.</p>}
      <noscript><p className="party-filter-help">La nómina completa está disponible. Marcá los partidos y aplicá los filtros.</p></noscript>
      </div>
      </details>
    </fieldset>}
    <details className="territorial-advanced" open={Boolean(partidoVerificadoId || gestionMunicipalId)}>
    <summary>Filtros territoriales avanzados</summary>
    <div className="territorial-advanced-content">
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
    </div>
    </details>
  </div>;
}
