"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Map as LibreMap, AttributionControl, setWorkerCount, setWorkerUrl } from "maplibre-gl";
import type { GeoJSONSource, MapGeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { BoundingBox, WorkGeoJSON } from "../api/client.js";
import { clampMapBBox, partitionMapFeatures, selectedMapFeatures } from "../lib/map-data.js";

export interface WorkMapProps {
  features: WorkGeoJSON["features"];
  initialBBox: BoundingBox;
  selectedId: string | null;
  focusBBox: BoundingBox | null;
  onViewport: (bbox: BoundingBox) => void;
  onSelect: (obraId: string, revisionId: string) => void;
  styleUrl: string;
}

const POINTS = "obras-points";
const SHAPES = "obras-shapes";
const SELECTED = "obras-selected";
const INTERACTIVE_LAYERS = ["obras-point", "obras-line", "obras-area", "obras-selected-point", "obras-selected-line", "obras-selected-area"];
const EMPTY = { type: "FeatureCollection" as const, features: [] };

function addWorkLayers(map: LibreMap) {
  map.addSource(POINTS, { type: "geojson", data: EMPTY, cluster: true, clusterMaxZoom: 14, clusterRadius: 48 });
  map.addSource(SHAPES, { type: "geojson", data: EMPTY });
  map.addSource(SELECTED, { type: "geojson", data: EMPTY });
  map.addLayer({ id: "obras-area", type: "fill", source: SHAPES, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": "#246454", "fill-opacity": 0.25, "fill-outline-color": "#123e34" } });
  map.addLayer({ id: "obras-line", type: "line", source: SHAPES, paint: { "line-color": "#123e34", "line-width": 4 } });
  map.addLayer({ id: "obras-cluster", type: "circle", source: POINTS, filter: ["has", "point_count"], paint: { "circle-color": "#123e34", "circle-radius": ["step", ["get", "point_count"], 22, 50, 27, 250, 33], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
  map.addLayer({ id: "obras-cluster-count", type: "symbol", source: POINTS, filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Regular"], "text-size": 14 }, paint: { "text-color": "#fff" } });
  map.addLayer({ id: "obras-point", type: "circle", source: POINTS, filter: ["!", ["has", "point_count"]], paint: { "circle-color": "#123e34", "circle-radius": 12, "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
  map.addLayer({ id: "obras-selected-area", type: "fill", source: SELECTED, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": "#bf460c", "fill-opacity": 0.3 } });
  map.addLayer({ id: "obras-selected-line", type: "line", source: SELECTED, filter: ["!=", ["geometry-type"], "Point"], paint: { "line-color": "#bf460c", "line-width": 6 } });
  map.addLayer({ id: "obras-selected-point", type: "circle", source: SELECTED, filter: ["==", ["geometry-type"], "Point"], paint: { "circle-color": "#bf460c", "circle-radius": 14, "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
}

function updateWorkLayers(map: LibreMap, features: WorkGeoJSON["features"], selectedId: string | null) {
  const data = partitionMapFeatures(features);
  (map.getSource(POINTS) as GeoJSONSource).setData(data.points);
  (map.getSource(SHAPES) as GeoJSONSource).setData(data.shapes);
  (map.getSource(SELECTED) as GeoJSONSource).setData(selectedMapFeatures(data.all, selectedId));
}

function fit(map: LibreMap, bbox: BoundingBox) {
  const bounds = clampMapBBox(bbox);
  if (bounds) map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 36, maxZoom: 16, duration: 0 });
}

export default function WorkMap(props: WorkMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LibreMap | null>(null);
  const current = useRef(props);
  const initialized = useRef(false);
  const instructionId = useId();
  const [status, setStatus] = useState<"loading" | "recovering" | "ready" | "unavailable">("loading");
  const [warning, setWarning] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  current.current = props;

  useEffect(() => {
    if (!container.current) return;
    let active = true;
    let hadProviderError = false;
    let map: LibreMap;
    let contextRecoveryTimeout = 0;
    initialized.current = false;
    setStatus("loading");
    setWarning(null);
    const timeout = window.setTimeout(() => {
      if (active && !initialized.current) setWarning("El mapa está tardando en cargar. Podés seguir explorando las obras desde la lista.");
    }, 20000);

    try {
      // ESM workers need their shared module beside them; copied from the pinned dependency.
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      // Keep the pilot bounded on low-memory phones.
      setWorkerCount(1);
      map = new LibreMap({
        container: container.current,
        style: props.styleUrl,
        attributionControl: false,
        renderWorldCopies: false,
        minZoom: 1,
        maxZoom: 19,
        dragRotate: false,
        touchPitch: false,
        cooperativeGestures: true,
        locale: {
          "Map.Title": "Mapa de obras. Usá la lista para explorar todas las fichas.",
          "AttributionControl.ToggleAttribution": "Mostrar atribución del mapa",
          "CooperativeGesturesHandler.WindowsHelpText": "Usá Ctrl y la rueda para acercar el mapa",
          "CooperativeGesturesHandler.MacHelpText": "Usá ⌘ y la rueda para acercar el mapa",
          "CooperativeGesturesHandler.MobileHelpText": "Usá dos dedos para mover el mapa o los botones de dirección",
        },
      });
      mapRef.current = map;
      map.touchZoomRotate.disableRotation();
      map.addControl(new AttributionControl({ compact: false }), "bottom-left");
      map.getCanvas().setAttribute("aria-describedby", instructionId);
      fit(map, current.current.focusBBox ?? current.current.initialBBox);
    } catch (error) {
      window.clearTimeout(timeout);
      const message = error instanceof Error ? error.message : String(error);
      console.error("[public-map] No se pudo inicializar MapLibre.", {
        name: error instanceof Error ? error.name : "UnknownError",
        message: message.replace(/https?:\/\/[^\s)]+/gi, "[url]").slice(0, 240),
      });
      setStatus("unavailable");
      mapRef.current?.remove();
      mapRef.current = null;
      return;
    }

    const publishViewport = () => {
      if (!active) return;
      const bounds = map.getBounds();
      const bbox = clampMapBBox([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]);
      if (bbox) current.current.onViewport(bbox);
    };
    const onSelect = (feature: MapGeoJSONFeature) => {
      const obraId: unknown = feature?.properties?.obraId;
      const revisionId: unknown = feature?.properties?.revisionId;
      if (typeof obraId === "string" && typeof revisionId === "string") current.current.onSelect(obraId, revisionId);
    };
    const onCluster = async (feature: MapGeoJSONFeature) => {
      const clusterId: unknown = feature?.properties?.cluster_id;
      if (feature?.geometry.type !== "Point" || typeof clusterId !== "number") return;
      const [longitude, latitude] = feature.geometry.coordinates;
      if (longitude === undefined || latitude === undefined) return;
      try {
        const source = map.getSource(POINTS) as GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        if (active) map.easeTo({ center: [longitude, latitude], zoom, duration: 0 });
      } catch {
        if (active) setWarning("No se pudo abrir este grupo de puntos. Podés acercar el mapa con los controles o usar la lista.");
      }
    };

    map.on("load", () => {
      if (!active) return;
      window.clearTimeout(timeout);
      addWorkLayers(map);
      initialized.current = true;
      updateWorkLayers(map, current.current.features, current.current.selectedId);
      setStatus("ready");
      if (!hadProviderError) setWarning(null);
      publishViewport();
      // One click dispatch avoids selecting twice when a selected shape overlaps its base layer.
      map.on("click", (event) => {
        const feature = map.queryRenderedFeatures(
          [[event.point.x - 10, event.point.y - 10], [event.point.x + 10, event.point.y + 10]],
          { layers: [...INTERACTIVE_LAYERS, "obras-cluster"] },
        )[0];
        if (!feature) return;
        if (feature.properties?.cluster_id !== undefined) void onCluster(feature);
        else onSelect(feature);
      });
      for (const layer of [...INTERACTIVE_LAYERS, "obras-cluster"]) {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
      }
    });
    map.on("moveend", publishViewport);
    map.on("error", () => {
      hadProviderError = true;
      if (active) setWarning("No se pudo cargar una parte del mapa. La lista sigue disponible para consultar las obras.");
    });
    map.on("webglcontextlost", () => {
      if (!active) return;
      setStatus("recovering");
      window.clearTimeout(contextRecoveryTimeout);
      contextRecoveryTimeout = window.setTimeout(() => {
        if (active) setStatus("unavailable");
      }, 8000);
    });
    map.on("webglcontextrestored", () => {
      if (!active) return;
      window.clearTimeout(contextRecoveryTimeout);
      map.resize();
      setStatus("ready");
      if (!hadProviderError) setWarning(null);
    });
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container.current);
    return () => {
      active = false;
      initialized.current = false;
      window.clearTimeout(timeout);
      window.clearTimeout(contextRecoveryTimeout);
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // Data and callbacks are read from refs so updates do not recreate the WebGL map.
  }, [props.styleUrl, attempt, instructionId]);

  useEffect(() => {
    if (mapRef.current && initialized.current) updateWorkLayers(mapRef.current, props.features, props.selectedId);
  }, [props.features]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && initialized.current) {
      // A selection should not force workers to rebuild every cluster and vector tile.
      const selected = partitionMapFeatures(current.current.features.filter((feature) => feature.properties.obraId === props.selectedId));
      (map.getSource(SELECTED) as GeoJSONSource).setData(selected.all);
    }
  }, [props.selectedId]);

  useEffect(() => {
    if (mapRef.current && props.focusBBox) fit(mapRef.current, props.focusBBox);
  }, [props.focusBBox]);

  const pan = (x: number, y: number) => mapRef.current?.panBy([x, y], { duration: 0 });
  const controlStyle = { minWidth: 44, minHeight: 44 };
  return (
    <section className="work-map" aria-label="Mapa interactivo de obras">
      <p id={instructionId} className="map-help">Usá las flechas del teclado o los botones para mover el mapa. Los grupos cuentan puntos, no obras: una obra puede tener varias ubicaciones. La lista permite acceder a todas las fichas de la consulta.</p>
      <div role="group" aria-label="Controles del mapa" className="map-controls" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBlock: 12 }}>
        <button className="button button-secondary" style={controlStyle} type="button" disabled={status !== "ready"} aria-label="Acercar mapa" onClick={() => mapRef.current?.zoomIn({ duration: 0 })}>+</button>
        <button className="button button-secondary" style={controlStyle} type="button" disabled={status !== "ready"} aria-label="Alejar mapa" onClick={() => mapRef.current?.zoomOut({ duration: 0 })}>−</button>
        <button className="button button-secondary" style={controlStyle} type="button" disabled={status !== "ready"} aria-label="Mover mapa al norte" onClick={() => pan(0, -150)}>↑</button>
        <button className="button button-secondary" style={controlStyle} type="button" disabled={status !== "ready"} aria-label="Mover mapa al sur" onClick={() => pan(0, 150)}>↓</button>
        <button className="button button-secondary" style={controlStyle} type="button" disabled={status !== "ready"} aria-label="Mover mapa al oeste" onClick={() => pan(-150, 0)}>←</button>
        <button className="button button-secondary" style={controlStyle} type="button" disabled={status !== "ready"} aria-label="Mover mapa al este" onClick={() => pan(150, 0)}>→</button>
      </div>
      {status === "loading" && <p role="status">Cargando mapa…</p>}
      {status === "recovering" && <p role="status">El mapa se pausó momentáneamente. Intentando recuperarlo…</p>}
      {status === "unavailable" && <p role="status">No pudimos mostrar el mapa en este dispositivo. Podés explorar las mismas obras desde la lista.</p>}
      {warning && <p role="status">{warning}</p>}
      {(warning || status === "unavailable") && <button type="button" className="button button-secondary" onClick={() => setAttempt((value) => value + 1)}>Reintentar mapa</button>}
      <div ref={container} className="map-canvas" style={{ width: "100%", height: "min(56vh, 560px)", minHeight: 300 }} />
    </section>
  );
}
