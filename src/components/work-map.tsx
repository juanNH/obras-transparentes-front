/** @file Adaptador OpenLayers Canvas: cartografía 2D, interacción accesible y liberación de fuentes/eventos al desmontar. */
"use client";

import { useEffect, useId, useRef, useState } from "react";
import Map from "ol/Map.js";
import View from "ol/View.js";
import type Feature from "ol/Feature.js";
import GeoJSON from "ol/format/GeoJSON.js";
import type Geometry from "ol/geom/Geometry.js";
import type Point from "ol/geom/Point.js";
import LayerGroup from "ol/layer/Group.js";
import Layer from "ol/layer/Layer.js";
import VectorLayer from "ol/layer/Vector.js";
import VectorTileLayer from "ol/layer/VectorTile.js";
import VectorSource from "ol/source/Vector.js";
import Cluster from "ol/source/Cluster.js";
import Attribution from "ol/control/Attribution.js";
import { defaults as defaultInteractions } from "ol/interaction/defaults.js";
import DragPan from "ol/interaction/DragPan.js";
import MouseWheelZoom from "ol/interaction/MouseWheelZoom.js";
import KeyboardPan from "ol/interaction/KeyboardPan.js";
import KeyboardZoom from "ol/interaction/KeyboardZoom.js";
import { noModifierKeys, platformModifierKeyOnly } from "ol/events/condition.js";
import { transformExtent } from "ol/proj.js";
import { createEmpty, extend } from "ol/extent.js";
import { unByKey } from "ol/Observable.js";
import type { EventsKey } from "ol/events.js";
import { listen } from "ol/events.js";
import { Circle, Fill, RegularShape, Stroke, Style, Text } from "ol/style.js";
import { apply } from "ol-mapbox-style";
import "ol/ol.css";
import type { BoundingBox, PartyBoundaries, WorkGeoJSON } from "../api/client.js";
import { clampMapBBox, partitionMapFeatures, selectedMapFeatures, type MapProperties } from "../lib/map-data.js";
import { MAP_ORIGINS, type MapOriginCategory } from "../lib/map-origin.js";
import { canvasMapStyle, MAP_FONT_STYLESHEET, withoutOptionalOpenFreeMapCredit } from "../lib/map-style.js";
import { LocationQuality } from "./location-quality";
import { SourceBadge } from "./source-origin";

/** Datos cartográficos y callbacks de consulta/selección; mover la cámara nunca confirma por sí solo un filtro. */
export interface WorkMapProps {
  features: WorkGeoJSON["features"];
  selectionFeatures: WorkGeoJSON["features"];
  /** Capa administrativa independiente; sus posiciones no pertenecen al presupuesto de obras. */
  partyFeatures?: PartyBoundaries["features"];
  selectedPartidoId?: string | null;
  onPartySelect?: (partidoId: string) => void;
  /** Initial permission for this mount; remembered or explicit areas disable it. */
  autoFit: boolean;
  preserveCamera: boolean;
  selectionFocus?: number;
  initialBBox: BoundingBox;
  selectedId: string | null;
  selectedLocationId?: string | null;
  selectedRevisionId?: string | null;
  focusBBox: BoundingBox | null;
  onViewport: (bbox: BoundingBox) => void;
  onSelect: (obraId: string, revisionId: string, ubicacionId: string) => void;
  styleUrl: string;
}

const geojson = new GeoJSON({ dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" });
// Canvas layers use the same source colors and symbols shown in the HTML legend.
const MAP_PALETTE = {
  selected: "#0a4c78",
  halo: "#ffffff",
} as const;

/** Crea el marcador de una categoría conservando color, forma y contorno distinguible. */
function markerImage(category: MapOriginCategory, radius: number, outline: string, outlineWidth: number, color: string = MAP_ORIGINS[category].color) {
  const origin = MAP_ORIGINS[category];
  const fill = new Fill({ color });
  const stroke = new Stroke({ color: outline, width: outlineWidth });
  switch (origin.marker) {
    case "square": return new RegularShape({ points: 4, radius, angle: Math.PI / 4, fill, stroke });
    case "triangle": return new RegularShape({ points: 3, radius, angle: 0, fill, stroke });
    case "diamond": return new RegularShape({ points: 4, radius, angle: 0, fill, stroke });
    case "hexagon": return new RegularShape({ points: 6, radius, angle: 0, fill, stroke });
    default: return new Circle({ radius, fill, stroke });
  }
}

/** Prepara estilos de puntos, líneas y áreas por fuente con una variante destacada de selección. */
function createOriginStyles(selected = false): Record<MapOriginCategory, Style[]> {
  return Object.fromEntries(Object.keys(MAP_ORIGINS).map((key) => {
    const category = key as MapOriginCategory;
    const origin = MAP_ORIGINS[category];
    return [category, [
      new Style({
        stroke: new Stroke({ color: MAP_PALETTE.halo, width: selected ? 12 : 8 }),
        ...(selected ? { image: markerImage(category, 19, MAP_PALETTE.halo, 5, MAP_PALETTE.halo) } : {}),
      }),
      // The focus outline sits underneath the source color, including linear works.
      ...(selected ? [new Style({ stroke: new Stroke({ color: MAP_PALETTE.selected, width: 8 }) })] : []),
      new Style({
        fill: new Fill({ color: origin.fill }),
        stroke: new Stroke({ color: origin.color, width: 4, ...(origin.lineDash ? { lineDash: [...origin.lineDash] } : {}) }),
        image: markerImage(category, selected ? 16 : 12, selected ? MAP_PALETTE.selected : MAP_PALETTE.halo, selected ? 4 : 2),
      }),
    ]];
  })) as Record<MapOriginCategory, Style[]>;
}

const workStyles = createOriginStyles();
const selectionStyles = createOriginStyles(true);

/** Obtiene la categoría visual almacenada en la feature, con fallback neutral para datos ausentes. */
function featureOrigin(feature: { get(key: string): unknown } | undefined): MapOriginCategory {
  const value = feature?.get("nivelFuente");
  return typeof value === "string" && Object.hasOwn(MAP_ORIGINS, value) ? value as MapOriginCategory : "unknown";
}

/** Construye capas propias de puntos/figuras/selección y clustering de posiciones reales. */
function createWorkLayers() {
  const points = new VectorSource<Feature<Geometry>>({ wrapX: false });
  const shapes = new VectorSource<Feature<Geometry>>({ wrapX: false });
  const selected = new VectorSource<Feature<Geometry>>({ wrapX: false });
  const clusters = new Cluster({ source: points, distance: 48, wrapX: false });
  const styles = new globalThis.Map<string, Style>();
  const pointLayer = new VectorLayer<VectorSource<Feature<Geometry>>>({ source: clusters, style: (feature) => {
    const members = feature.get("features") as Feature<Point>[] | undefined;
    // Above the cluster zoom threshold, OpenLayers renders original points directly.
    if (!members) return workStyles[featureOrigin(feature)];
    if (members.length === 0) return workStyles.unknown;
    if (members.length === 1) return workStyles[featureOrigin(members[0])];
    const count = members.length;
    const categories = new Set(members.map(featureOrigin));
    const category = categories.size === 1 ? categories.values().next().value! : "mixed";
    const key = `${category}:${count}`;
    if (!styles.has(key)) styles.set(key, new Style({
      image: markerImage(category, count < 50 ? 22 : 27, MAP_PALETTE.halo, 3),
      text: new Text({ text: String(count), font: '700 14px "Noto Sans", sans-serif', fill: new Fill({ color: "#ffffff" }) }),
    }));
    return styles.get(key)!;
  } });
  const shapeLayer = new VectorLayer({ source: shapes, style: (feature) => workStyles[featureOrigin(feature)] });
  const selectedLayer = new VectorLayer({ source: selected, style: (feature) => selectionStyles[featureOrigin(feature)] });
  return { points, shapes, selected, clusters, pointLayer, layers: [shapeLayer, pointLayer, selectedLayer] };
}
/** Capas, fuentes y cachés propias que deben liberarse al desmontar el adaptador. */
type WorkLayers = ReturnType<typeof createWorkLayers>;

const partyStyle = new Style({ fill: new Fill({ color: "rgba(116,182,232,0.05)" }), stroke: new Stroke({ color: "#6b859b", width: 1.5, lineDash: [6, 4] }) });
const selectedPartyStyle = new Style({ fill: new Fill({ color: "rgba(116,182,232,0.16)" }), stroke: new Stroke({ color: "#0a4c78", width: 3, lineDash: [6, 4] }) });

/** Mantiene sólo la identidad seleccionada en el callback de estilo, sin retener el contexto del efecto React. */
class PartyLayerStyles {
  selectedId: string | null = null;
  /** Distingue el partido seleccionado sin reutilizar estilos de obras ni atribuirle gestión. */
  style(feature: { get(key: string): unknown }) {
    return feature.get("partidoId") === this.selectedId ? selectedPartyStyle : partyStyle;
  }
}

/** Crea fuente y capa administrativa sin mezclarla con clustering, selección ni conteos de obras. */
function createPartyLayer() {
  const source = new VectorSource<Feature<Geometry>>({ wrapX: false });
  const styles = new PartyLayerStyles();
  const layer = new VectorLayer({ source, style: styles.style.bind(styles) });
  return { source, styles, layer };
}
/** Capa nominal y su fuente liberables al desmontar el motor Canvas. */
type PartyLayer = ReturnType<typeof createPartyLayer>;

/** Sustituye límites completos ya conciliados con el padrón; no calcula relaciones espaciales de obras. */
function updatePartyLayer(parties: PartyLayer, features: PartyBoundaries["features"] | undefined, selectedId: string | null | undefined) {
  parties.styles.selectedId = selectedId ?? null;
  parties.source.clear(true);
  if (features?.length) parties.source.addFeatures(geojson.readFeatures({ type: "FeatureCollection", features }));
  parties.layer.changed();
}

/** Libera la geometría administrativa y el estilo independiente del motor de obras. */
function disposePartyLayer(parties: PartyLayer) {
  parties.styles.selectedId = null;
  parties.source.clear(true); parties.source.dispose(); parties.layer.dispose();
}

/** Sustituye la capa destacada por la obra/revisión/ubicación exacta elegida y devuelve su identidad cartográfica. */
function updateSelection(work: WorkLayers, features: WorkGeoJSON["features"], selectedId: string | null, ubicacionId?: string | null, revisionId?: string | null): string | null {
  const collection = selectedMapFeatures(partitionMapFeatures(features).all, selectedId, ubicacionId, revisionId);
  const seen = new Set<string | number | undefined>();
  collection.features = collection.features.filter(feature => {
    if (seen.has(feature.id)) return false;
    seen.add(feature.id);
    return true;
  });
  work.selected.clear(true);
  work.selected.addFeatures(geojson.readFeatures(collection));
  return collection.features.length
    ? `${selectedId}:${collection.features.map(feature => `${feature.id}:${feature.properties.revisionId}`).join("|")}`
    : null;
}

/** Lee identidad y calidad de una feature seleccionable; rechaza propiedades incompletas. */
function featureLocation(feature: Feature<Geometry>): MapProperties | null {
  const properties = feature.getProperties() as Partial<MapProperties>;
  if (typeof properties.obraId !== "string" || typeof properties.revisionId !== "string" ||
    typeof properties.ubicacionId !== "string" || typeof properties.nombre !== "string" ||
    properties.calidad?.condicion !== "ACCEPTED" || !properties.fuentes || !properties.nivelFuente) return null;
  return { obraId: properties.obraId, revisionId: properties.revisionId, ubicacionId: properties.ubicacionId, nombre: properties.nombre, calidad: properties.calidad, fuentes: properties.fuentes, nivelFuente: properties.nivelFuente };
}
/** Sustituye fuentes de la consulta con puntos y figuras reales, sin generar centroides de líneas o áreas. */
function updateWorks(work: WorkLayers, features: WorkGeoJSON["features"]) {
  const data = partitionMapFeatures(features);
  work.points.clear(true); work.points.addFeatures(geojson.readFeatures(data.points) as Feature<Point>[]);
  work.shapes.clear(true); work.shapes.addFeatures(geojson.readFeatures(data.shapes));
}
/** Encuadra un bbox WGS84 en Mercator, preservando la cámara cuando la presentación así lo solicita. */
function fit(map: Map, bbox: BoundingBox, restoreCamera = false) {
  const bounds = clampMapBBox(bbox);
  if (bounds) map.getView().fit(transformExtent([...bounds], "EPSG:4326", "EPSG:3857"), {
    padding: restoreCamera ? [0, 0, 0, 0] : [36, 36, 36, 36],
    ...(restoreCamera ? {} : { maxZoom: 16 }), duration: 0,
  });
}

/** Fit rendered geometry extents directly: a Point's zero-size extent is valid. */
function fitSources(map: Map, sources: readonly VectorSource<Feature<Geometry>>[]): boolean {
  const extent = createEmpty();
  for (const source of sources) {
    const bounds = source.getExtent();
    if (bounds && bounds.every(Number.isFinite)) extend(extent, bounds);
  }
  if (!extent.every(Number.isFinite)) return false;
  map.getView().fit(extent, { padding: [36, 36, 36, 36], maxZoom: 16, duration: 0 });
  return true;
}

// The adapter caches request options. Bind a shared prototype method rather
// than a closure factory that production minification can inline in the effect.
/** Conserva la señal cancelable de los recursos del estilo sin retener el efecto React en callbacks cacheados. */
class StyleRequests {
  /** Asocia las solicitudes cartográficas con la cancelación del ciclo de vida del mapa. */
  constructor(private signal: AbortSignal | null) {}
  /** Crea una solicitud del proveedor sin credenciales y con señal cancelable al desmontar. */
  request(url: string) { return new Request(url, { credentials: "omit", signal: this.signal ?? AbortSignal.abort("Map disposed") }); }
  /** Retira la referencia de cancelación; toda solicitud posterior queda abortada y no retiene el montaje. */
  dispose() { this.signal = null; }
}
/** Desvincula capas, clustering, fuentes y cachés de estilos para evitar retener el contexto de React. */
function disposeWorkLayers(works: WorkLayers) {
  for (const layer of works.layers) layer.dispose();
  works.clusters.setSource(null);
  works.clusters.clear(true);
  works.clusters.dispose();
  for (const source of [works.points, works.shapes, works.selected]) {
    source.clear(true);
    source.dispose();
  }
}

/**
 * Gestiona mapa Canvas 2D, selección exacta, fallas recuperables del proveedor y limpieza al desmontar.
 * @param props - Features presupuestadas y acciones explícitas proporcionadas por Explorer.
 * @returns Mapa con controles de teclado/táctiles y atribución visible.
 */
export default function WorkMap(props: WorkMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const attribution = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const worksRef = useRef<WorkLayers | null>(null);
  const partiesRef = useRef<PartyLayer | null>(null);
  const current = useRef(props);
  const autoFitPending = useRef(props.autoFit);
  const selectionFitKey = useRef<string | null>(null);
  const instructionId = useId();
  const tooltipId = useId();
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [baseLoading, setBaseLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [hoveredLocation, setHoveredLocation] = useState<MapProperties | null>(null);
  useEffect(() => {
    if (!hoveredLocation) return;
    /** Descarta ayuda contextual con Escape desde cualquier foco de la página. */
    const dismiss = (event: KeyboardEvent) => { if (event.key === "Escape") setHoveredLocation(null); };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [hoveredLocation]);
  current.current = props;

  useEffect(() => {
    if (!container.current || !attribution.current) return;
    const target = container.current;
    let active = true;
    let styleApplied = false;
    let providerFailed = false;
    const controller = new AbortController();
    const requests = new StyleRequests(controller.signal);
    const subscriptions: EventsKey[] = [];
    const base = new LayerGroup();
    const works = createWorkLayers();
    const parties = createPartyLayer();
    let map: Map;
    let observer: ResizeObserver | undefined;
    setStatus("loading"); setBaseLoading(true); setWarning(null);
    /** Marca fallas del proveedor como recuperables sin retirar la lista pública ni reiniciar la cámara. */
    const warn = () => {
      if (!active) return;
      providerFailed = true; setBaseLoading(false);
      window.clearTimeout(timeout);
      setWarning("No se pudo cargar una parte del mapa. La lista sigue disponible para consultar las obras.");
    };
    const timeout = window.setTimeout(() => {
      if (active && !styleApplied) warn();
      else if (active) setWarning("El mapa está tardando en cargar. Podés seguir explorando las obras desde la lista.");
    }, 20000);

    // Cancel a pending data fit as soon as the visitor starts navigating the map.
    /** Cancela el autoencuadre pendiente cuando el usuario empieza a mover o ampliar el mapa. */
    const onUserInput = (event: Event) => {
      if (event.type === "wheel" && !(event as WheelEvent).ctrlKey && !(event as WheelEvent).metaKey) return;
      if (event.type === "keydown" && !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "+", "-", "="].includes((event as KeyboardEvent).key)) return;
      autoFitPending.current = false;
    };
    target.addEventListener("pointerdown", onUserInput);
    target.addEventListener("wheel", onUserInput, { passive: true });
    target.addEventListener("keydown", onUserInput);
    /** Retira listeners de interacción registrados para este montaje del mapa. */
    const removeUserInput = () => {
      target.removeEventListener("pointerdown", onUserInput);
      target.removeEventListener("wheel", onUserInput);
      target.removeEventListener("keydown", onUserInput);
    };

    try {
      if (!document.createElement("canvas").getContext("2d")) throw new Error("Canvas 2D no disponible");
      const dragPan = new DragPan({ condition: (event) => noModifierKeys(event) &&
        (!("pointerType" in event.originalEvent) || event.originalEvent.pointerType !== "touch" || (event.activePointers?.length ?? 0) >= 2) });
      map = new Map({
        target: container.current, layers: [base, parties.layer, ...works.layers],
        controls: [new Attribution({ target: attribution.current, collapsed: false, collapsible: false })],
        interactions: defaultInteractions({ altShiftDragRotate: false, pinchRotate: false, dragPan: false, mouseWheelZoom: false, keyboard: false, zoomDuration: 0 })
          .extend([dragPan, new MouseWheelZoom({ condition: platformModifierKeyOnly, duration: 0 }), new KeyboardPan({ duration: 0 }), new KeyboardZoom({ duration: 0 })]),
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2), maxTilesLoading: 8,
        view: new View({ center: [0, 0], zoom: 2, minZoom: 1, maxZoom: 19, enableRotation: false, multiWorld: false }),
      });
      mapRef.current = map; worksRef.current = works; partiesRef.current = parties;
      updatePartyLayer(parties, current.current.partyFeatures, current.current.selectedPartidoId);
      updateWorks(works, current.current.features);
      const selectedKey = updateSelection(works, current.current.selectionFeatures, current.current.selectedId, current.current.selectedLocationId, current.current.selectedRevisionId);
      fit(map, current.current.focusBBox ?? current.current.initialBBox, current.current.preserveCamera && !current.current.focusBBox);
      if (current.current.selectedId || current.current.focusBBox) autoFitPending.current = false;
      if (selectedKey && (current.current.preserveCamera || fitSources(map, [works.selected]))) {
        selectionFitKey.current = `${current.current.selectionFocus ?? 0}:${selectedKey}`;
      } else if (autoFitPending.current && fitSources(map, [works.points, works.shapes])) {
        autoFitPending.current = false;
      }
      /** Publica el bbox candidato de una cámara válida sin consultar la API automáticamente. */
      const publishViewport = () => {
        if (!active) return;
        setHoveredLocation(null);
        const extent = transformExtent(map.getView().calculateExtent(map.getSize()), "EPSG:3857", "EPSG:4326");
        const bbox = clampMapBBox([extent[0]!, extent[1]!, extent[2]!, extent[3]!]);
        if (bbox) current.current.onViewport(bbox);
      };
      subscriptions.push(map.on("moveend", publishViewport));
      /** Usa puntos individuales al acercar y clustering a menor zoom; las figuras permanecen intactas. */
      const updateClustering = () => works.pointLayer.setSource((map.getView().getZoom() ?? 0) > 14 ? works.points : works.clusters);
      subscriptions.push(map.getView().on("change:resolution", updateClustering));
      updateClustering();
      subscriptions.push(map.once("postrender", () => { if (active) { setStatus("ready"); publishViewport(); } }));
      subscriptions.push(map.on("rendercomplete", () => {
        if (active && styleApplied) { setBaseLoading(false); window.clearTimeout(timeout); if (!providerFailed) setWarning(null); }
      }));
      subscriptions.push(map.on("click", (event) => {
        const feature = map.forEachFeatureAtPixel(event.pixel, (item) => item, {
          hitTolerance: 10, layerFilter: (layer) => works.layers.includes(layer as typeof works.layers[number]),
        });
        if (!feature) {
          const territory = map.forEachFeatureAtPixel(event.pixel, item => item, { hitTolerance: 4, layerFilter: layer => layer === parties.layer });
          const partyId = territory?.get("partidoId");
          if (typeof partyId === "string") current.current.onPartySelect?.(partyId);
          return;
        }
        const members = feature.get("features") as Feature<Point>[] | undefined;
        if (members && members.length > 1) {
          const extent = createEmpty();
          for (const member of members) extend(extent, member.getGeometry()!.getExtent());
          map.getView().fit(extent, { padding: [40, 40, 40, 40], maxZoom: 16, duration: 0 });
          return;
        }
        const selected = members?.[0] ?? feature;
        const location = featureLocation(selected as Feature<Geometry>);
        if (location) {
          setHoveredLocation(null);
          current.current.onSelect(location.obraId, location.revisionId, location.ubicacionId);
        }
      }));
      subscriptions.push(map.on("pointermove", (event) => {
        if (event.dragging || (event.originalEvent as PointerEvent).pointerType === "touch") { setHoveredLocation(null); return; }
        const feature = map.forEachFeatureAtPixel(event.pixel, (item) => item, {
          hitTolerance: 10, layerFilter: (layer) => works.layers.includes(layer as typeof works.layers[number]),
        });
        const territory = !feature && map.forEachFeatureAtPixel(event.pixel, item => item, { hitTolerance: 4, layerFilter: layer => layer === parties.layer });
        map.getTargetElement().style.cursor = feature || territory ? "pointer" : "";
        const members = feature?.get("features") as Feature<Point>[] | undefined;
        const location = feature && (!members || members.length === 1) ? featureLocation((members?.[0] ?? feature) as Feature<Geometry>) : null;
        // Keep the last point's help while crossing the canvas to read it.
        // Leaving the map, Escape or navigation dismisses it.
        if (location) setHoveredLocation(previous => previous?.ubicacionId === location.ubicacionId && previous?.revisionId === location.revisionId ? previous : location);
      }));
      observer = new ResizeObserver(() => map.updateSize()); observer.observe(container.current);
    } catch {
      window.clearTimeout(timeout);
      removeUserInput();
      requests.dispose();
      observer?.disconnect(); unByKey(subscriptions);
      mapRef.current?.getLayers().clear(); mapRef.current?.dispose();
      disposeWorkLayers(works); base.dispose();
      disposePartyLayer(parties);
      mapRef.current = null; worksRef.current = null; partiesRef.current = null;
      setStatus("unavailable"); setBaseLoading(false);
      return;
    }

    // Watch sources as they attach: a tile error can precede apply() resolution.
    const watched = new WeakSet<object>();
    subscriptions.push(base.getLayers().on("add", ({ element: layer }) => {
      if (!(layer instanceof Layer)) return;
      if (layer instanceof VectorTileLayer) layer.setPreload(0);
      /** Suscribe errores de una fuente nueva una sola vez, incluso antes de resolver la carga del estilo. */
      const watchSource = () => {
        const source = layer.getSource();
        if (!source || watched.has(source)) return;
        watched.add(source);
        for (const event of ["tileloaderror", "featuresloaderror", "error"]) subscriptions.push(listen(source, event, warn));
        subscriptions.push(source.on("change", () => { if (source.getState() === "error") warn(); }));
        if (source.getState() === "error") warn();
      };
      subscriptions.push(layer.on("change:source", watchSource)); watchSource();
    }));
    void (async () => {
      const response = await fetch(props.styleUrl, { credentials: "omit", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      if (!response.ok) throw new Error("Style unavailable");
      const style = canvasMapStyle(await response.json());
      if (!active) return;
      await apply(base, style, {
        styleUrl: props.styleUrl, webfonts: MAP_FONT_STYLESHEET,
        transformRequest: requests.request.bind(requests),
      });
      if (!active) {
        for (const layer of base.getLayers().getArray()) layer.dispose();
        base.getLayers().clear(); return;
      }
      // Credits arrive through TileJSON; only the optional provider brand is omitted.
      const creditedSources = new Set<object>();
      for (const layer of base.getLayers().getArray()) {
        if (!(layer instanceof Layer)) continue;
        const source = layer.getSource();
        if (!source || creditedSources.has(source)) continue;
        creditedSources.add(source);
        source.setAttributions(withoutOptionalOpenFreeMapCredit(source.getAttributions()));
      }
      styleApplied = true;
      // Confirm readiness on a rendered frame rather than only on style JSON.
      map.render();
    })().catch(() => { if (active && !controller.signal.aborted) warn(); });

    return () => {
      active = false; controller.abort(); requests.dispose(); window.clearTimeout(timeout); removeUserInput(); observer?.disconnect(); unByKey(subscriptions);
      map.getLayers().clear();
      disposeWorkLayers(works);
      disposePartyLayer(parties);
      for (const layer of base.getLayers().getArray()) layer.dispose();
      base.getLayers().clear(); base.dispose(); map.dispose(); mapRef.current = null; worksRef.current = null; partiesRef.current = null; selectionFitKey.current = null;
    };
  }, [props.styleUrl, attempt]);

  useEffect(() => {
    const works = worksRef.current; const map = mapRef.current;
    if (!works || !map) return;
    setHoveredLocation(null);
    updateWorks(works, props.features);
    if (autoFitPending.current && fitSources(map, [works.points, works.shapes])) autoFitPending.current = false;
  }, [props.features]);
  useEffect(() => {
    if (partiesRef.current) updatePartyLayer(partiesRef.current, props.partyFeatures, props.selectedPartidoId);
  }, [props.partyFeatures, props.selectedPartidoId]);
  useEffect(() => {
    const works = worksRef.current; const map = mapRef.current;
    if (!works || !map) return;
    if (props.selectedId) autoFitPending.current = false;
    const selectedKey = updateSelection(works, props.selectionFeatures, props.selectedId, props.selectedLocationId, props.selectedRevisionId);
    const key = selectedKey ? `${props.selectionFocus ?? 0}:${selectedKey}` : null;
    if (!key) { selectionFitKey.current = null; return; }
    if (key !== selectionFitKey.current && fitSources(map, [works.selected])) selectionFitKey.current = key;
  }, [props.selectionFeatures, props.selectedId, props.selectedLocationId, props.selectedRevisionId, props.selectionFocus]);
  useEffect(() => {
    if (mapRef.current && props.focusBBox) {
      autoFitPending.current = false;
      fit(mapRef.current, props.focusBBox);
    }
  }, [props.focusBBox]);

  /** Amplía/reduce mediante control explícito y desactiva el autoencuadre pendiente. */
  const zoom = (delta: number) => { autoFitPending.current = false; const view = mapRef.current?.getView(); if (view) view.setZoom((view.getZoom() ?? 0) + delta); };
  /** Desplaza cámara en píxeles de pantalla usando su resolución y evita modificar filtros de consulta. */
  const pan = (x: number, y: number) => {
    autoFitPending.current = false;
    const view = mapRef.current?.getView(); const center = view?.getCenter(); const resolution = view?.getResolution();
    if (center && resolution) view!.setCenter([center[0]! + x * resolution, center[1]! - y * resolution]);
  };
  return <section className="work-map" aria-label="Mapa interactivo de obras" data-map-state={status}>
    <div role="group" aria-label="Controles del mapa" className="map-controls">
      <button className="button button-secondary" type="button" disabled={status !== "ready"} aria-label="Acercar mapa" onClick={() => zoom(1)}>+</button>
      <button className="button button-secondary" type="button" disabled={status !== "ready"} aria-label="Alejar mapa" onClick={() => zoom(-1)}>−</button>
      <button className="button button-secondary" type="button" disabled={status !== "ready"} aria-label="Mover mapa al norte" onClick={() => pan(0, -150)}>↑</button>
      <button className="button button-secondary" type="button" disabled={status !== "ready"} aria-label="Mover mapa al sur" onClick={() => pan(0, 150)}>↓</button>
      <button className="button button-secondary" type="button" disabled={status !== "ready"} aria-label="Mover mapa al oeste" onClick={() => pan(-150, 0)}>←</button>
      <button className="button button-secondary" type="button" disabled={status !== "ready"} aria-label="Mover mapa al este" onClick={() => pan(150, 0)}>→</button>
    </div>
    {baseLoading && <p role="status">Cargando mapa base…</p>}
    {status === "unavailable" && <p role="status">No pudimos mostrar el mapa en este dispositivo. Podés explorar las mismas obras desde la lista.</p>}
    {warning && <p role="status">{warning}</p>}
    {(warning || status === "unavailable") && <button type="button" className="button button-secondary" onClick={() => setAttempt(value => value + 1)}>Reintentar mapa</button>}
    <div className="map-canvas-wrap" onPointerLeave={() => setHoveredLocation(null)}>
      <div ref={container} className="map-canvas" role="region" aria-label="Área del mapa" aria-describedby={hoveredLocation ? `${instructionId} ${tooltipId}` : instructionId} tabIndex={0} onKeyDown={event => { if (event.key === "Escape") setHoveredLocation(null); }} />
      {hoveredLocation && <div className="map-location-tooltip" id={tooltipId} role="tooltip">
        <p className="tooltip-work-name">{hoveredLocation.nombre}</p>
        <p className="tooltip-source"><SourceBadge sources={hoveredLocation.fuentes} /></p>
        <LocationQuality location={hoveredLocation.calidad} />
      </div>}
    </div>
    <div className="map-credits-row">
      <div ref={attribution} className="map-attribution" role="group" aria-label="Atribución del mapa" />
      <a className="map-credits-link" href="/proyecto#mapa">Créditos del mapa</a>
    </div>
    <details className="map-help"><summary>Cómo recorrer el mapa</summary><p id={instructionId}>Usá las flechas del teclado o los botones para mover el mapa. En pantallas táctiles, usá dos dedos; con mouse, Ctrl o ⌘ y la rueda para acercar. Los grupos cuentan puntos, no obras: una obra puede tener varias ubicaciones. La lista permite acceder a todas las fichas de la consulta.</p></details>
  </section>;
}
