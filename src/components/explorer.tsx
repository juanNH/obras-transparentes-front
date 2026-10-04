"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BoundingBox, ListQuery, WorkDetail, WorkGeoJSON, WorkList } from "../api/client";
import { BrowserApiError, readPublic } from "../lib/browser-api";
import { DEFAULT_BBOX, SOURCES, STATES, explorerHref, queryParams } from "../lib/explorer-query";
import type { ExplorerQuery } from "../lib/explorer-query";
import { limitMapFeatures } from "../lib/map-budget";
import "./explorer.css";

const WorkMap = dynamic(() => import("./work-map"), { ssr: false, loading: () => <p className="notice" role="status">Cargando el mapa… La lista sigue disponible.</p> });
const WorkDetailContent = dynamic(() => import("./work-detail").then(module => module.WorkDetailContent), { ssr: false, loading: () => <p role="status">Preparando el resumen…</p> });
type Selection = { id: string; revisionId?: string };
const MAX_FEATURES = 500;

export function Explorer({ initial, initialError, state, styleUrl }: { initial: WorkList | null; initialError: string | null; state: ExplorerQuery; styleUrl: string }) {
  const router = useRouter();
  const { query, view } = state;
  const [hydrated, setHydrated] = useState(false);
  const [items, setItems] = useState(initial?.items ?? []);
  const [cursor, setCursor] = useState(initial?.nextCursor ?? null);
  const [listError, setListError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const [features, setFeatures] = useState<WorkGeoJSON["features"]>([]);
  const [mapMessage, setMapMessage] = useState("");
  const [mapLoading, setMapLoading] = useState(false);
  const [candidate, setCandidate] = useState<BoundingBox>(query.bbox ?? DEFAULT_BBOX);
  const [focusBBox, setFocusBBox] = useState<BoundingBox | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [selection, setSelection] = useState<Selection | null>(state.obra ? { id: state.obra, ...(state.revisionId ? { revisionId: state.revisionId } : {}) } : null);
  const [detail, setDetail] = useState<WorkDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const listRequest = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const paginationCursors = useRef(new Set<string>());
  const version = initial?.catalogoVersion;
  const mismatch = listError === "CATALOG_CHANGED";
  const { cursor: _cursor, ...firstQuery } = query;
  const firstHref = explorerHref(firstQuery, view);

  const invalidate = useCallback(() => {
    listRequest.current?.abort();
    setItems([]); setCursor(null); setFeatures([]); setListError("CATALOG_CHANGED"); setSelection(null);
  }, []);
  useEffect(() => { setHydrated(true); alive.current = true; return () => { alive.current = false; listRequest.current?.abort(); }; }, []);

  useEffect(() => {
    if (view !== "mapa" || !initial || mismatch || query.tieneGeometria === false) return;
    const controller = new AbortController();
    let cancelled = false;
    setMapLoading(true); setMapMessage(""); setFeatures([]);
    const load = async () => {
      let next: string | null = null;
      const seen = new Set<string>();
      const collected: WorkGeoJSON["features"] = [];
      let bytes = 0;
      let pages = 0;
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
      do {
        const geoQuery: ListQuery = { ...query, bbox: query.bbox ?? DEFAULT_BBOX };
        delete geoQuery.cursor;
        if (next) geoQuery.cursor = next;
        const page = await readPublic<WorkGeoJSON>("geojson?" + queryParams(geoQuery), signal, 2 * 1024 * 1024 - bytes);
        pages++;
        if (cancelled) return;
        if (page.catalogoVersion !== version) { invalidate(); return; }
        bytes += new TextEncoder().encode(JSON.stringify(page)).byteLength;
        collected.push(...page.features);
        next = page.nextCursor;
        if (next && seen.has(next)) throw new Error("La paginación del mapa no pudo completarse.");
        if (next) seen.add(next);
      } while (next && collected.length < MAX_FEATURES && pages < 5);
      if (cancelled) return;
      const budget = limitMapFeatures(collected);
      setFeatures(budget.features);
      if (next || budget.truncated) setMapMessage("Mapa parcial: hay más ubicaciones o geometrías demasiado grandes. Acercá la zona o recorré todas las páginas de la lista.");
      else if (!collected.length) setMapMessage("No hay ubicaciones publicadas para esta zona y estos filtros.");
    };
    void load().catch(error => {
      if (cancelled || controller.signal.aborted) return;
      if (error instanceof BrowserApiError && error.code === "CATALOG_CHANGED") invalidate();
      else setMapMessage(error instanceof Error ? error.message : "No se pudieron cargar las ubicaciones. Usá la lista.");
    }).finally(() => { if (!cancelled) setMapLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [view, initial, mismatch, query, version, invalidate]);

  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("obra")?.toLowerCase(); const revisionId = params.get("revisionId")?.toLowerCase();
      setSelection(id ? { id, ...(revisionId ? { revisionId } : {}) } : null);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  useEffect(() => {
    if (!selection) { dialog.current?.close(); setDetail(null); return; }
    dialog.current?.showModal();
    setDetail(null); setDetailError("");
    const controller = new AbortController();
    const suffix = selection.revisionId ? "?revisionId=" + encodeURIComponent(selection.revisionId) : "";
    void readPublic<WorkDetail>("obras/" + encodeURIComponent(selection.id) + suffix, controller.signal).then(work => {
      if (controller.signal.aborted) return;
      if (work.obraId !== selection.id || (selection.revisionId && work.revisionId !== selection.revisionId)) throw new Error("La ficha recibida no coincide con la selección.");
      setDetail(work);
    }).catch(error => { if (!controller.signal.aborted) setDetailError(error instanceof Error ? error.message : "No se pudo cargar esta ficha."); });
    return () => controller.abort();
  }, [selection]);

  function select(id: string, revisionId: string) {
    setSelection({ id, revisionId }); setExpanded(false);
    const url = new URL(window.location.href);
    url.searchParams.set("obra", id); url.searchParams.set("revisionId", revisionId);
    window.history.pushState(null, "", url);
  }
  function closeDetail() {
    setSelection(null);
    const url = new URL(window.location.href); url.searchParams.delete("obra"); url.searchParams.delete("revisionId");
    window.history.replaceState(null, "", url);
  }
  async function loadMore() {
    if (!cursor || loading || mismatch) return;
    if (paginationCursors.current.has(cursor)) { setListError("PAGINATION_ERROR"); return; }
    const controller = new AbortController(); listRequest.current = controller;
    setLoading(true); setListError(null);
    try {
      const page = await readPublic<WorkList>("obras?" + queryParams({ ...query, cursor }), controller.signal);
      if (page.catalogoVersion !== version) { invalidate(); return; }
      paginationCursors.current.add(cursor);
      setItems(previous => {
        const ids = new Set(previous.map(work => work.obraId));
        return [...previous, ...page.items.filter(work => !ids.has(work.obraId))];
      });
      setCursor(page.nextCursor);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof BrowserApiError && error.code === "CATALOG_CHANGED") invalidate();
      else setListError("UNAVAILABLE");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }
  function navigateView(next: "lista" | "mapa") {
    // Opening a map does not claim that unlocated works belong to its extent.
    const nextQuery = { ...firstQuery };
    if (next === "mapa" && nextQuery.tieneGeometria === false) delete nextQuery.tieneGeometria;
    if (next === "mapa" && !nextQuery.bbox) nextQuery.bbox = DEFAULT_BBOX;
    router.push(explorerHref(nextQuery, next), { scroll: false });
  }
  function searchArea() {
    const nextQuery = { ...firstQuery, bbox: candidate };
    delete nextQuery.tieneGeometria;
    router.push(explorerHref(nextQuery, "mapa"), { scroll: false });
  }
  function useLocation() {
    if (!navigator.geolocation) { setLocationMessage("Tu navegador no ofrece ubicación. Podés mover el mapa o usar la lista."); return; }
    setLocating(true); setLocationMessage("Esperando tu permiso. Tu ubicación no se guarda en el enlace automáticamente.");
    navigator.geolocation.getCurrentPosition(position => {
      if (!alive.current) return;
      const { longitude: lon, latitude: lat } = position.coords;
      const box: BoundingBox = [Math.max(-180, lon - 0.03), Math.max(-85, lat - 0.03), Math.min(180, lon + 0.03), Math.min(85, lat + 0.03)];
      if (box[0] >= box[2] || box[1] >= box[3]) { setLocating(false); setLocationMessage("Ubicación fuera del área representable. Usá la lista."); return; }
      setFocusBBox(box); setCandidate(box); setLocating(false);
      setLocationMessage("Mapa centrado cerca tuyo. Buscar en esta zona incorporará esa área al enlace y la enviará al catálogo. Podés mover el mapa antes.");
    }, () => { if (alive.current) { setLocating(false); setLocationMessage("No pudimos obtener tu ubicación. Podés mover el mapa o explorar todas las obras en la lista."); } }, { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 });
  }
  async function share() {
    const url = new URL(window.location.href); url.searchParams.delete("cursor");
    try { await navigator.clipboard.writeText(url.href); setShareMessage("Enlace copiado."); }
    catch { setShareMessage("Podés copiar el enlace desde la barra de direcciones del navegador."); }
  }
  const clearArea = { ...firstQuery }; delete clearArea.bbox;
  const hasData = Boolean(initial);
  const activeFilters = [query.fuente, query.estado, query.sector, query.tieneGeometria, query.territorioEsquema].filter(value => value !== undefined).length;

  return <div className="explorer">
    <details className="filter-group"><summary>Filtrar obras{activeFilters > 0 && <span className="muted"> · {activeFilters} {activeFilters === 1 ? "filtro activo" : "filtros activos"}</span>}</summary>
    <form action="/mapa" method="get" className="filters" aria-label="Filtrar obras">
      {query.bbox && <input type="hidden" name="bbox" value={query.bbox.join(",")} />}
      {view === "mapa" && <input type="hidden" name="vista" value="mapa" />}
      {query.territorioEsquema && <><input type="hidden" name="territorioEsquema" value={query.territorioEsquema} /><input type="hidden" name="municipioCodigo" value={query.municipioCodigo} /></>}
      <label>Fuente<select name="fuente" defaultValue={query.fuente ?? ""}><option value="">Todas las fuentes</option>{Object.entries(SOURCES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Estado informado<select name="estado" defaultValue={query.estado ?? ""}><option value="">Todos los estados</option>{Object.entries(STATES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Sector<select name="sector" defaultValue={query.sector ?? ""}><option value="">Todos los sectores</option><option value="educacion">Educación</option></select></label>
      {!query.bbox && <label>Ubicación<select name="tieneGeometria" defaultValue={query.tieneGeometria === undefined ? "" : String(query.tieneGeometria)}><option value="">Con y sin ubicación</option><option value="true">Con ubicación aprobada</option><option value="false">Sin ubicación aprobada</option></select></label>}
      <button className="button" type="submit">Aplicar filtros</button><a href="/mapa" className="filter-reset">Limpiar</a>
    </form>
    </details>
    <div className="explorer-toolbar">
      <div className="view-switch" role="group" aria-label="Forma de explorar">
        <button type="button" disabled={!hydrated} aria-pressed={view === "lista"} onClick={() => navigateView("lista")}>Lista</button>
        <button type="button" disabled={!hydrated} aria-pressed={view === "mapa"} onClick={() => navigateView("mapa")}>Mapa</button>
      </div>
      <button type="button" className="button secondary" disabled={!hydrated} onClick={() => void share()}>Copiar enlace</button>
      <span className="muted" role="status">{shareMessage}</span>
    </div>
    <div className="scope-note">
      <p>{query.bbox ? "Área seleccionada · solo obras con ubicación aprobada que intersecta esta zona." : "Todo el catálogo · incluye obras sin ubicación aprobada. La cobertura depende de las fuentes publicadas."}</p>
      {query.territorioEsquema && <p>Municipio PBA: código {query.municipioCodigo}. Este filtro territorial no equivale al área del mapa.</p>}
      {query.bbox && <p><a href={explorerHref(clearArea)}>Quitar área y ver todo el catálogo</a> · <a href={explorerHref({ ...clearArea, tieneGeometria: false })}>Ver obras sin ubicación</a></p>}
      <p className="muted">Los estados son los informados por cada fuente. Un dato faltante no equivale a cero.</p>
    </div>
    {mismatch && <div className="notice error" role="alert"><h2>El catálogo cambió</h2><p>Retiramos los resultados anteriores para evitar mezclar publicaciones. Conservamos tus filtros.</p><a className="button" href={firstHref}>Reiniciar consulta</a></div>}
    {listError && !mismatch && <div className="notice error" role="alert"><h2>No pudimos completar la consulta</h2><p>El catálogo puede estar temporalmente fuera de servicio. Los resultados que ya ves corresponden a la última consulta completada.</p><a className="button secondary" href={firstHref}>Reintentar consulta</a></div>}
    <div className={view === "mapa" ? "explorer-body with-map" : "explorer-body"}>
      {view === "mapa" && <section className="map-region" aria-label="Mapa de obras">
        <div className="map-actions"><button type="button" className="button" disabled={!hydrated} onClick={searchArea}>Buscar en esta zona</button><button type="button" className="button secondary" disabled={!hydrated || locating} onClick={useLocation}>{locating ? "Buscando ubicación…" : "Usar mi ubicación"}</button></div>
        <p className="muted">Mover el mapa no inicia consultas. Presioná «Buscar en esta zona» para actualizar el mapa y la lista.</p>
        <p className="muted">Al abrir el mapa, OpenFreeMap recibe las solicitudes del mapa base. <a href="/privacidad">Uso de ubicación y privacidad</a>.</p>
        <p role="status">{locationMessage}</p>
        <WorkMap features={features} initialBBox={query.bbox ?? DEFAULT_BBOX} selectedId={selection?.id ?? null} focusBBox={focusBBox} onViewport={setCandidate} onSelect={select} styleUrl={styleUrl} />
        <p role="status" className="notice">{mapLoading ? "Consultando ubicaciones…" : mapMessage || "Ubicaciones de la consulta cargadas. Los puntos agrupados no representan un total de obras."}</p>
        <a className="button secondary mobile-list-link" href={explorerHref(query)}>Explorar esta zona como lista</a>
      </section>}
      <section className={view === "mapa" ? "list-region beside-map" : "list-region"} aria-label="Lista de obras">
        <div className="results-heading"><h2>Obras publicadas</h2><p aria-live="polite">{items.length} {items.length === 1 ? "obra cargada" : "obras cargadas"}{cursor ? " · hay más páginas" : ""}</p></div>
        {hasData && !mismatch && items.length === 0 && <div className="empty-state"><span className="empty-symbol" aria-hidden="true">↗</span><h3>No hay obras para mostrar</h3><p>No encontramos obras publicadas para esta consulta. Esto no significa que no existan obras en el territorio.</p><a href="/mapa">Ver todo el catálogo</a></div>}
        <ul className="results-list">{items.map(work => <li className="work-card" key={work.obraId}>
          <div className="work-card-meta"><span className="status-badge">{work.estado ? STATES[work.estado] : "Estado no informado"}</span><span className="muted">{work.tieneGeometria ? "Con ubicación" : "Sin ubicación aprobada"}</span></div>
          <h3><a href={`/obras/${work.obraId}?revisionId=${work.revisionId}`}>{work.nombre}</a></h3>
          <p>{work.territorios.map(t => t.nombre ?? t.codigo).join(" · ") || "Territorio no informado"}</p>
          <p className="muted">Fuente: {[...new Set(work.fuentes.map(f => SOURCES[f.codigo]))].join(" · ") || "No informada"}</p>
          <div className="card-actions"><button type="button" className="button secondary" disabled={!hydrated} onClick={() => select(work.obraId, work.revisionId)}>Ver resumen<span className="sr-only"> de {work.nombre}</span></button><a href={`/obras/${work.obraId}?revisionId=${work.revisionId}`}>Ver ficha<span className="sr-only"> de {work.nombre}</span> <span aria-hidden="true">↗</span></a></div>
        </li>)}</ul>
        {cursor && <div className="pagination">{items.length < 100 && <button type="button" className="button secondary" disabled={!hydrated || loading} onClick={() => void loadMore()}>{loading ? "Cargando obras…" : "Cargar más obras"}</button>}<a href={explorerHref({ ...query, cursor }, view)}>{items.length >= 100 ? "Ir a la página siguiente" : "Página siguiente sin JavaScript"}</a></div>}
        {query.cursor && <p><a href={firstHref}>Volver a la primera página</a></p>}
      </section>
    </div>
    <dialog ref={dialog} className={`detail-panel ${expanded ? "expanded" : ""}`} aria-labelledby="summary-title" onCancel={closeDetail} onClose={() => { if (selection) closeDetail(); }}>
      <div className="panel-toolbar"><h2 id="summary-title">Resumen de la obra</h2><button type="button" className="button secondary" onClick={() => setExpanded(!expanded)}>{expanded ? "Reducir panel" : "Ampliar panel"}</button><button type="button" className="button secondary" onClick={closeDetail} autoFocus>Cerrar resumen</button></div>
      {!detail && !detailError && <p role="status">Cargando la revisión seleccionada…</p>}
      {detailError && <p role="alert" className="notice error">{detailError}</p>}
      {detail && <><WorkDetailContent work={detail} compact /><a className="button" href={`/obras/${detail.obraId}?revisionId=${detail.revisionId}`}>Abrir ficha completa</a></>}
    </dialog>
  </div>;
}
