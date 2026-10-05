/** @file Laboratorio aislado de mapa con API/cartografía sintéticas, CPU/red emuladas y WebGL deshabilitado. */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { createServer as createPortProbe } from "node:net";
import { once } from "node:events";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Ajv } from "ajv";
import { fullFormats } from "ajv-formats/dist/formats.js";
import examples from "../contracts/examples.json" with { type: "json" };
import schemas from "../contracts/schemas.json" with { type: "json" };
import { disableWebGL, isolateMapNetwork, useSyntheticBasemap } from "../e2e/map-fixture.ts";

// Reproducible read-only laboratory against an existing production build.
// node tools/measure-map.mjs [--visual-only | --memory-only]
// --memory-snapshot/--diagnose-three are optional local diagnosis controls.
// Starts its own isolated fixture API/Next servers; never accesses the live API.
const apiPort = Number(process.env.MAP_LAB_API_PORT ?? 4101);
const sitePort = Number(process.env.MAP_LAB_SITE_PORT ?? 3103);
if (![apiPort, sitePort].every(port => Number.isInteger(port) && port >= 1024 && port <= 65535) || apiPort === sitePort)
  throw new Error("Map lab needs two different nonprivileged ports.");
const origin = `http://127.0.0.1:${sitePort}`;
const area = "-59,-35,-58,-34"; // Synthetic fixture extent, never browser/user location.
const listPath = `/mapa?bbox=${area}&vista=lista`;
const firstId = "10000000-0000-4000-8000-000000000001";
const firstRevision = "20000000-0000-4000-8000-000000000001";
const firstName = "EJEMPLO SINTÉTICO — Obra 01";
const outputRelative = "artifacts/local-validation/map-lab" + (process.argv.includes("--memory-snapshot") ? "-snapshot" : "");
const outputDirectory = path.resolve(outputRelative);
await mkdir(outputDirectory, { recursive: true });
const children = [];
let browser;
const report = {
  collectedAt: new Date().toISOString(), buildId: (await readFile(".next/BUILD_ID", "utf8")).trim(),
  origin, browser: null, conditions: {
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, webglDisabled: true,
    cpuSlowdownMultiplier: 4, downloadBitsPerSecond: 1600000, uploadBitsPerSecond: 750000,
    latencyMs: 150, cacheDisabled: true, mobileAndTouchEmulated: true,
  },
  limitations: [
    "One cold Chromium sample per scenario; not field p75, a physical phone, or standard INP.",
    "Synthetic GeoJSON basemap has no real vector tiles, sprites or fonts; provider network/rendering cost remains unmeasured.",
    "Local isolated fixture API contains 24 works (18 located); it does not represent production data quality/coverage.",
    "The budget scenario intercepts browser GeoJSON with contract-validated synthetic 500 MultiPoints/10000 positions; it tests rendering budget, not API/PostGIS performance or exact emulated response throughput.",
    "CDP CPU/network simulation does not model mobile radio, thermal limits, native-browser behavior or production server latency.",
    "Heap samples force garbage collection and report JavaScript only; they exclude Canvas/native memory and cannot prove absence of leaks.",
    "GeoJSON measurement clones/parses responses in the browser to count complete pages; this adds small observation overhead.",
    "All external requests are fulfilled synthetically or aborted; no real provider tiles are downloaded/prefetched.",
  ], scenarios: [], memory: [], visual: [],
};

/** Inicia un proceso de laboratorio aislado, oculto en Windows, y retiene sus logs para verificar el bind propio. */
function startNode(label, args, env) {
  const child = spawn(process.execPath, args, { cwd: process.cwd(), env: { ...process.env, ...env }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let logs = "";
  for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => { logs = (logs + chunk).slice(-20000); });
  child.labStartupOutput = () => logs;
  children.push({ child, label, logs: () => logs });
  return child;
}
/** Comprueba que el puerto esté libre para evitar medir accidentalmente un servidor ya activo. */
async function assertAvailablePort(port) {
  const probe = createPortProbe();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", () => probe.close(error => error ? reject(error) : resolve()));
  });
}
/** Exige log de bind del proceso creado y salud HTTP antes de medir, con tiempo máximo de espera. */
async function waitForServer(url, child, readyText) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Lab child exited with ${child.exitCode}`);
    // Require this child's successful bind log, never another server's HTTP 200.
    if (child.labStartupOutput().includes(readyText)) {
      try { const response = await fetch(url, { signal: AbortSignal.timeout(1000) }); if (response.ok) return; } catch {}
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Lab server did not become ready: ${url}`);
}
/** Configura emulación móvil y táctil sin service workers para mantener la muestra reproducible. */
function mobileOptions(viewport = { width: 390, height: 844 }) {
  return { viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: "block" };
}
/** Crea una página con red externa aislada, mapa sintético y recolección de fallas de navegador. */
async function setupPage(context) {
  const page = await context.newPage();
  const errors = [], unexpectedExternal = [];
  page.on("pageerror", error => errors.push(error.message));
  await isolateMapNetwork(page);
  await useSyntheticBasemap(page);
  await page.route("**/*", async (route, request) => {
    const url = new URL(request.url());
    if (!["127.0.0.1", "localhost", "tiles.openfreemap.org"].includes(url.hostname)) unexpectedExternal.push(url.origin);
    await route.fallback();
  });
  await disableWebGL(page);
  return { page, errors, unexpectedExternal };
}
/** Aplica CPU y red emuladas mediante CDP y deshabilita caché en esta muestra. */
async function throttle(page) {
  const session = await page.context().newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.setCacheDisabled", { cacheDisabled: true });
  await session.send("Network.emulateNetworkConditions", {
    offline: false, latency: 150, downloadThroughput: 1600000 / 8,
    uploadThroughput: 750000 / 8, connectionType: "cellular3g",
  });
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  return session;
}
/** Captura el heap JavaScript a disco para diagnóstico opcional y retira el listener al finalizar. */
async function heapSnapshot(session, iteration) {
  const chunks = [];
  /** Acumula fragmentos de snapshot CDP sin procesarlos ni exponerlos en el informe compacto. */
  const collect = ({ chunk }) => chunks.push(chunk);
  session.on("HeapProfiler.addHeapSnapshotChunk", collect);
  try { await session.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false }); }
  finally { session.off("HeapProfiler.addHeapSnapshotChunk", collect); }
  const fileName = `heap-${iteration}.heapsnapshot`;
  await writeFile(path.join(outputDirectory, fileName), chunks.join(""));
  return fileName;
}
/** Espera controles listos, un píxel pintado y carga GeoJSON terminada; background vacío no acredita el mapa. */
async function waitForPaint(page) {
  await page.waitForFunction(() => {
    if (document.querySelector(".work-map")?.getAttribute("data-map-state") !== "ready") return false;
    if ([...document.querySelectorAll(".work-map [role=status]")].some(element => element.textContent.includes("Cargando mapa base"))) return false;
    return [...document.querySelectorAll(".map-canvas canvas")].some(canvas => {
      if (!canvas.width || !canvas.height) return false;
      const pixels = canvas.getContext("2d")?.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
      return pixels && pixels[3] !== 0;
    });
  }, null, { timeout: 60000 });
  await page.waitForFunction(() => ![...document.querySelectorAll(".map-region [role=status]")].some(element => element.textContent.includes("Consultando ubicaciones")), null, { timeout: 60000 });
}
/** Resume recursos/scripts desde Performance API usando rutas, sin conservar hosts o parámetros del usuario. */
async function resources(page) {
  return page.evaluate(() => {
    const all = performance.getEntriesByType("resource").map(entry => ({
      path: new URL(entry.name).pathname, initiatorType: entry.initiatorType, startTimeMs: entry.startTime,
      transferBytes: entry.transferSize, encodedBytes: entry.encodedBodySize, decodedBytes: entry.decodedBodySize,
    }));
    const scripts = all.filter(entry => entry.path.endsWith(".js"));
    return { scriptCount: scripts.length,
      scriptTransferBytes: scripts.reduce((sum, entry) => sum + entry.transferBytes, 0),
      scriptEncodedBodyBytes: scripts.reduce((sum, entry) => sum + entry.encodedBytes, 0),
      scriptDecodedBodyBytes: scripts.reduce((sum, entry) => sum + entry.decodedBytes, 0), resources: all };
  });
}

// Contract-validated renderer stress fixture, 500 features × 20 real positions.
const budgetFeatures = Array.from({ length: 500 }, (_, index) => {
  const number = index % 24 + 1;
  const feature = structuredClone(examples.geojsonPopulated.features[0]);
  feature.id = `40000000-0000-4000-8000-${String(index + 1000).padStart(12, "0")}`;
  feature.geometry = { type: "MultiPoint", coordinates: Array.from({ length: 20 }, (_, position) => [
    -58.8 + index % 25 * 0.02 + position * 0.0002,
    -34.8 + Math.floor(index / 25) * 0.025 + position * 0.0002,
  ]) };
  feature.properties = { ...feature.properties,
    obraId: `10000000-0000-4000-8000-${String(number).padStart(12, "0")}`,
    revisionId: `20000000-0000-4000-8000-${String(number).padStart(12, "0")}`,
    ubicacionId: feature.id, nombre: `EJEMPLO SINTÉTICO — Obra ${String(number).padStart(2, "0")}`,
  };
  return feature;
});
const ajv = new Ajv({ allErrors: true, strict: false, formats: fullFormats });
ajv.addSchema({ $id: "map-lab-contract", components: { schemas } });
const validateGeo = ajv.getSchema("map-lab-contract#/components/schemas/PublicGeoFeatureCollection");
/** Intercepta GeoJSON exclusivamente en laboratorio con 500 features sintéticas validadas por contrato. */
async function installBudget(page) {
  await page.route("**/api/public/geojson?*", route => {
    const url = new URL(route.request().url());
    const offset = Number(url.searchParams.get("cursor")?.replace("lab-offset-", "") ?? 0);
    const response = { type: "FeatureCollection", features: budgetFeatures.slice(offset, offset + 100),
      nextCursor: offset + 100 < budgetFeatures.length ? `lab-offset-${offset + 100}` : null, catalogoVersion: "7" };
    if (!validateGeo(response)) throw new Error(`Invalid budget fixture: ${ajv.errorsText(validateGeo.errors)}`);
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(response) });
  });
}
/** Mide una carga fría y activación de mapa en un contexto nuevo con presupuestos de laboratorio declarados. */
async function sample(name, route, expectedFeatures, budget = false) {
  console.log(`Map lab: cold ${name}`);
  const context = await browser.newContext(mobileOptions());
  await context.addInitScript(() => {
    window.__labGeoPages = [];
    window.__labObserveGeo = true;
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (window.__labObserveGeo && response.url.includes("/api/public/geojson?")) {
        const cursor = new URL(response.url).searchParams.get("cursor") ?? "initial";
        void response.clone().json().then(value => window.__labGeoPages.push({
          cursor, featureCount: value.features.length, bytes: new TextEncoder().encode(JSON.stringify(value)).byteLength,
        })).catch(error => window.__labGeoPages.push({ cursor, error: error.message }));
      }
      return response;
    };
  });
  const { page, errors, unexpectedExternal } = await setupPage(context);
  if (budget) await installBudget(page);
  const session = await throttle(page);
  await page.goto(origin + route, { waitUntil: "load", timeout: 60000 });
  const mapButton = page.getByRole("button", { name: "Mapa", exact: true });
  await page.waitForFunction(() => !document.querySelector('.view-switch button[aria-pressed="false"]')?.disabled);
  const before = await resources(page);
  await page.evaluate(() => {
    window.__mapLab = { clickAtMs: null, controlsReadyAtMs: null, syntheticPaintAtMs: null };
    const mapButton = [...document.querySelectorAll(".view-switch button")].find(button => button.textContent === "Mapa");
    mapButton.addEventListener("click", () => {
      window.__mapLab.clickAtMs = performance.now();
      /** Registra cuándo los controles y un píxel cartográfico quedan listos después de la acción explícita. */
      const observe = () => {
        const workMap = document.querySelector(".work-map");
        if (workMap?.getAttribute("data-map-state") === "ready" && !window.__mapLab.controlsReadyAtMs) window.__mapLab.controlsReadyAtMs = performance.now();
        const loading = [...document.querySelectorAll(".work-map [role=status]")].some(element => element.textContent.includes("Cargando mapa base"));
        const painted = !loading && [...document.querySelectorAll(".map-canvas canvas")].some(canvas => {
          if (!canvas.width || !canvas.height) return false;
          return canvas.getContext("2d")?.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data[3] !== 0;
        });
        if (painted) window.__mapLab.syntheticPaintAtMs = performance.now();
        else requestAnimationFrame(observe);
      };
      requestAnimationFrame(observe);
    }, { capture: true, once: true });
  });
  await mapButton.click();
  await waitForPaint(page);
  await page.waitForFunction(expected => {
    const completed = window.__labGeoPages.filter(item => !item.error);
    const pages = [...new Map(completed.map(item => [item.cursor, item])).values()];
    return pages.length > 0 && pages.reduce((sum, item) => sum + item.featureCount, 0) === expected;
  }, expectedFeatures, { timeout: 60000 });
  const dataReadyAtMs = await page.evaluate(() => performance.now());
  const after = await resources(page);
  const paint = await page.evaluate(() => window.__mapLab);
  const observedPages = await page.evaluate(() => window.__labGeoPages);
  // A cancelled route transition may expose response headers without its body.
  // Only complete pages form the rendered collection; preserve cancellation counts.
  const completedPages = observedPages.filter(item => !item.error);
  const pages = [...new Map(completedPages.map(item => [item.cursor, item])).values()];
  const actualFeatures = pages.reduce((sum, item) => sum + item.featureCount, 0);
  if (actualFeatures !== expectedFeatures) throw new Error(`${name}: received ${actualFeatures}, expected ${expectedFeatures}`);
  report.scenarios.push({ name, expectedFeatures, expectedPositions: budget ? 10000 : null,
    controlsReadyAfterClickMs: paint.controlsReadyAtMs - paint.clickAtMs,
    syntheticPaintAfterClickMs: paint.syntheticPaintAtMs - paint.clickAtMs,
    paintAndDataReadyAfterClickMs: dataReadyAtMs - paint.clickAtMs,
    beforeMap: before, afterMap: after,
    mapAdditionalScriptEncodedBytes: after.scriptEncodedBodyBytes - before.scriptEncodedBodyBytes,
    mapAdditionalScriptDecodedBytes: after.scriptDecodedBodyBytes - before.scriptDecodedBodyBytes,
    geoPages: pages.length, geoFeatures: actualFeatures, geoJSONBytes: pages.reduce((sum, item) => sum + item.bytes, 0),
    observedGeoResponses: observedPages.length, cancelledGeoResponses: observedPages.length - completedPages.length,
    canvasCount: await page.locator(".map-canvas canvas").count(), pageErrors: errors, unexpectedExternal,
  });
  await page.screenshot({ path: path.join(outputDirectory, `${name}-mobile.png`), fullPage: true });
  if (budget) {
    // Response cloning is only for the cold payload count, never the memory probe.
    await page.evaluate(() => { window.__labObserveGeo = false; });
    await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    report.memoryConditions = { cpuSlowdownMultiplier: 1, responseCloning: false, garbageCollectionBeforeSample: true, sampledView: "lista", idleBeforeFinalSampleMs: 16000 };
    const memoryCycles = process.argv.includes("--diagnose-three") ? 3 : 10;
    for (let iteration = 0; iteration <= memoryCycles; iteration++) {
      await page.getByRole("button", { name: "Lista", exact: true }).click();
      await page.waitForFunction(() => !document.querySelector(".map-canvas"));
      await session.send("HeapProfiler.collectGarbage");
      report.memory.push({ iteration, view: "lista", ...await session.send("Runtime.getHeapUsage"), canvasCount: await page.locator(".map-canvas canvas").count() });
      if (process.argv.includes("--memory-snapshot") && [0, 3, 10].includes(iteration)) {
        report.memory.at(-1).snapshot = await heapSnapshot(session, iteration);
      }
      if (iteration === memoryCycles) break;
      await page.getByRole("button", { name: "Mapa", exact: true }).click();
      await waitForPaint(page);
    }
    // AbortSignal.timeout schedules 15s deadlines; sample after they expire too.
    await page.waitForTimeout(16000);
    await session.send("HeapProfiler.collectGarbage");
    report.memoryAfterIdle = { idleMs: 16000, view: "lista", ...await session.send("Runtime.getHeapUsage"), canvasCount: await page.locator(".map-canvas canvas").count() };
    if (process.argv.includes("--memory-snapshot")) report.memoryAfterIdle.snapshot = await heapSnapshot(session, "idle");
    if (memoryCycles === 10) {
      // Generous regression guard for the observed 130MB retained JS growth.
      // It also rejects the first incomplete fix (~12MB); this is not a proof
      // about native/Canvas memory or every possible browsing session.
      const limitBytes = 4 * 1024 * 1024;
      const growthBytes = report.memoryAfterIdle.usedSize - report.memory[0].usedSize;
      report.memoryGuard = { cycles: memoryCycles, limitBytes, growthBytes,
        pass: growthBytes <= limitBytes && report.memory.every(item => item.canvasCount === 0) && report.memoryAfterIdle.canvasCount === 0,
        scope: "JavaScript heap after GC in Lista, including a 16s idle sample", };
      if (!report.memoryGuard.pass) process.exitCode = 1;
    }
  }
  await context.close();
}

/** Captura escenarios responsive aislados y registra reflow/errores sin consultar datos o cartografía reales. */
async function visual() {
  const sizes = [
    { width: 320, height: 740 }, { width: 768, height: 1024 }, { width: 820, height: 1180 },
    { width: 1024, height: 768 }, { width: 1440, height: 900 }, { width: 844, height: 390 },
  ];
  for (const viewport of sizes) {
    console.log(`Map lab: visual ${viewport.width}x${viewport.height}`);
    const context = await browser.newContext(viewport.width >= 1000 ? { viewport, serviceWorkers: "block" } : mobileOptions(viewport));
    const { page, errors, unexpectedExternal } = await setupPage(context);
    await page.goto(origin + listPath.replace("vista=lista", "vista=mapa"), { waitUntil: "load" });
    await waitForPaint(page);
    await page.locator(".map-canvas").scrollIntoViewIfNeeded();
    const layout = await page.evaluate(() => {
      const map = document.querySelector(".map-canvas").getBoundingClientRect();
      const list = document.querySelector(".beside-map");
      const controls = [...document.querySelectorAll(".map-controls button")].map(button => {
        const bounds = button.getBoundingClientRect(); return { width: bounds.width, height: bounds.height };
      });
      return { clientWidth: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        map: { x: map.x, width: map.width, height: map.height },
        listVisible: getComputedStyle(list).display !== "none", controls };
    });
    const screenshot = `map-${viewport.width}x${viewport.height}.png`;
    await page.locator(".map-region").screenshot({ path: path.join(outputDirectory, screenshot) });
    await page.goto(origin + listPath.replace("vista=lista", "vista=mapa") + `&obra=${firstId}&revisionId=${firstRevision}`, { waitUntil: "load" });
    await page.locator(".selection-strip").getByRole("button", { name: "Ver resumen", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("heading", { name: firstName, exact: true }).waitFor();
    const panel = await dialog.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
        clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, bottomPadding: getComputedStyle(element).paddingBottom };
    });
    const panelScreenshot = `panel-${viewport.width}x${viewport.height}.png`;
    await page.screenshot({ path: path.join(outputDirectory, panelScreenshot) });
    const pass = layout.scrollWidth <= viewport.width && layout.map.x >= 0 && layout.map.x + layout.map.width <= viewport.width + 1 &&
      layout.controls.every(control => control.width >= 44 && control.height >= 44) &&
      panel.x >= 0 && panel.x + panel.width <= viewport.width + 1 && panel.height <= viewport.height && panel.scrollWidth <= panel.clientWidth &&
      layout.listVisible === (viewport.width >= 1000) && errors.length === 0 && unexpectedExternal.length === 0;
    report.visual.push({ viewport, pass, ...layout, panel, pageErrors: errors, unexpectedExternal, screenshot, panelScreenshot });
    await context.close();
  }
}

try {
  await assertAvailablePort(apiPort);
  await assertAvailablePort(sitePort);
  const api = startNode("fixture-api", ["tools/mock-public-api.mjs"], { MOCK_API_PORT: String(apiPort) });
  await waitForServer(`http://127.0.0.1:${apiPort}/__health`, api, "Isolated synthetic public API:");
  const next = startNode("next", ["node_modules/next/dist/bin/next", "start", "--port", String(sitePort)], {
    PUBLIC_API_URL: `http://127.0.0.1:${apiPort}/api/v1`, SITE_URL: origin,
  });
  await waitForServer(origin, next, "Ready in");
  browser = await chromium.launch({ args: ["--disable-webgl"] });
  report.browser = browser.version();
  if (!process.argv.includes("--memory-only")) await visual();
  if (!process.argv.includes("--visual-only")) {
    if (!process.argv.includes("--memory-only")) {
      await sample("empty", listPath + "&fuente=vl-obras", 0);
      await sample("small", listPath, 18);
    }
    await sample("budget", listPath, 500, true);
  }
  if (report.visual.some(item => !item.pass)) process.exitCode = 1;
  if (report.scenarios.some(item => item.pageErrors.length || item.unexpectedExternal.length)) process.exitCode = 1;
} catch (error) {
  report.error = error.stack ?? String(error); process.exitCode = 1;
} finally {
  await browser?.close();
  for (const { child } of children.reverse()) {
    if (child.exitCode === null) { const closed = once(child, "close"); child.kill(); await closed; }
  }
  if (report.error) report.serverLogs = children.map(({ label, logs }) => ({ label, output: logs() }));
  await writeFile(path.join(outputDirectory, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output: `${outputRelative}/report.json`, error: report.error,
    visual: report.visual.map(({ viewport, pass }) => ({ viewport, pass })),
    scenarios: report.scenarios.map(({ name, syntheticPaintAfterClickMs, paintAndDataReadyAfterClickMs, mapAdditionalScriptEncodedBytes, mapAdditionalScriptDecodedBytes, geoFeatures, geoJSONBytes, pageErrors }) => ({
      name, syntheticPaintAfterClickMs, paintAndDataReadyAfterClickMs, mapAdditionalScriptEncodedBytes, mapAdditionalScriptDecodedBytes, geoFeatures, geoJSONBytes, pageErrors,
    })), memory: report.memory.map(({ iteration, usedSize, canvasCount }) => ({ iteration, usedSize, canvasCount })),
    memoryAfterIdle: report.memoryAfterIdle, memoryGuard: report.memoryGuard,
  }, null, 2));
}
