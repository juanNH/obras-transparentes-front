"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BoundingBox, ListQuery, WorkDetail, WorkGeoJSON, WorkList } from "../api/client";
import { BrowserApiError, readPublic } from "../lib/browser-api";
import { DEFAULT_BBOX, MAP_READ_BBOX, SOURCES, STATES, explorerHref, queryParams } from "../lib/explorer-query";
import type { ExplorerQuery } from "../lib/explorer-query";
import { limitMapFeatures, limitMapLayers, MAX_MAP_FEATURES } from "../lib/map-budget";
import { detailMapFeatures } from "../lib/map-data";
import { locationPresentation } from "../lib/presentation";
import { LocationQuality } from "./location-quality";
import { SourceBadge, SourceLegend } from "./source-origin";
import "./explorer.css";

const WorkMap = dynamic(() => import("./work-map"), { ssr: false, loading: () => <p className="notice" role="status">Cargando el mapa… La lista sigue disponible.</p> });
const WorkDetailContent = dynamic(() => import("./work-detail").then(module => module.WorkDetailContent), { ssr: false, loading: () => <p role="status">Preparando el resumen…</p> });
type Selection = { id: string; revisionId?: string; locationId?: string };

export function Explorer({ initial, initialError, state, styleUrl }: { initial: WorkList | null; initialError: string | null; state: ExplorerQuery; styleUrl: string }) {
  const router = useRouter();
  const { query } = state;
  const [view, setView] = useState(state.view);
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
  const [selection, setSelection] = useState<Selection | null>(state.obra ? { id: state.obra, ...(state.revisionId ? { revisionId: state.revisionId } : {}), ...(state.ubicacionId ? { locationId: state.ubicacionId } : {}) } : null);
  const [detail, setDetail] = useState<WorkDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [selectionFocus, setSelectionFocus] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const mapRegion = useRef<HTMLElement>(null);
  const camera = useRef<BoundingBox | null>(null);
  const focusMap = useRef(false);
  const mapLoaded = useRef(false);
  const listRequest = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const paginationCursors = useRef(new Set<string>());
  const version = initial?.catalogoVersion;
  const mismatch = listError === "CATALOG_CHANGED";
  const { cursor: _cursor, ...firstQuery } = query;
  const firstHref = explorerHref(firstQuery, view);
  const selectedDetail = detail?.obraId === selection?.id && (!selection?.revisionId || detail?.revisionId === selection.revisionId) ? detail : null;
  const detailFeatures = useMemo(() => selectedDetail ? detailMapFeatures(selectedDetail) : [], [selectedDetail]);
  const selectedLocationId = selection?.locationId;
  const selectedWorkId = selection?.id;
  const selectedRevisionId = selection?.revisionId;
  const selectedLocations = useMemo(() => selectedLocationId ? detailFeatures.filter(feature => feature.properties.ubicacionId === selectedLocationId) : detailFeatures, [detailFeatures, selectedLocationId]);
  const unavailableLocation = Boolean(selectedDetail && selectedLocationId && selectedLocations.length === 0);
  const selectedGeometry = useMemo(() => limitMapFeatures(selectedLocations), [selectedLocations]);
  const mapLayers = useMemo(() => limitMapLayers(features, selectedGeometry.features), [features, selectedGeometry]);
  const representedFeatures = useMemo(() => {
    const key = (feature: WorkGeoJSON["features"][number]) => `${feature.properties.obraId}:${feature.properties.revisionId}:${feature.properties.ubicacionId}`;
    const queryKeys = new Set(features.map(key));
    return [...mapLayers.catalog, ...mapLayers.selection.filter(feature => queryKeys.has(key(feature)))];
  }, [features, mapLayers]);

  const invalidate = useCallback(() => {
    listRequest.current?.abort();
    setItems([]); setCursor(null); setFeatures([]); setListError("CATALOG_CHANGED"); setSelection(null);
  }, []);
  useEffect(() => { setHydrated(true); alive.current = true; return () => { alive.current = false; listRequest.current?.abort(); }; }, []);

  useEffect(() => {
    if (view !== "mapa" || !initial || mismatch || mapLoaded.current) return;
    if (query.tieneGeometria === false) { setMapMessage("Estas obras no tienen ubicación aprobada. Podés leerlas en los resultados; no les asignamos puntos en el mapa."); return; }
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
        const geoQuery: ListQuery = { ...query, bbox: query.bbox ?? MAP_READ_BBOX };
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
      } while (next && collected.length < MAX_MAP_FEATURES && pages < 5);
      if (cancelled) return;
      const budget = limitMapFeatures(collected);
      setFeatures(budget.features);
      mapLoaded.current = true;
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
      const id = params.get("obra")?.toLowerCase(); const revisionId = params.get("revisionId")?.toLowerCase(); const locationId = params.get("ubicacionId")?.toLowerCase();
      setView(params.get("vista") === "lista" ? "lista" : "mapa");
      setSummaryOpen(false);
      setSelection(previous => previous?.id === id && previous?.revisionId === revisionId && previous?.locationId === locationId ? previous : id ? { id, ...(revisionId ? { revisionId } : {}), ...(locationId ? { locationId } : {}) } : null);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  useEffect(() => {
    if (!selectedWorkId) { setDetail(null); setDetailError(""); return; }
    setDetail(null); setDetailError("");
    const controller = new AbortController();
    const suffix = selectedRevisionId ? "?revisionId=" + encodeURIComponent(selectedRevisionId) : "";
    void readPublic<WorkDetail>("obras/" + encodeURIComponent(selectedWorkId) + suffix, controller.signal).then(work => {
      if (controller.signal.aborted) return;
      if (work.obraId !== selectedWorkId || (selectedRevisionId && work.revisionId !== selectedRevisionId)) throw new Error("La ficha recibida no coincide con la selección.");
      if (work.catalogoVersion !== version) { invalidate(); return; }
      setDetail(work);
    }).catch(error => { if (!controller.signal.aborted) setDetailError(error instanceof Error ? error.message : "No se pudo cargar esta ficha."); });
    return () => controller.abort();
  }, [selectedWorkId, selectedRevisionId, version, invalidate]);

  useEffect(() => {
    if (summaryOpen && selection) dialog.current?.showModal();
    else dialog.current?.close();
  }, [summaryOpen, selection]);

  useEffect(() => {
    if (view === "mapa" && focusMap.current) {
      focusMap.current = false;
      mapRegion.current?.focus({ preventScroll: true });
      mapRegion.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [view, selection, selectionFocus]);

  function select(id: string, revisionId: string, summary = false, locationId?: string) {
    setFocusBBox(null);
    if (selection?.id !== id || selection.revisionId !== revisionId) {
      if (view === "lista") camera.current = null;
      setDetail(null); setDetailError("");
    }
    if (selection?.id !== id || selection.revisionId !== revisionId || selection.locationId !== locationId) setSelection({ id, revisionId, ...(locationId ? { locationId } : {}) });
    setExpanded(false); setSummaryOpen(summary);
    const url = new URL(window.location.href);
    url.searchParams.set("obra", id); url.searchParams.set("revisionId", revisionId);
    if (locationId) url.searchParams.set("ubicacionId", locationId);
    else url.searchParams.delete("ubicacionId");
    if (url.href !== window.location.href) window.history.pushState(null, "", url);
  }
  function clearSelection() {
    mapRegion.current?.focus({ preventScroll: true });
    setSelection(null); setSummaryOpen(false);
    const url = new URL(window.location.href); url.searchParams.delete("obra"); url.searchParams.delete("revisionId"); url.searchParams.delete("ubicacionId");
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
    if (next === view) return;
    setFocusBBox(null);
    const url = new URL(window.location.href);
    if (next === "lista") url.searchParams.set("vista", "lista");
    else url.searchParams.delete("vista");
    setView(next);
    window.history.pushState(null, "", url);
  }
  function locateWork(id: string, revisionId: string, locationId?: string) {
    camera.current = null;
    focusMap.current = true;
    setSelectionFocus(value => value + 1);
    navigateView("mapa");
    select(id, revisionId, false, locationId);
  }
  function chooseLocation(locationId?: string) {
    if (!selectedDetail) return;
    camera.current = null;
    setSelectionFocus(value => value + 1);
    select(selectedDetail.obraId, selectedDetail.revisionId, false, locationId);
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
  const locatedWorks = new Set(representedFeatures.map(feature => feature.properties.obraId)).size;
  const unlocatedLoaded = items.filter(work => !work.tieneGeometria).length;
  const selectedItem = items.find(work => work.obraId === selection?.id);

  return <div className="explorer">
    <div className="consultation-header">
    <details className="filter-group"><summary>Filtrar obras{activeFilters > 0 && <span className="muted"> · {activeFilters} {activeFilters === 1 ? "filtro activo" : "filtros activos"}</span>}</summary>
    <form action="/mapa" method="get" className="filters" aria-label="Filtrar obras">
      {query.bbox && <input type="hidden" name="bbox" value={query.bbox.join(",")} />}
      {view === "lista" && <input type="hidden" name="vista" value="lista" />}
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
    </div>
    <SourceLegend />
    <div className="scope-note">
      <p><strong>{query.bbox ? "Consulta por área" : "Todo el catálogo"}</strong> · {query.bbox ? "Solo obras con ubicación aprobada que intersecta la zona consultada." : "Sin filtro de área. Incluye obras con y sin ubicación aprobada."}</p>
      {query.territorioEsquema && <p>Municipio PBA: código {query.municipioCodigo}. Este filtro territorial no equivale al área del mapa.</p>}
      {query.bbox && <p><a href={explorerHref(clearArea)}>Quitar área y ver todo el catálogo</a> · <a href={explorerHref({ ...clearArea, tieneGeometria: false })}>Ver obras sin ubicación</a></p>}
    </div>
    {mismatch && <div className="notice error" role="alert"><h2>El catálogo cambió</h2><p>Retiramos los resultados anteriores para evitar mezclar publicaciones. Conservamos tus filtros.</p><a className="button" href={firstHref}>Reiniciar consulta</a></div>}
    {listError && !mismatch && <div className="notice error" role="alert"><h2>No pudimos completar la consulta</h2><p>El catálogo puede estar temporalmente fuera de servicio. Los resultados que ya ves corresponden a la última consulta completada.</p><a className="button secondary" href={firstHref}>Reintentar consulta</a></div>}
    <div className={view === "mapa" ? "explorer-body with-map" : "explorer-body"}>
      {view === "mapa" && <section id="ubicaciones" ref={mapRegion} tabIndex={-1} className="map-region" aria-label="Mapa de obras">
        <div className="map-context"><h2>Ubicaciones de la consulta</h2>{representedFeatures.length > 0 && <span className="status-badge">{locatedWorks} {locatedWorks === 1 ? "obra ubicada" : "obras ubicadas"}</span>}<a href="#resultados">Ver resultados ↓</a></div>
        {selection && <div className="selection-strip" aria-live="polite">
          <div><p className="eyebrow">Obra seleccionada</p><h3>{selectedDetail?.nombre ?? selectedItem?.nombre ?? "Cargando obra…"}</h3>
            {(selectedDetail ?? selectedItem) && <p><SourceBadge sources={(selectedDetail ?? selectedItem)!.fuentes} /></p>}
            <p>{detailError || (!selectedDetail ? "Consultando la revisión seleccionada…" : unavailableLocation ? "La ubicación elegida no está aceptada en esta revisión. No destacamos otro punto en su lugar." : selectedGeometry.truncated ? "Mapa parcial: parte de su geometría supera el límite. La ficha conserva todas las ubicaciones." : selectedGeometry.features.length ? "Ubicación aprobada destacada. La consulta conserva sus filtros." : "Sin ubicación aprobada. Esta obra sigue disponible en los resultados y en su ficha.")}</p>
            {selectedDetail && detailFeatures.length > 1 && <div className="location-picker">
              <label htmlFor="ubicacion-seleccionada">Ubicación para consultar</label>
              <select id="ubicacion-seleccionada" value={selectedLocationId ?? ""} onChange={event => chooseLocation(event.target.value || undefined)}>
                <option value="">Todas las ubicaciones aceptadas</option>
                {unavailableLocation && <option value={selectedLocationId} disabled>Ubicación no disponible en esta revisión</option>}
                {detailFeatures.map((feature, index) => <option key={feature.properties.ubicacionId} value={feature.properties.ubicacionId}>Ubicación {index + 1}: {locationPresentation(feature.properties.calidad).label}</option>)}
              </select>
            </div>}
            {selectedLocations.length > 0 && <p className="selection-quality-summary">{[...new Set(selectedLocations.map(feature => locationPresentation(feature.properties.calidad).label))].join(" · ")}</p>}
          </div>
          <div className="card-actions"><button className="button secondary" type="button" onClick={() => setSummaryOpen(true)}>Ver resumen</button><button className="button secondary" type="button" onClick={clearSelection}>Quitar selección</button></div>
        </div>}
        <div className="map-stage"><WorkMap features={mapLayers.catalog} selectionFeatures={mapLayers.selection} selectionFocus={selectionFocus} autoFit={!query.bbox && !camera.current} preserveCamera={Boolean(camera.current)} initialBBox={camera.current ?? query.bbox ?? DEFAULT_BBOX} selectedId={selection?.id ?? null} selectedLocationId={selectedLocationId ?? null} selectedRevisionId={selectedDetail?.revisionId ?? selection?.revisionId ?? null} focusBBox={focusBBox} onViewport={box => { camera.current = box; setCandidate(box); }} onSelect={(id, revision, location) => select(id, revision, false, location)} styleUrl={styleUrl} /></div>
        <div className="map-actions"><button type="button" className="button" disabled={!hydrated} onClick={searchArea}>Buscar en esta zona</button><button type="button" className="button secondary" disabled={!hydrated || locating} onClick={useLocation}>{locating ? "Buscando ubicación…" : "Usar mi ubicación"}</button></div>
        {selectedLocations.length > 0 && <details className="location-details" key={`${selection?.id}:${selection?.revisionId}:${selectedLocationId ?? "all"}`} open={selectedLocations.length === 1}>
          <summary>Cómo interpretar {selectedLocations.length === 1 ? "esta ubicación" : `las ${selectedLocations.length} ubicaciones seleccionadas`}</summary>
          <ul className="selected-location-quality">{selectedLocations.map((feature, index) => <li key={feature.properties.ubicacionId}>
            {selectedLocations.length > 1 && <p className="eyebrow">Ubicación {index + 1}</p>}
            <LocationQuality location={feature.properties.calidad} />
          </li>)}</ul>
        </details>}
        <p className="map-help">{query.bbox ? "Mover el mapa conserva el área consultada." : "Acercar o mover no filtra las obras."} «Buscar en esta zona» aplica el área visible.</p>
        {locationMessage && <p role="status">{locationMessage}</p>}
        <p role="status" className="notice">{mapLoading ? "Consultando ubicaciones…" : mapMessage || (mapLoaded.current ? "Ubicaciones de la consulta cargadas. Los puntos agrupados no representan un total de obras." : "Preparando el mapa. Los resultados están disponibles.")}</p>
        {mapLayers.truncated && <p role="status" className="notice">Mapa parcial al destacar la selección: algunas ubicaciones de la consulta superan el límite de representación. La lista conserva todas las obras.</p>}
        <noscript><p className="results-footnote">El mapa interactivo necesita JavaScript. La lista y las fichas están disponibles.</p></noscript>
        {!mapLoading && representedFeatures.length > 0 && <p className="results-footnote">{locatedWorks} {locatedWorks === 1 ? "obra representada" : "obras representadas"} · {representedFeatures.length} {representedFeatures.length === 1 ? "ubicación cargada" : "ubicaciones cargadas"}. El mapa puede incluir obras de las páginas siguientes. La cobertura depende de las fuentes publicadas.</p>}
        {!mapLoading && mapLoaded.current && hasData && items.length > 0 && features.length === 0 && <p className="results-footnote">Las obras de esta consulta siguen en los resultados. La ausencia de ubicaciones en el mapa no significa que no haya obras.</p>}
        <details className="map-help"><summary>Acerca del mapa y la privacidad</summary><p>Los grupos cuentan puntos, no obras. Al abrir el mapa, OpenFreeMap recibe las solicitudes del mapa base. <a href="/privacidad">Uso de ubicación y privacidad</a>.</p><p>Los estados son los informados por cada fuente. Un dato faltante no equivale a cero.</p></details>
      </section>}
      <section id="resultados" className={view === "mapa" ? "list-region beside-map" : "list-region"} aria-label="Lista de obras">
        <div className="results-heading"><h2>Obras publicadas</h2><p aria-live="polite">{items.length} {items.length === 1 ? "obra cargada" : "obras cargadas"}{cursor ? " · hay más páginas" : ""}</p></div>
        <p className="results-footnote">{unlocatedLoaded > 0 ? `${unlocatedLoaded} de las obras cargadas no ${unlocatedLoaded === 1 ? "tiene" : "tienen"} ubicación aprobada. ` : ""}La lista conserva todos los resultados, aunque no puedan dibujarse en el mapa.</p>
        {hasData && !mismatch && items.length === 0 && <div className="empty-state"><span className="empty-symbol" aria-hidden="true">↗</span><h3>No hay obras para mostrar</h3><p>No encontramos obras publicadas para esta consulta. Esto no significa que no existan obras en el territorio.</p><a href="/mapa">Ver todo el catálogo</a></div>}
        <ul className="results-list">{items.map((work, index) => <li className={`work-card${selection?.id === work.obraId ? " selected" : ""}`} key={work.obraId}>
          <div className="work-card-meta"><span className="status-badge">{work.estado ? STATES[work.estado] : "Estado no informado"}</span><span className={`location-label${work.tieneGeometria ? "" : " unlocated"}`}>{work.tieneGeometria ? "Ubicación aprobada" : "Sin ubicación aprobada"}</span></div>
          <div className="work-card-identity"><span className="result-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><h3><a href={`/obras/${work.obraId}?revisionId=${work.revisionId}`}>{work.nombre}</a></h3></div>
          {selection?.id === work.obraId && <p className="selection-label">Obra seleccionada</p>}
          <p>{work.territorios.map(t => t.nombre ?? t.codigo).join(" · ") || "Territorio no informado"}</p>
          <p><SourceBadge sources={work.fuentes} /></p>
          <div className="card-actions">{work.tieneGeometria && <button type="button" className="button secondary" disabled={!hydrated} onClick={() => locateWork(work.obraId, work.revisionId)}>Ver en mapa<span className="sr-only">: {work.nombre}</span></button>}<button type="button" className="button secondary" disabled={!hydrated} onClick={() => select(work.obraId, work.revisionId, true, selection?.id === work.obraId && selection.revisionId === work.revisionId ? selectedLocationId : undefined)}>Ver resumen<span className="sr-only"> de {work.nombre}</span></button><a href={`/obras/${work.obraId}?revisionId=${work.revisionId}`}>Ver ficha<span className="sr-only"> de {work.nombre}</span> <span aria-hidden="true">↗</span></a></div>
        </li>)}</ul>
        {cursor && <div className="pagination">{items.length < 100 && <button type="button" className="button secondary" disabled={!hydrated || loading} onClick={() => void loadMore()}>{loading ? "Cargando obras…" : "Cargar más obras"}</button>}<a href={explorerHref({ ...query, cursor }, view)}>{items.length >= 100 ? "Ir a la página siguiente" : "Página siguiente sin JavaScript"}</a></div>}
        {query.cursor && <p><a href={firstHref}>Volver a la primera página</a></p>}
      </section>
    </div>
    <dialog ref={dialog} className={`detail-panel ${expanded ? "expanded" : ""}`} aria-labelledby="summary-title" onCancel={() => setSummaryOpen(false)} onClose={() => setSummaryOpen(false)}>
      <div className="panel-toolbar"><h2 id="summary-title">Resumen de la obra</h2><button type="button" className="button secondary" onClick={() => setExpanded(!expanded)}>{expanded ? "Reducir panel" : "Ampliar panel"}</button><button type="button" className="button secondary" onClick={() => setSummaryOpen(false)} autoFocus>Cerrar resumen</button></div>
      {!selectedDetail && !detailError && <p role="status">Cargando la revisión seleccionada…</p>}
      {detailError && <p role="alert" className="notice error">{detailError}</p>}
      {selectedDetail && <><WorkDetailContent work={selectedDetail} compact /><a className="button" href={`/obras/${selectedDetail.obraId}?revisionId=${selectedDetail.revisionId}`}>Abrir ficha completa</a></>}
    </dialog>
  </div>;
}
