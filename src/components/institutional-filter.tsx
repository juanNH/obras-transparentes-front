/** @file Filtros HTML de organización, rol y solapamiento de vigencia, con catálogo institucional público independiente y recuperación progresiva. */
"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { InstitutionalOrganizationCatalog, ListQuery } from "../api/client";
import { readPublic } from "../lib/browser-api";
import { INSTITUTIONAL_ROLES } from "../lib/explorer-query";
import { MAX_INSTITUTIONAL_CATALOG_BYTES } from "../lib/institutional-organizations";

/** Mantiene la alternativa GET sin JavaScript y sólo ofrece identidades recibidas del catálogo público de roles verificados. */
export function InstitutionalFilter({ catalog: initial, query }: { catalog: InstitutionalOrganizationCatalog | null; query: ListQuery }) {
  const [catalog, setCatalog] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [periodFrom, setPeriodFrom] = useState(query.periodoDesde ?? "");
  const [periodTo, setPeriodTo] = useState(query.periodoHasta ?? "");
  const periodHelp = useId();
  const request = useRef<AbortController | null>(null);
  useEffect(() => { setHydrated(true); return () => request.current?.abort(); }, []);

  /** Reintenta sólo el catálogo institucional, conserva consulta/obras y cancela la lectura al desmontar. */
  async function retry() {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true);
    try {
      const next = await readPublic<InstitutionalOrganizationCatalog>("organizaciones-institucionales", AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]), MAX_INSTITUTIONAL_CATALOG_BYTES);
      if (!controller.signal.aborted) setCatalog(next);
    } catch { /* El error conserva los resultados y el control para recuperar esta lectura. */ }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }

  return <fieldset className="institutional-filter">
    <legend>Roles institucionales publicados</legend>
    <div className="institutional-controls">
    {catalog ? <label>Organización institucional verificada<select name="organizacionId" defaultValue={query.organizacionId ?? ""}>
      <option value="">Todas las organizaciones publicadas</option>
      {query.organizacionId && !catalog.items.some(organization => organization.id === query.organizacionId) && <option value={query.organizacionId}>Organización no disponible en el catálogo actual</option>}
      {catalog.items.map(organization => <option key={organization.id} value={organization.id}>{organization.nombre}</option>)}
    </select></label> : <div className="institutional-catalog-error">
      {query.organizacionId && <input type="hidden" name="organizacionId" value={query.organizacionId} />}
      <p role="status">{loading ? "Cargando organizaciones…" : "No pudimos cargar las organizaciones. Los resultados y los otros filtros siguen disponibles."}</p>
      <button type="button" className="button secondary" disabled={!hydrated || loading} onClick={() => void retry()}>Reintentar organizaciones</button>
      <noscript><p><a href="">Recargar la consulta para reintentar</a></p></noscript>
    </div>}
    <label>Rol institucional verificado<select name="rolInstitucional" defaultValue={query.rolInstitucional ?? ""}><option value="">Todos los roles</option>{Object.entries(INSTITUTIONAL_ROLES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Vigencia del rol desde<input name="periodoDesde" type="date" value={periodFrom} onChange={event => setPeriodFrom(event.target.value)} required={Boolean(periodTo)} max={periodTo || undefined} aria-describedby={periodHelp} /></label>
    <label>Vigencia del rol hasta<input name="periodoHasta" type="date" value={periodTo} onChange={event => setPeriodTo(event.target.value)} required={Boolean(periodFrom)} min={periodFrom || undefined} aria-describedby={periodHelp} /></label>
    </div>
    {catalog && <p className="party-filter-help">{catalog.items.length ? "Sólo se ofrecen organizaciones con roles verificados en publicaciones actuales." : "No hay organizaciones con roles verificados en publicaciones actuales."} El catálogo no acredita un padrón institucional exhaustivo.</p>}
    <p id={periodHelp} className="party-filter-help">Completá ambas fechas para consultar un período, o dejá ambas vacías. El período busca solapamiento con la vigencia del mismo rol y organización. No filtra las fechas de inicio o fin de la obra. Las fechas faltantes no expresan una vigencia ilimitada.</p>
  </fieldset>;
}
