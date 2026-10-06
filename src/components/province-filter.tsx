/** @file Filtro opcional por provincias o ciudades autónomas mediante formulario HTML, sin restringir el catálogo global cuando no hay selección. */
"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ProvinceCatalog } from "../api/client";
import { readPublic } from "../lib/browser-api";

/** Presupuesto para la nómina de jurisdicciones, separado de obras y geometrías. */
const MAX_PROVINCE_CATALOG_BYTES = 32 * 1024;

/** Datos provinciales públicos y códigos aplicados; la omisión conserva la consulta global sin filtro provincial. */
export interface ProvinceFilterProps {
  catalog: ProvinceCatalog | null;
  provinciaCodigo?: readonly string[] | undefined;
}

/** Ofrece jurisdicciones explícitas sin selección inicial y preserva códigos aplicados durante una falla del catálogo. */
export function ProvinceFilter({ catalog: initial, provinciaCodigo }: ProvinceFilterProps) {
  const [catalog, setCatalog] = useState(initial);
  const appliedSelection = [...new Set(provinciaCodigo ?? [])].join(",");
  const [selected, setSelected] = useState<string[]>(appliedSelection ? appliedSelection.split(",") : []);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const request = useRef<AbortController | null>(null);
  const explanation = useId();
  useEffect(() => { setHydrated(true); return () => request.current?.abort(); }, []);
  useEffect(() => { setCatalog(initial); }, [initial]);
  useEffect(() => { setSelected(appliedSelection ? appliedSelection.split(",") : []); }, [appliedSelection]);

  /** Cambia códigos provinciales explícitos sin aplicar todavía la consulta de obras. */
  function toggleProvince(code: string, checked: boolean) {
    setSelected(current => checked ? [...new Set([...current, code])] : current.filter(value => value !== code));
  }

  /** Reintenta sólo la nómina provincial y conserva los códigos aplicados durante fallas o cancelaciones. */
  async function retry() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const next = await readPublic<ProvinceCatalog>("territorios/provincias", AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]), MAX_PROVINCE_CATALOG_BYTES);
      if (!controller.signal.aborted) setCatalog(next);
    } catch { /* Se conserva la consulta aplicada y no se reemplazan los resultados. */ }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }

  const items = catalog?.items ?? [];
  const unavailable = selected.filter(code => !items.some(item => item.codigo === code));
  return <fieldset className="province-filter" aria-describedby={explanation}>
    <legend>Provincia o ciudad autónoma</legend>
    {catalog && <ul className="province-options">
      {items.map(province => <li key={province.codigo}>
        <label><input type="checkbox" name="provinciaCodigo" value={province.codigo} checked={selected.includes(province.codigo)} onChange={event => toggleProvince(province.codigo, event.target.checked)} /><span>{province.nombre}</span></label>
      </li>)}
    </ul>}
    {unavailable.map(code => <input key={code} type="hidden" name="provinciaCodigo" value={code} />)}
    <p id={explanation} className="party-filter-help">Sin selección, se muestran todas las obras. La Ciudad Autónoma de Buenos Aires mantiene su identidad propia.</p>
    {!catalog && <div className="province-catalog-error">
      <p role="status">{loading ? "Cargando las provincias…" : "No pudimos cargar la nómina provincial. Se conserva la selección actual."}</p>
      <button type="button" className="button secondary" disabled={!hydrated || loading} onClick={() => void retry()}>{loading ? "Cargando provincias…" : "Reintentar nómina provincial"}</button>
      <noscript><p><a href="">Recargar la consulta para reintentar</a></p></noscript>
    </div>}
  </fieldset>;
}
