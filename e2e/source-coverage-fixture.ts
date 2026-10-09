/** @file Abre las divulgaciones nativas de cobertura en pruebas aisladas para comprobar cantidades y enlaces completos. */
import { expect, type Page } from "@playwright/test";

/** Recupera el panel y abre sus grupos y desgloses usando los mismos controles disponibles sin JavaScript. */
export async function openSourceCoverage(page: Page) {
  const panel = page.getByRole("region", {
    name: "Publicaciones por provincia y fuente",
    exact: true,
  });
  const overview = panel.locator(".source-coverage-overview");
  await expect(overview).toBeVisible();
  if ((await overview.getAttribute("open")) === null)
    await overview.locator(":scope > summary").click();
  for (const group of await panel.locator(".source-coverage-group").all()) {
    if ((await group.getAttribute("open")) === null)
      await group.locator(":scope > summary").click();
  }
  for (const source of await panel.locator(".source-coverage-source").all()) {
    if ((await source.getAttribute("open")) === null)
      await source.locator(":scope > summary").click();
  }
  return panel;
}
