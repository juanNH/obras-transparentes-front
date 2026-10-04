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
import { Circle, Fill, Stroke, Style, Text } from "ol/style.js";
import { apply } from "ol-mapbox-style";
import "ol/ol.css";
import type { BoundingBox, WorkGeoJSON } from "../api/client.js";
import { clampMapBBox, partitionMapFeatures, selectedMapFeatures } from "../lib/map-data.js";
import { canvasMapStyle, MAP_FONT_STYLESHEET } from "../lib/map-style.js";

export interface WorkMapProps {
  features: WorkGeoJSON["features"];
  initialBBox: BoundingBox;
  selectedId: string | null;
  focusBBox: BoundingBox | null;
  onViewport: (bbox: BoundingBox) => void;
  onSelect: (obraId: string, revisionId: string) => void;
  styleUrl: string;
}

const geojson = new GeoJSON({ dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" });
const workStyle = new Style({
  fill: new Fill({ color: "rgba(36,100,84,0.25)" }), stroke: new Stroke({ color: "#123e34", width: 4 }),
  image: new Circle({ radius: 12, fill: new Fill({ color: "#123e34" }), stroke: new Stroke({ color: "#fff", width: 2 }) }),
});
const selectionStyle = new Style({
  fill: new Fill({ color: "rgba(191,70,12,0.3)" }), stroke: new Stroke({ color: "#bf460c", width: 6 }),
  image: new Circle({ radius: 14, fill: new Fill({ color: "#bf460c" }), stroke: new Stroke({ color: "#fff", width: 3 }) }),
});

function createWorkLayers() {
  const points = new VectorSource<Feature<Geometry>>({ wrapX: false });
  const shapes = new VectorSource<Feature<Geometry>>({ wrapX: false });
  const selected = new VectorSource<Feature<Geometry>>({ wrapX: false });
  const clusters = new Cluster({ source: points, distance: 48, wrapX: false });
  const styles = new globalThis.Map<number, Style>();
  const pointLayer = new VectorLayer<VectorSource<Feature<Geometry>>>({ source: clusters, style: (feature) => {
    const members = feature.get("features") as Feature<Point>[] | undefined;
    if (!members || members.length <= 1) return workStyle;
    const count = members.length;
    if (!styles.has(count)) styles.set(count, new Style({
      image: new Circle({ radius: count < 50 ? 22 : 27, fill: new Fill({ color: "#123e34" }), stroke: new Stroke({ color: "#fff", width: 2 }) }),
      text: new Text({ text: String(count), font: "bold 14px sans-serif", fill: new Fill({ color: "#fff" }) }),
    }));
    return styles.get(count)!;
  } });
  const shapeLayer = new VectorLayer({ source: shapes, style: workStyle });
  const selectedLayer = new VectorLayer({ source: selected, style: selectionStyle });
  return { points, shapes, selected, clusters, pointLayer, layers: [shapeLayer, pointLayer, selectedLayer] };
}
type WorkLayers = ReturnType<typeof createWorkLayers>;

function updateSelection(work: WorkLayers, features: WorkGeoJSON["features"], selectedId: string | null) {
  work.selected.clear(true);
  work.selected.addFeatures(geojson.readFeatures(selectedMapFeatures(partitionMapFeatures(features).all, selectedId)));
}
function updateWorks(work: WorkLayers, features: WorkGeoJSON["features"], selectedId: string | null) {
  const data = partitionMapFeatures(features);
  work.points.clear(true); work.points.addFeatures(geojson.readFeatures(data.points) as Feature<Point>[]);
  work.shapes.clear(true); work.shapes.addFeatures(geojson.readFeatures(data.shapes));
  updateSelection(work, features, selectedId);
}
function fit(map: Map, bbox: BoundingBox) {
  const bounds = clampMapBBox(bbox);
  if (bounds) map.getView().fit(transformExtent([...bounds], "EPSG:4326", "EPSG:3857"), { padding: [36, 36, 36, 36], maxZoom: 16, duration: 0 });
}

// The adapter caches request options. Bind a shared prototype method rather
// than a closure factory that production minification can inline in the effect.
class StyleRequests {
  constructor(private signal: AbortSignal | null) {}
  request(url: string) { return new Request(url, { credentials: "omit", signal: this.signal ?? AbortSignal.abort("Map disposed") }); }
  dispose() { this.signal = null; }
}
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

export default function WorkMap(props: WorkMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const attribution = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const worksRef = useRef<WorkLayers | null>(null);
  const current = useRef(props);
  const instructionId = useId();
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [baseLoading, setBaseLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  current.current = props;

  useEffect(() => {
    if (!container.current || !attribution.current) return;
    let active = true;
    let styleApplied = false;
    let providerFailed = false;
    const controller = new AbortController();
    const requests = new StyleRequests(controller.signal);
    const subscriptions: EventsKey[] = [];
    const base = new LayerGroup();
    const works = createWorkLayers();
    let map: Map;
    let observer: ResizeObserver | undefined;
    setStatus("loading"); setBaseLoading(true); setWarning(null);
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

    try {
      if (!document.createElement("canvas").getContext("2d")) throw new Error("Canvas 2D no disponible");
      const dragPan = new DragPan({ condition: (event) => noModifierKeys(event) &&
        (!("pointerType" in event.originalEvent) || event.originalEvent.pointerType !== "touch" || (event.activePointers?.length ?? 0) >= 2) });
      map = new Map({
        target: container.current, layers: [base, ...works.layers],
        controls: [new Attribution({ target: attribution.current, collapsed: false, collapsible: false })],
        interactions: defaultInteractions({ altShiftDragRotate: false, pinchRotate: false, dragPan: false, mouseWheelZoom: false, keyboard: false, zoomDuration: 0 })
          .extend([dragPan, new MouseWheelZoom({ condition: platformModifierKeyOnly, duration: 0 }), new KeyboardPan({ duration: 0 }), new KeyboardZoom({ duration: 0 })]),
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2), maxTilesLoading: 8,
        view: new View({ center: [0, 0], zoom: 2, minZoom: 1, maxZoom: 19, enableRotation: false, multiWorld: false }),
      });
      mapRef.current = map; worksRef.current = works;
      updateWorks(works, current.current.features, current.current.selectedId);
      fit(map, current.current.focusBBox ?? current.current.initialBBox);
      const publishViewport = () => {
        if (!active) return;
        const extent = transformExtent(map.getView().calculateExtent(map.getSize()), "EPSG:3857", "EPSG:4326");
        const bbox = clampMapBBox([extent[0]!, extent[1]!, extent[2]!, extent[3]!]);
        if (bbox) current.current.onViewport(bbox);
      };
      subscriptions.push(map.on("moveend", publishViewport));
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
        if (!feature) return;
        const members = feature.get("features") as Feature<Point>[] | undefined;
        if (members && members.length > 1) {
          const extent = createEmpty();
          for (const member of members) extend(extent, member.getGeometry()!.getExtent());
          map.getView().fit(extent, { padding: [40, 40, 40, 40], maxZoom: 16, duration: 0 });
          return;
        }
        const selected = members?.[0] ?? feature;
        const obraId: unknown = selected.get("obraId");
        const revisionId: unknown = selected.get("revisionId");
        if (typeof obraId === "string" && typeof revisionId === "string") current.current.onSelect(obraId, revisionId);
      }));
      subscriptions.push(map.on("pointermove", (event) => {
        if (!event.dragging) map.getTargetElement().style.cursor = map.hasFeatureAtPixel(event.pixel, {
          hitTolerance: 10, layerFilter: (layer) => works.layers.includes(layer as typeof works.layers[number]),
        }) ? "pointer" : "";
      }));
      observer = new ResizeObserver(() => map.updateSize()); observer.observe(container.current);
    } catch {
      window.clearTimeout(timeout);
      requests.dispose();
      observer?.disconnect(); unByKey(subscriptions);
      mapRef.current?.getLayers().clear(); mapRef.current?.dispose();
      disposeWorkLayers(works); base.dispose();
      mapRef.current = null; worksRef.current = null;
      setStatus("unavailable"); setBaseLoading(false);
      return;
    }

    // Watch sources as they attach: a tile error can precede apply() resolution.
    const watched = new WeakSet<object>();
    subscriptions.push(base.getLayers().on("add", ({ element: layer }) => {
      if (!(layer instanceof Layer)) return;
      if (layer instanceof VectorTileLayer) layer.setPreload(0);
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
      styleApplied = true;
      // Confirm readiness on a rendered frame rather than only on style JSON.
      map.render();
    })().catch(() => { if (active && !controller.signal.aborted) warn(); });

    return () => {
      active = false; controller.abort(); requests.dispose(); window.clearTimeout(timeout); observer?.disconnect(); unByKey(subscriptions);
      map.getLayers().clear();
      disposeWorkLayers(works);
      for (const layer of base.getLayers().getArray()) layer.dispose();
      base.getLayers().clear(); base.dispose(); map.dispose(); mapRef.current = null; worksRef.current = null;
    };
  }, [props.styleUrl, attempt]);

  useEffect(() => { if (worksRef.current) updateWorks(worksRef.current, props.features, props.selectedId); }, [props.features]);
  useEffect(() => { if (worksRef.current) updateSelection(worksRef.current, current.current.features, props.selectedId); }, [props.selectedId]);
  useEffect(() => { if (mapRef.current && props.focusBBox) fit(mapRef.current, props.focusBBox); }, [props.focusBBox]);

  const zoom = (delta: number) => { const view = mapRef.current?.getView(); if (view) view.setZoom((view.getZoom() ?? 0) + delta); };
  const pan = (x: number, y: number) => {
    const view = mapRef.current?.getView(); const center = view?.getCenter(); const resolution = view?.getResolution();
    if (center && resolution) view!.setCenter([center[0]! + x * resolution, center[1]! - y * resolution]);
  };
  return <section className="work-map" aria-label="Mapa interactivo de obras" data-map-state={status}>
    <p id={instructionId} className="map-help">Usá las flechas del teclado o los botones para mover el mapa. En pantallas táctiles, usá dos dedos; con mouse, Ctrl o ⌘ y la rueda para acercar. Los grupos cuentan puntos, no obras: una obra puede tener varias ubicaciones. La lista permite acceder a todas las fichas de la consulta.</p>
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
    <div ref={container} className="map-canvas" role="region" aria-label="Área del mapa" aria-describedby={instructionId} tabIndex={0} />
    <div ref={attribution} className="map-attribution" aria-label="Atribución del mapa" />
  </section>;
}
