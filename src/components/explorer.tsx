/** @file Explorador con lista/mapa sincronizados, paginación versionada y selección explícita de obra y ubicación. */
"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { BoundingBox, InstitutionalOrganizationCatalog, ListQuery, MunicipalCoverage, PartyBoundaries, PartyCatalog, ProvinceCatalog, WorkCounts, WorkDetail, WorkGeoJSON, WorkList } from "../api/client";
import { BrowserApiError, readPublic } from "../lib/browser-api";
import { DEFAULT_BBOX, INSTITUTIONAL_ROLES, MAP_READ_BBOX, SOURCES, STATES, explorerHref, parseExplorerQuery, queryParams, unlocatedListHref } from "../lib/explorer-query";
import type { ExplorerQuery } from "../lib/explorer-query";
import { limitMapFeatures, limitMapLayers, MAX_MAP_FEATURES } from "../lib/map-budget";
import { detailMapFeatures } from "../lib/map-data";
import { readPartyBoundaries } from "../lib/party-boundaries";
import { locationPresentation } from "../lib/presentation";
import { LocationQuality } from "./location-quality";
import { SourceBadge, SourceLegend } from "./source-origin";
import { MapAvailability } from "./map-availability";
import { PartyFilter } from "./party-filter";
import { ProvinceFilter } from "./province-filter";
import { InstitutionalFilter } from "./institutional-filter";
import { WorkAssociationSummary } from "./work-associations";
import { WorkCountsPanel } from "./work-counts";
import { MunicipalNavigation } from "./municipal-navigation";
import { MunicipalCoveragePanel } from "./municipal-coverage";
import "./explorer.css";

const WorkMap = dynamic(() => import("./work-map"), { ssr: false, loading: () => <p className="notice" role="status">Cargando el mapa… La lista sigue disponible.</p> });
const WorkDetailContent = dynamic(() => import("./work-detail").then(module => module.WorkDetailContent), { ssr: false, loading: () => <p role="status">Preparando el resumen…</p> });
/** Identidad compartible de obra y revisión; una ubicación específica se conserva sólo cuando fue elegida. */
type Selection = { id: string; revisionId?: string; locationId?: string };

/**
 * Mantiene lista/mapa y selección dentro de una sola versión del catálogo con alternativa textual HTML.
 * @param props - Página inicial, estado validado de URL y estilo cartográfico configurado.
 * @returns Explorador que conserva filtros al alternar presentación y confirma área sólo por acción explícita.
 */
export function Explorer({ initial, initialError, state, styleUrl, partyCatalog = null, provinceCatalog = null, institutionalCatalog = null, counts = null, countsError = null, municipalCoverage = null, municipalCoverageError = null }: { initial: WorkList | null; initialError: string | null; state: ExplorerQuery; styleUrl: string; partyCatalog?: PartyCatalog | null; provinceCatalog?: ProvinceCatalog | null; institutionalCatalog?: InstitutionalOrganizationCatalog | null; counts?: WorkCounts | null; countsError?: "UNAVAILABLE" | "CATALOG_CHANGED" | null; municipalCoverage?: MunicipalCoverage | null; municipalCoverageError?: "UNAVAILABLE" | "CATALOG_CHANGED" | null }) {
  const router = useRouter();
  const { query } = state;
  const selectedPartyIds = useMemo(() => query.partidos ?? (query.partidoId ? [query.partidoId] : []), [query.partidos, query.partidoId]);
  const [view, setView] = useState(state.view);
  const [hydrated, setHydrated] = useState(false);
  const [items, setItems] = useState(initial?.items ?? []);
  const [cursor, setCursor] = useState(initial?.nextCursor ?? null);
  const [listError, setListError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const [features, setFeatures] = useState<WorkGeoJSON["features"]>([]);
  const [mapMessage, setMapMessage] = useState("");
  const [mapLoading, setMapLoading] = useState(false);
  const [showBoundaries, setShowBoundaries] = useState(state.showBoundaries ?? false);
  const [boundaries, setBoundaries] = useState<PartyBoundaries | null>(null);
  const [boundaryLoading, setBoundaryLoading] = useState(false);
  const [boundaryError, setBoundaryError] = useState(false);
  const [boundaryAttempt, setBoundaryAttempt] = useState(0);
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
  const firstHref = explorerHref(firstQuery, view, showBoundaries);
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
    /** Identifica obra/revisión/ubicación para contar únicamente capas de la consulta, sin sumar selección externa. */
    const key = (feature: WorkGeoJSON["features"][number]) => `${feature.properties.obraId}:${feature.properties.revisionId}:${feature.properties.ubicacionId}`;
    const queryKeys = new Set(features.map(key));
    return [...mapLayers.catalog, ...mapLayers.selection.filter(feature => queryKeys.has(key(feature)))];
  }, [features, mapLayers]);

  /** Cancela paginación y retira lista, mapa y selección para evitar mezclar versiones de una publicación. */
  const invalidate = useCallback(() => {
    listRequest.current?.abort();
    setItems([]); setCursor(null); setFeatures([]); setListError("CATALOG_CHANGED"); setSelection(null);
  }, []);
  useEffect(() => { setHydrated(true); alive.current = true; return () => { alive.current = false; listRequest.current?.abort(); }; }, []);

  useEffect(() => {
    if (!showBoundaries || view !== "mapa" || boundaries || partyCatalog?.limites.estado !== "VALIDATED_FOR_DISPLAY") return;
    const controller = new AbortController();
    let active = true;
    const catalog = partyCatalog;
    setBoundaryLoading(true); setBoundaryError(false);
    void readPartyBoundaries(catalog, AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]))
      .then(data => {
        if (active) { setBoundaries(data); setBoundaryLoading(false); }
      })
      .catch(() => { if (active) { setBoundaryError(true); setBoundaryLoading(false); } });
    return () => { active = false; controller.abort(); };
  }, [showBoundaries, view, boundaries, partyCatalog, boundaryAttempt]);

  useEffect(() => {
    if (view !== "mapa" || !initial || mismatch || mapLoaded.current) return;
    if (query.tieneGeometria === false) { setMapMessage("Estas obras no tienen ubicación aprobada. Podés leerlas en los resultados; no les asignamos puntos en el mapa."); return; }
    const controller = new AbortController();
    let cancelled = false;
    setMapLoading(true); setMapMessage(""); setFeatures([]);
    /** Recorre GeoJSON con límites de páginas/bytes/features y cancela o invalida el mapa al cambiar el catálogo. */
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
    /** Restaura presentación y selección al navegar Atrás/Adelante sin abrir automáticamente un resumen. */
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

  /** Selecciona una revisión/ubicación y actualiza el enlace; abrir resumen requiere una acción explícita. */
  function select(id: string, revisionId: string, summary = false, locationId?: string) {
    setFocusBBox(null);
    if (selection?.id !== id || selection.revisionId !== revisionId) {
      if (view === "lista") camera.current = null;
      setDetail(null); setDetailError("");
    }
    if (selection?.id !== id || selection.revisionId !== revisionId || selection.locationId !== locationId) setSelection({ id, revisionId, ...(locationId ? { locationId } : {}) });
    setExpanded(false); setSummaryOpen(summary);
    const url = scopedUrl();
    url.searchParams.set("obra", id); url.searchParams.set("revisionId", revisionId);
    if (locationId) url.searchParams.set("ubicacionId", locationId);
    else url.searchParams.delete("ubicacionId");
    if (url.href !== window.location.href) window.history.pushState(null, "", url);
  }
  /** Retira selección y parámetros compartibles, devolviendo el foco al contexto del mapa. */
  function clearSelection() {
    mapRegion.current?.focus({ preventScroll: true });
    setSelection(null); setSummaryOpen(false);
    const url = scopedUrl(); url.searchParams.delete("obra"); url.searchParams.delete("revisionId"); url.searchParams.delete("ubicacionId");
    window.history.replaceState(null, "", url);
  }
  /** Agrega una página sin obras duplicadas ni cursores repetidos y retira resultados si cambia la versión. */
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
  /** Alterna lista/mapa conservando filtros, páginas cargadas, selección y cámara en memoria. */
  function navigateView(next: "lista" | "mapa") {
    if (next === view) return;
    setFocusBBox(null);
    const url = scopedUrl();
    if (next === "lista") url.searchParams.set("vista", "lista");
    else url.searchParams.delete("vista");
    setView(next);
    window.history.pushState(null, "", url);
  }
  /** Activa mapa y enfoca la revisión elegida sin aplicar su encuadre como filtro de consulta. */
  function locateWork(id: string, revisionId: string, locationId?: string) {
    camera.current = null;
    focusMap.current = true;
    setSelectionFocus(value => value + 1);
    navigateView("mapa");
    select(id, revisionId, false, locationId);
  }
  /** Destaca la ubicación elegida de la revisión seleccionada, manteniendo los filtros de la lista. */
  function chooseLocation(locationId?: string) {
    if (!selectedDetail) return;
    camera.current = null;
    setSelectionFocus(value => value + 1);
    select(selectedDetail.obraId, selectedDetail.revisionId, false, locationId);
  }
  /** Confirma el encuadre candidato como bbox de una nueva consulta y elimina el filtro incompatible sin geometría. */
  function searchArea() {
    const nextQuery = { ...firstQuery, bbox: candidate };
    delete nextQuery.tieneGeometria;
    router.push(explorerHref(nextQuery, "mapa", showBoundaries), { scroll: false });
  }
  /** Solicita permiso sólo al pulsar el control y centra cámara; no envía un área al catálogo hasta confirmarla. */
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
  /** Copia el enlace de filtros/selección sin cursor de página y ofrece alternativa si el portapapeles falla. */
  async function share() {
    const url = scopedUrl(); url.searchParams.delete("cursor");
    try { await navigator.clipboard.writeText(url.href); setShareMessage("Enlace copiado."); }
    catch { setShareMessage("Podés copiar el enlace desde la barra de direcciones del navegador."); }
  }
  const clearArea = { ...firstQuery }; delete clearArea.bbox;
  const clearLegacy = { ...firstQuery }; delete clearLegacy.territorioEsquema; delete clearLegacy.municipioCodigo;
  const hasData = Boolean(initial);
  const activeFilters = [query.provinciaCodigo?.length ? true : undefined, query.bbox, query.fuente, query.estado, query.sector, query.tieneGeometria, query.territorioEsquema, selectedPartyIds.length ? true : undefined, query.partidoVerificadoId, query.gestionMunicipalId, query.organizacionId, query.rolInstitucional, query.periodoDesde ? true : undefined].filter(value => value !== undefined).length;
  const provinceNames = (query.provinciaCodigo ?? []).map(code => provinceCatalog?.items.find(province => province.codigo === code)?.nombre ?? (code === "06" ? "Buenos Aires" : code === "02" ? "Ciudad Autónoma de Buenos Aires" : code));
  const selectedPartyNames = selectedPartyIds.map(id => partyCatalog?.items.find(party => party.partidoId === id)?.nombre ?? "identidad territorial seleccionada");
  const selectedPartySummary = selectedPartyNames.slice(0, 3).join(" · ") + (selectedPartyNames.length > 3 ? ` · y ${selectedPartyNames.length - 3} más` : "");
  const locatedWorks = new Set(representedFeatures.map(feature => feature.properties.obraId)).size;
  const unlocatedLoaded = items.filter(work => !work.tieneGeometria).length;
  const selectedItem = items.find(work => work.obraId === selection?.id);

  /** Canoniza filtros explícitos en nuevos enlaces sin agregar restricciones a una consulta global. */
  function scopedUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("provinciaCodigo");
    for (const code of query.provinciaCodigo ?? []) url.searchParams.append("provinciaCodigo", code);
    if (query.partidos) {
      url.searchParams.delete("partidos");
      for (const id of query.partidos) url.searchParams.append("partidos", id);
    }
    return url;
  }

  /** Omite opciones vacías en la URL de filtros; el formulario GET nativo conserva la alternativa sin JavaScript. */
  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    new FormData(event.currentTarget).forEach((value, key) => {
      if (typeof value === "string" && value) params.append(key, value);
    });
    const next = parseExplorerQuery(params);
    window.location.assign(explorerHref(next.query, next.view, next.showBoundaries));
  }

  /** Alterna un partido reportado sin borrar los otros; los límites visuales no verifican ubicación ni gestión. */
  function chooseParty(partidoId: string) {
    if (!partyCatalog?.items.some(party => party.partidoId === partidoId)) return;
    const next = { ...clearLegacy };
    delete next.partidoId;
    const ids = selectedPartyIds.includes(partidoId) ? selectedPartyIds.filter(id => id !== partidoId) : [...selectedPartyIds, partidoId];
    if (ids.length) next.partidos = ids.sort(); else delete next.partidos;
    router.push(explorerHref(next, view, showBoundaries), { scroll: false });
  }

  /** Comparte la presentación de límites sin aplicar otro filtro ni consultar ubicaciones de obras. */
  function toggleBoundaries(visible: boolean) {
    setShowBoundaries(visible);
    const url = scopedUrl();
    if (visible) url.searchParams.set("limites", "mostrar"); else url.searchParams.delete("limites");
    window.history.replaceState(null, "", url);
  }

  /** Quita un grupo de filtros y su cursor, preservando los demás valores y la presentación. */
  function withoutFilters(...keys: (keyof ListQuery)[]) {
    const next: ListQuery = { ...firstQuery };
    for (const key of keys) delete next[key];
    return explorerHref(next, view, showBoundaries);
  }
  const resetHref = explorerHref({ limit: 20 }, view);

  return <div className="explorer">
    <MunicipalCoveragePanel coverage={mismatch ? null : municipalCoverage} error={mismatch ? "CATALOG_CHANGED" : municipalCoverageError} />
    <MunicipalNavigation query={query} view={view} showBoundaries={showBoundaries} />
    <WorkCountsPanel counts={mismatch ? null : counts} error={mismatch ? "CATALOG_CHANGED" : countsError} query={query} />
    <div className="consultation-header">
    <div className="explorer-toolbar">
      <div className="view-switch" role="group" aria-label="Forma de explorar">
        <button type="button" disabled={!hydrated} aria-pressed={view === "lista"} onClick={() => navigateView("lista")}>Lista</button>
        <button type="button" disabled={!hydrated} aria-pressed={view === "mapa"} onClick={() => navigateView("mapa")}>Mapa</button>
      </div>
      <button type="button" className="button secondary" disabled={!hydrated} onClick={() => void share()}>Copiar enlace</button>
      <a href={resetHref} className="button secondary filter-clear-all">Limpiar filtros</a>
      <span className="muted" role="status">{shareMessage}</span>
    </div>
    <details className="filter-group"><summary>Filtrar obras{activeFilters > 0 && <span className="muted"> · {activeFilters} {activeFilters === 1 ? "filtro activo" : "filtros activos"}</span>}</summary>
    <form action="/mapa" method="get" className="filters" aria-label="Filtrar obras" onSubmit={applyFilters}>
      {query.bbox && <input type="hidden" name="bbox" value={query.bbox.join(",")} />}
      {view === "lista" && <input type="hidden" name="vista" value="lista" />}
      {showBoundaries && <input type="hidden" name="limites" value="mostrar" />}
      {query.territorioEsquema && <><input type="hidden" name="territorioEsquema" value={query.territorioEsquema} /><input type="hidden" name="municipioCodigo" value={query.municipioCodigo} /></>}
      <ProvinceFilter catalog={provinceCatalog} provinciaCodigo={query.provinciaCodigo} />
      <PartyFilter catalog={partyCatalog} partidos={selectedPartyIds} partidoVerificadoId={query.partidoVerificadoId} gestionMunicipalId={query.gestionMunicipalId} showReported={!query.territorioEsquema} />
      <details className="advanced-filter institutional-options" open={Boolean(query.organizacionId || query.rolInstitucional || query.periodoDesde)}><summary>Filtros institucionales</summary><InstitutionalFilter catalog={institutionalCatalog} query={query} /></details>
      <label>Fuente<select name="fuente" defaultValue={query.fuente ?? ""}><option value="">Todas las fuentes</option>{Object.entries(SOURCES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Estado informado<select name="estado" defaultValue={query.estado ?? ""}><option value="">Todos los estados</option>{Object.entries(STATES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Sector<select name="sector" defaultValue={query.sector ?? ""}><option value="">Todos los sectores</option><option value="educacion">Educación</option></select></label>
      {!query.bbox && <label>Ubicación<select name="tieneGeometria" defaultValue={query.tieneGeometria === undefined ? "" : String(query.tieneGeometria)}><option value="">Con y sin ubicación</option><option value="true">Con ubicación aprobada</option><option value="false">Sin ubicación aprobada</option></select></label>}
      <button className="button" type="submit">Aplicar filtros</button><a href={resetHref} className="filter-reset">Restablecer consulta</a>
    </form>
    </details>
    </div>
    {activeFilters > 0 && <ul className="active-filter-list" aria-label="Filtros aplicados">
      {provinceNames.length > 0 && <li>Jurisdicción: {provinceNames.join(" · ")} <a href={withoutFilters("provinciaCodigo")} aria-label="Quitar filtro de jurisdicción">Quitar</a></li>}
      {selectedPartyIds.length > 0 && <li>{selectedPartyIds.length} {selectedPartyIds.length === 1 ? "partido" : "partidos"} <a href={withoutFilters("partidos", "partidoId")} aria-label="Quitar filtro de partidos">Quitar</a></li>}
      {query.fuente && <li>Fuente: {SOURCES[query.fuente]} <a href={withoutFilters("fuente")} aria-label="Quitar filtro de fuente">Quitar</a></li>}
      {query.estado && <li>Estado: {STATES[query.estado]} <a href={withoutFilters("estado")} aria-label="Quitar filtro de estado">Quitar</a></li>}
      {query.sector && <li>Educación <a href={withoutFilters("sector")} aria-label="Quitar filtro de sector">Quitar</a></li>}
      {query.tieneGeometria !== undefined && <li>{query.tieneGeometria ? "Con ubicación" : "Sin ubicación"} <a href={withoutFilters("tieneGeometria")} aria-label="Quitar filtro de ubicación">Quitar</a></li>}
      {query.bbox && <li>Área del mapa <a href={withoutFilters("bbox")} aria-label="Quitar filtro de área">Quitar</a></li>}
      {query.territorioEsquema && <li>Municipio: {query.municipioCodigo} <a href={withoutFilters("territorioEsquema", "municipioCodigo")} aria-label="Quitar filtro territorial anterior">Quitar</a></li>}
      {query.partidoVerificadoId && <li>Ubicación verificada <a href={withoutFilters("partidoVerificadoId")} aria-label="Quitar filtro de ubicación territorial verificada">Quitar</a></li>}
      {query.gestionMunicipalId && <li>Gestión municipal <a href={withoutFilters("gestionMunicipalId")} aria-label="Quitar filtro de gestión municipal">Quitar</a></li>}
      {query.organizacionId && <li>Organización <a href={withoutFilters("organizacionId")} aria-label="Quitar filtro de organización">Quitar</a></li>}
      {query.rolInstitucional && <li>Rol: {INSTITUTIONAL_ROLES[query.rolInstitucional]} <a href={withoutFilters("rolInstitucional")} aria-label="Quitar filtro de rol institucional">Quitar</a></li>}
      {query.periodoDesde && <li>Período <a href={withoutFilters("periodoDesde", "periodoHasta")} aria-label="Quitar filtro de período">Quitar</a></li>}
    </ul>}
    <SourceLegend />
    <div className="scope-note">
      <p><strong>{provinceNames.length ? provinceNames.join(" · ") : "Todas las obras publicadas"}{query.bbox ? " · Consulta por área" : ""}</strong> · {query.bbox ? "Solo obras con ubicación aprobada que intersecta la zona consultada." : "Sin filtro de área. Incluye obras con y sin ubicación aprobada."}</p>
      {provinceNames.length > 0 && <p>La jurisdicción requiere evidencia territorial compatible. Las obras con territorio no informado pueden consultarse quitando este filtro o eligiendo su fuente. <a href={withoutFilters("provinciaCodigo")}>Ver sin filtro de jurisdicción</a>.</p>}
      <details className="coverage-help"><summary>Acerca de la cobertura territorial</summary><p>Los 135 partidos son opciones de búsqueda. Los resultados dependen de las obras publicadas y del territorio informado por cada fuente. Algunas publicaciones no informan un partido; algunas fuentes municipales todavía no tienen publicaciones. <a href="/proyecto#cobertura">Cobertura de las fuentes</a>.</p></details>
      {query.territorioEsquema && <p>Municipio PBA: código {query.municipioCodigo}. Este filtro territorial no equivale al área del mapa. <a href={explorerHref(clearLegacy, view, showBoundaries)}>Quitar este filtro y elegir entre los 135 partidos</a>.</p>}
      {selectedPartyIds.length > 0 && <p><strong>{selectedPartyIds.length === 1 ? "Partido informado por la fuente" : "Partidos informados por la fuente"}: {selectedPartySummary}.</strong> {selectedPartyIds.length > 1 && "Incluye obras informadas en cualquiera de los partidos seleccionados. "}La asociación reportada por la fuente no acredita ubicación espacial verificada ni gestión municipal.</p>}
      {query.partidoVerificadoId && <p><strong>Ubicación territorial verificada: {partyCatalog?.items.find(party => party.partidoId === query.partidoVerificadoId)?.nombre ?? "partido del padrón no disponible"}.</strong> Requiere una asociación espacial verificada publicada para la revisión.</p>}
      {query.gestionMunicipalId && <p><strong>Gestión municipal verificada: {partyCatalog?.items.find(party => party.partidoId === query.gestionMunicipalId)?.nombre ?? "partido del padrón no disponible"}.</strong> Requiere un rol municipal de promotor, contratante, ejecutor o financiador; no se deduce de la ubicación.</p>}
      {query.organizacionId && <p>Organización institucional: {institutionalCatalog?.items.find(organization => organization.id === query.organizacionId)?.nombre ?? "organización no disponible en el catálogo actual"}.</p>}
      {query.rolInstitucional && <p>Rol institucional verificado: {INSTITUTIONAL_ROLES[query.rolInstitucional]}.</p>}
      {query.periodoDesde && query.periodoHasta && <p>Solapamiento de vigencia del rol: {query.periodoDesde} a {query.periodoHasta}. Organización, rol, gestión municipal y período deben corresponder al mismo rol publicado. La búsqueda no transforma las fechas desconocidas en vigencias ilimitadas.</p>}
      {partyCatalog?.limites.estado === "PENDING_LICENSE_AND_VALIDATION" && <p>Límites de partidos pendientes de licencia y validación. La selección territorial está disponible; el mapa conserva las ubicaciones aprobadas de obras.</p>}
      {query.bbox && <><p>Las obras publicadas sin ubicación no aparecen en una consulta por área porque no se puede determinar si están dentro de esta zona.</p><p><a href={explorerHref(clearArea, view, showBoundaries)}>Quitar área y ver todo el catálogo</a> · <a href={unlocatedListHref(query)}>Ver obras sin ubicación en el mapa</a></p></>}
    </div>
    {mismatch && <div className="notice error" role="alert"><h2>El catálogo cambió</h2><p>Retiramos los resultados anteriores para evitar mezclar publicaciones. Conservamos tus filtros.</p><a className="button" href={firstHref}>Reiniciar consulta</a></div>}
    {listError && !mismatch && <div className="notice error" role="alert"><h2>No pudimos completar la consulta</h2><p>El catálogo puede estar temporalmente fuera de servicio. Los resultados que ya ves corresponden a la última consulta completada.</p><a className="button secondary" href={firstHref}>Reintentar consulta</a></div>}
    <div className={view === "mapa" ? "explorer-body with-map" : "explorer-body"}>
      {view === "mapa" && <section id="ubicaciones" ref={mapRegion} tabIndex={-1} className="map-region" aria-label="Mapa de obras">
        <div className="map-context"><h2>Ubicaciones de la consulta</h2>{representedFeatures.length > 0 && <span className="status-badge">{locatedWorks} {locatedWorks === 1 ? "obra ubicada" : "obras ubicadas"}</span>}<a href="#resultados">Ver resultados ↓</a></div>
        <div className="territory-controls">
          <label><input type="checkbox" checked={showBoundaries} disabled={!hydrated || partyCatalog?.limites.estado !== "VALIDATED_FOR_DISPLAY"} onChange={event => toggleBoundaries(event.target.checked)} />Mostrar límites de partidos</label>
          {showBoundaries && <p role="status">{boundaryLoading ? "Cargando límites de partidos…" : boundaryError ? "No pudimos cargar los límites. Las obras y sus resultados siguen disponibles." : boundaries ? `${boundaries.features.length} límites de partidos cargados para representar el territorio. Elegir un límite filtra el partido informado por la fuente; no verifica ubicación espacial ni gestión municipal.` : "Preparando límites de partidos…"}</p>}
          {showBoundaries && boundaryError && <button type="button" className="button secondary" onClick={() => setBoundaryAttempt(value => value + 1)}>Reintentar límites de partidos</button>}
          {showBoundaries && boundaries && <p className="map-help">Límites: <a href={boundaries.metadata.fuente.url} target="_blank" rel="noreferrer">{boundaries.metadata.fuente.nombre}</a> · <a href={boundaries.metadata.fuente.licencia.url} target="_blank" rel="noreferrer">{boundaries.metadata.fuente.licencia.nombre}</a>. Versión {boundaries.metadata.version}; consulta {boundaries.metadata.consultadoEn}. La geometría simplificada se usa para representación.</p>}
        </div>
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
        <div className="map-stage"><WorkMap features={mapLayers.catalog} selectionFeatures={mapLayers.selection} partyFeatures={showBoundaries ? boundaries?.features ?? [] : []} selectedPartidoIds={selectedPartyIds} onPartySelect={chooseParty} selectionFocus={selectionFocus} autoFit={!query.bbox && !camera.current} preserveCamera={Boolean(camera.current)} initialBBox={camera.current ?? query.bbox ?? DEFAULT_BBOX} selectedId={selection?.id ?? null} selectedLocationId={selectedLocationId ?? null} selectedRevisionId={selectedDetail?.revisionId ?? selection?.revisionId ?? null} focusBBox={focusBBox} onViewport={box => { camera.current = box; setCandidate(box); }} onSelect={(id, revision, location) => select(id, revision, false, location)} styleUrl={styleUrl} /></div>
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
        <p className="results-footnote">La lista conserva las obras publicadas, incluso cuando no tienen una ubicación aprobada para el mapa.</p>
        {unlocatedLoaded > 0 && <div className="unlocated-notice">
          <p><strong>{unlocatedLoaded} {unlocatedLoaded === 1 ? "obra cargada no aparece" : "obras cargadas no aparecen"} en el mapa.</strong> {query.tieneGeometria === false ? "Esta consulta muestra publicaciones sin ubicación aprobada. Sus fichas siguen disponibles." : "Están identificadas en las tarjetas como «Publicada · Sin ubicación en el mapa»."}</p>
          {query.tieneGeometria !== false && <a href={unlocatedListHref(query)}>Ver solo obras sin ubicación en el mapa</a>}
        </div>}
        {hasData && !mismatch && items.length === 0 && <div className="empty-state"><span className="empty-symbol" aria-hidden="true">↗</span><h3>No hay obras para mostrar</h3><p>No encontramos obras publicadas para esta consulta. Esto no significa que no existan obras en el territorio.</p><a href="/mapa">Ver todo el catálogo</a></div>}
        <ul className="results-list">{items.map((work, index) => <li className={`work-card${selection?.id === work.obraId ? " selected" : ""}`} key={work.obraId}>
          <div className="work-card-meta"><span className="status-badge">{work.estado ? STATES[work.estado] : "Estado no informado"}</span><MapAvailability hasGeometry={work.tieneGeometria} /></div>
          <div className="work-card-identity"><span className="result-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><h3><a href={`/obras/${work.obraId}?revisionId=${work.revisionId}`}>{work.nombre}</a></h3></div>
          {selection?.id === work.obraId && <p className="selection-label">Obra seleccionada</p>}
          <p><strong>Territorio informado por la fuente:</strong> {work.territorios.map(t => t.nombre ?? t.codigo).join(" · ") || "No informado"}</p>
          <WorkAssociationSummary work={work} partyCatalog={partyCatalog} />
          <p><SourceBadge sources={work.fuentes} /></p>
          {!work.tieneGeometria && <p className="map-availability-note">Esta publicación no tiene una ubicación aprobada para dibujar. Podés consultar su resumen y su ficha.</p>}
          <div className="card-actions">{work.tieneGeometria && <button type="button" className="button secondary" disabled={!hydrated} onClick={() => locateWork(work.obraId, work.revisionId)}>Ver en mapa<span className="sr-only">: {work.nombre}</span></button>}<button type="button" className="button secondary" disabled={!hydrated} onClick={() => select(work.obraId, work.revisionId, true, selection?.id === work.obraId && selection.revisionId === work.revisionId ? selectedLocationId : undefined)}>Ver resumen<span className="sr-only"> de {work.nombre}</span></button><a href={`/obras/${work.obraId}?revisionId=${work.revisionId}`}>Ver ficha<span className="sr-only"> de {work.nombre}</span> <span aria-hidden="true">↗</span></a></div>
        </li>)}</ul>
        {cursor && <div className="pagination">{items.length < 100 && <button type="button" className="button secondary" disabled={!hydrated || loading} onClick={() => void loadMore()}>{loading ? "Cargando obras…" : "Cargar más obras"}</button>}<a href={explorerHref({ ...query, cursor }, view, showBoundaries)}>{items.length >= 100 ? "Ir a la página siguiente" : "Página siguiente sin JavaScript"}</a></div>}
        {query.cursor && <p><a href={firstHref}>Volver a la primera página</a></p>}
      </section>
    </div>
    <dialog ref={dialog} className={`detail-panel ${expanded ? "expanded" : ""}`} aria-labelledby="summary-title" onCancel={() => setSummaryOpen(false)} onClose={() => setSummaryOpen(false)}>
      <div className="panel-toolbar"><h2 id="summary-title">Resumen de la obra</h2><button type="button" className="button secondary" onClick={() => setExpanded(!expanded)}>{expanded ? "Reducir panel" : "Ampliar panel"}</button><button type="button" className="button secondary" onClick={() => setSummaryOpen(false)} autoFocus>Cerrar resumen</button></div>
      {!selectedDetail && !detailError && <p role="status">Cargando la revisión seleccionada…</p>}
      {detailError && <p role="alert" className="notice error">{detailError}</p>}
      {selectedDetail && <><WorkDetailContent work={selectedDetail} compact partyCatalog={partyCatalog} /><a className="button" href={`/obras/${selectedDetail.obraId}?revisionId=${selectedDetail.revisionId}`}>Abrir ficha completa</a></>}
    </dialog>
  </div>;
}
