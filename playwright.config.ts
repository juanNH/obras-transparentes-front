/** @file E2E con procesos API/Next aislados y proyectos responsive y de compatibilidad de navegador. */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./artifacts/playwright",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  expect: { timeout: 10000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3102",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 }, launchOptions: { args: ["--disable-webgl"] } } },
    { name: "mobile-chromium", use: { ...devices["Pixel 5"], viewport: { width: 390, height: 844 }, launchOptions: { args: ["--disable-webgl"] } } },
    { name: "tablet-chromium", testMatch: "map-compatibility.spec.ts", use: { ...devices["Pixel 5"], viewport: { width: 820, height: 1180 }, launchOptions: { args: ["--disable-webgl"] } } },
    { name: "desktop-firefox", testMatch: "map-compatibility.spec.ts", use: { ...devices["Desktop Firefox"], viewport: { width: 1280, height: 900 } } },
    { name: "mobile-webkit", testMatch: "map-compatibility.spec.ts", use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } } },
  ],
  webServer: [
    { command: "node tools/mock-public-api.mjs", url: "http://127.0.0.1:4100/__health", reuseExistingServer: false, timeout: 20000 },
    {
      command: "node node_modules/next/dist/bin/next start --port 3102",
      url: "http://127.0.0.1:3102",
      reuseExistingServer: false,
      timeout: 60000,
      env: { PUBLIC_API_URL: "http://127.0.0.1:4100/api/v1", SITE_URL: "http://127.0.0.1:3102" },
    },
  ],
});
