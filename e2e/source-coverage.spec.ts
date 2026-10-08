/** @file Comprueba integración SSR/BFF del inventario provincial/nacional con procesos sintéticos aislados y unidades documentales explícitas. */
import { expect, test } from "@playwright/test";
import { isolateMapNetwork } from "./map-fixture";

test.beforeEach(async ({ page }) => { await isolateMapNetwork(page); });

test("Provincia y Nación comparten inventario sin sumar localizaciones como obras ni consumir dos conteos", async ({ page, request }, info) => {
  const baseline = (await (await request.get("http://127.0.0.1:4100/__requests")).json()).requests.length;
  await page.goto("/mapa?fuente=nacion-obras&vista=lista");
  const panel = page.getByRole("region", { name: "Publicaciones por fuente y disponibilidad en el mapa", exact: true });
  const province = panel.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Provincia de Buenos Aires · edificios escolares", exact: true }) });
  const nation = panel.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Nación · obras", exact: true }) });
  await expect(province).toContainText("edificios escolares finalizados");
  await expect(nation).toContainText("localizaciones vinculadas; no agrega obras al conteo");
  await expect(panel).toContainText("no se suman para obtener obras únicas");
  const ledger = (await (await request.get("http://127.0.0.1:4100/__requests")).json()).requests.slice(baseline);
  expect(ledger.filter((entry: { path: string }) => entry.path === "/api/v1/obras/cobertura-fuentes")).toHaveLength(1);
  const countReads = ledger.filter((entry: { path: string }) => entry.path === "/api/v1/obras/conteos");
  expect(countReads).toHaveLength(3);
  expect(countReads.filter((entry: { query: { fuente?: string } }) => entry.query.fuente === "nacion-obras")).toHaveLength(1);
  const inventory = await (await request.get("/api/public/obras/cobertura-fuentes")).json();
  const nationCounts = inventory.fuentes.find((source: { codigo: string }) => source.codigo === "nacion-obras");
  await expect(nation.locator("dd")).toHaveText([String(nationCounts.obrasPublicadas), String(nationCounts.obrasConUbicacionAprobada), String(nationCounts.obrasSinUbicacionAprobada), String(nationCounts.localidadesConObrasPublicadas)]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await panel.screenshot({ path: info.outputPath("panel-inventario-provincia-nacion.png"), scale: "css", style: ".skip-link:not(:focus) { visibility: hidden; }" });
  await page.screenshot({ path: info.outputPath("inventario-provincia-nacion.png"), fullPage: true, style: ".skip-link:not(:focus) { visibility: hidden; }" });
});

test("el BFF publica una fuente con conteos coherentes y rechaza filtros ajenos", async ({ request }) => {
  const response = await request.get("/api/public/obras/cobertura-fuentes?fuente=nacion-obras", { headers: { Cookie: "synthetic-private=secret", Authorization: "Bearer synthetic-private" } });
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(response.headers()["set-cookie"]).toBeUndefined();
  const result = await response.json();
  expect(result.fuentes).toHaveLength(1);
  expect(result.obrasCompartidasEntreFuentes).toBe(0);
  expect(result.obrasPublicadasUnicas).toBe(result.fuentes[0].obrasPublicadas);
  for (const query of ["fuente=bahia-obras", "fuente=", "limit=20", "cursor=synthetic-page", "fuente=nacion-obras&fuente=pba-edificios&fuente=nacion-obras"])
    expect((await request.get("/api/public/obras/cobertura-fuentes?" + query)).status()).toBe(400);
});
