import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Read-only laboratory observations against a running production build.
// Example: npm run build && npm start, then node tools/measure-mobile.mjs
// --visual-only skips the throttled measurements. No API data is written.
const origin = new URL(process.env.LAB_SITE_URL ?? "http://127.0.0.1:3002");
if (!["http:", "https:"].includes(origin.protocol)) throw new Error("LAB_SITE_URL must be HTTP(S).");
const outputRelative = "artifacts/local-validation";
const outputDirectory = path.resolve(outputRelative);
const screenshotDirectory = path.join(outputDirectory, "visual");
await mkdir(screenshotDirectory, { recursive: true });
const browser = await chromium.launch();
const report = {
  collectedAt: new Date().toISOString(),
  origin: origin.origin,
  buildId: await readFile(".next/BUILD_ID", "utf8").then(value => value.trim()).catch(() => null),
  browser: browser.version(),
  conditions: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    cpuSlowdownMultiplier: 4,
    downloadBitsPerSecond: 1600000,
    uploadBitsPerSecond: 750000,
    latencyMs: 150,
    cacheDisabled: true,
    mobileAndTouchEmulated: true,
    observationWindowAfterLoadMs: 2000,
  },
  limitations: [
    "One local Chromium sample per route, not field p75, a real phone, or INP.",
    "The local API may have an empty catalog; this does not measure representative data, map rendering, or published details.",
    "CPU/network emulation does not model mobile radio, GPU, thermal throttling, or server production latency.",
    "Script resources include shared Next/React runtime; encodedBodySize and transferSize are separate browser observations.",
    "The separate copy-link probe is an upper bound on an observed hydrated action; it is not a standardized interactivity metric.",
    "No geolocation is requested; the copy-link probe replaces clipboard writes in its isolated browser context.",
  ],
  visual: [],
  routes: [],
};

function mobileOptions(width = 390) {
  return { viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
}

async function installObservers(context) {
  await context.addInitScript(() => {
    window.__lab = { lcpMs: null, cls: 0, lcpElement: null };
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        window.__lab.lcpMs = entry.startTime;
        window.__lab.lcpElement = entry.element?.tagName ?? null;
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__lab.cls += entry.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
}

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

async function visual() {
  const routes = [
    { name: "landing", route: "/" },
    { name: "list-empty", route: "/mapa?vista=lista" },
    { name: "detail-missing", route: "/obras/00000000-0000-4000-8000-000000000001" },
  ];
  for (const width of [1440, 390, 360, 320]) {
    const context = await browser.newContext(width === 1440 ? { viewport: { width, height: 1000 }, deviceScaleFactor: 1 } : mobileOptions(width));
    const page = await context.newPage();
    for (const item of routes) {
      const response = await page.goto(new URL(item.route, origin).href, { waitUntil: "networkidle" });
      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        heading: document.querySelector("h1")?.textContent ?? null,
        overflowElements: [...document.querySelectorAll("body *")].flatMap(element => {
          const bounds = element.getBoundingClientRect();
          if (bounds.width > 0 && (bounds.right > innerWidth + 1 || bounds.left < -1) && getComputedStyle(element).position !== "fixed")
            return [{ tag: element.tagName, className: element.className?.toString().slice(0, 120), left: bounds.left, right: bounds.right }];
          return [];
        }).slice(0, 10),
      }));
      const fileName = `${item.name}-${width}.png`;
      await page.screenshot({ path: path.join(screenshotDirectory, fileName), fullPage: true });
      report.visual.push({ route: item.route, width, status: response?.status(), ...layout, screenshot: `${outputRelative}/visual/${fileName}` });
    }
    await context.close();
  }
}

async function measure(route) {
  const context = await browser.newContext(mobileOptions());
  await installObservers(context);
  const page = await context.newPage();
  await throttle(page);
  const requests = [];
  const errors = [];
  page.on("request", request => requests.push({ url: request.url(), type: request.resourceType() }));
  page.on("pageerror", error => errors.push(error.message));
  const response = await page.goto(new URL(route, origin).href, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator(route === "/" ? "#hero-title" : ".results-heading").waitFor({ state: "visible" });
  const contentVisibleAtMs = await page.evaluate(() => performance.now());
  await page.waitForLoadState("load");
  await page.waitForTimeout(report.conditions.observationWindowAfterLoadMs);
  const sample = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource").map(entry => ({
      url: entry.name, initiatorType: entry.initiatorType, startTimeMs: entry.startTime,
      durationMs: entry.duration, transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize,
    }));
    const scripts = resources.filter(entry => new URL(entry.url).pathname.endsWith(".js"));
    return {
      lcpMs: window.__lab.lcpMs,
      lcpElement: window.__lab.lcpElement,
      cls: window.__lab.cls,
      fcpMs: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null,
      domContentLoadedMs: navigation.domContentLoadedEventEnd,
      loadMs: navigation.loadEventEnd,
      ttfbMs: navigation.responseStart,
      documentTransferBytes: navigation.transferSize,
      scriptCount: scripts.length,
      scriptTransferBytes: scripts.reduce((sum, entry) => sum + entry.transferSize, 0),
      scriptEncodedBodyBytes: scripts.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
      scriptDecodedBodyBytes: scripts.reduce((sum, entry) => sum + entry.decodedBodySize, 0),
      resources,
    };
  });
  report.routes.push({ route, status: response?.status(), contentVisibleAtMs, ...sample, requests, pageErrors: errors });
  await context.close();
}

async function probeHydratedListAction() {
  const context = await browser.newContext(mobileOptions());
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { window.__labCopyActionAtMs = performance.now(); } } });
  });
  const page = await context.newPage();
  await throttle(page);
  await page.goto(new URL("/mapa?vista=lista", origin).href, { waitUntil: "domcontentloaded", timeout: 60000 });
  const button = page.getByRole("button", { name: "Copiar enlace", exact: true });
  await button.waitFor({ state: "visible" });
  const firstAttemptAtMs = await page.evaluate(() => performance.now());
  for (let attempt = 0; attempt < 30; attempt++) {
    await button.click();
    await page.waitForTimeout(150);
    if (await page.getByRole("status").filter({ hasText: "Enlace copiado." }).count()) break;
  }
  const actionAtMs = await page.evaluate(() => window.__labCopyActionAtMs ?? null);
  const confirmed = await page.getByRole("status").filter({ hasText: "Enlace copiado." }).count() > 0;
  report.listHydratedActionProbe = { firstAttemptAtMs, actionAtMs, confirmed, kind: "isolated stubbed clipboard click", sameConditions: true };
  await context.close();
}

try {
  await visual();
  if (!process.argv.includes("--visual-only")) {
    await measure("/");
    await measure("/mapa?vista=lista");
    await probeHydratedListAction();
  }
  await writeFile(path.join(outputDirectory, "mobile-lab.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output: `${outputRelative}/mobile-lab.json`, visual: report.visual.map(({ route, width, status, scrollWidth, clientWidth }) => ({ route, width, status, overflow: scrollWidth > clientWidth })), routes: report.routes.map(({ route, lcpMs, cls, scriptTransferBytes, scriptEncodedBodyBytes, contentVisibleAtMs, pageErrors }) => ({ route, lcpMs, cls, scriptTransferBytes, scriptEncodedBodyBytes, contentVisibleAtMs, pageErrors })), hydratedAction: report.listHydratedActionProbe }, null, 2));
} finally {
  await browser.close();
}
