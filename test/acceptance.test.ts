/** @file Comprueba límites y clasificación de auditoría pública mediante fetch sintético, sin acceder a datos reales. */
import { describe, expect, it, vi } from "vitest";
import examples from "../contracts/examples.json" with { type: "json" };
import { auditPublicApi } from "../src/api/acceptance.js";
import { createPublicApi } from "../src/api/client.js";

const bbox = [-59, -35.2, -57.5, -34] as const;
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
function populated(url: URL): unknown {
  if (url.pathname.endsWith("/geojson")) return examples.geojsonPopulated;
  if (url.pathname.endsWith("/obras")) return examples.listPopulated;
  return examples.detailPopulated;
}
function mockApi(
  respond: (url: URL, init?: RequestInit) => Response | Promise<Response> = (
    url,
  ) => json(populated(url)),
) {
  const fetch = vi.fn<typeof globalThis.fetch>((input, init) =>
    Promise.resolve(respond(new URL(String(input)), init)),
  );
  return {
    fetch,
    api: createPublicApi({ baseUrl: "http://127.0.0.1:3000/api/v1", fetch }),
  };
}

describe("Auditoría pública acotada", () => {
  it("rechaza números de revisión contradictorios entre listas", async () => {
    const { api } = mockApi((url) => {
      if (url.pathname.endsWith("/obras") && url.searchParams.has("bbox")) {
        return json({
          ...examples.listPopulated,
          items: examples.listPopulated.items.map((item) => ({
            ...item,
            numeroRevision: 2,
          })),
        });
      }
      return json(populated(url));
    });
    const report = await auditPublicApi(api, { bbox });
    expect(report.status).toBe("failed");
    expect(report.checks.spatialList.code).toBe("SUMMARY_IDENTITY_MISMATCH");
  });
  it("comprueba fichas y deduplica obras con varias ubicaciones sin divulgar contenido", async () => {
    const { api, fetch } = mockApi((url) =>
      json(
        url.pathname.endsWith("/obras") && !url.searchParams.has("bbox")
          ? { ...examples.listPopulated, nextCursor: "general-next" }
          : populated(url),
      ),
    );
    const report = await auditPublicApi(api, { bbox });
    expect(report.status).toBe("passed");
    expect(report.counts).toMatchObject({
      generalWorks: 1,
      spatialWorks: 1,
      geoWorks: 1,
      features: 2,
      details: 1,
    });
    expect(report.sampling.generalHasNextPage).toBe(true);
    const detailUrl = new URL(String(fetch.mock.calls.at(-1)![0]));
    expect(detailUrl.pathname).toContain(examples.detailPopulated.obraId);
    expect(detailUrl.searchParams.get("revisionId")).toBe(
      examples.detailPopulated.revisionId,
    );
    for (const [, init] of fetch.mock.calls) {
      expect(init?.method).toBe("GET");
      expect(init?.credentials).toBe("omit");
    }
    const output = JSON.stringify(report);
    expect(output).not.toContain(examples.detailPopulated.obraId);
    expect(output).not.toContain(examples.detailPopulated.nombre);
    expect(output).not.toContain("http");
    expect(output).not.toContain("-59");
  });

  it("marca el catálogo vacío como inconcluso sin solicitar fichas", async () => {
    const { api, fetch } = mockApi((url) =>
      json(
        url.pathname.endsWith("/geojson")
          ? examples.geojsonEmpty
          : examples.listEmpty,
      ),
    );
    const report = await auditPublicApi(api, { bbox });
    expect(report.status).toBe("incomplete");
    expect(report.checks.generalList.code).toBe("NO_PUBLIC_WORKS");
    expect(report.checks.details.code).toBe("NO_DETAIL_SAMPLE");
    expect(report.counts.details).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("agota páginas de ubicaciones antes de comparar con las obras del listado", async () => {
    const { api, fetch } = mockApi((url) => {
      if (!url.pathname.endsWith("/geojson")) return json(populated(url));
      const secondPage = url.searchParams.has("cursor");
      return json({
        ...examples.geojsonPopulated,
        features: [examples.geojsonPopulated.features[secondPage ? 1 : 0]],
        nextCursor: secondPage ? null : "geo-next",
      });
    });
    const report = await auditPublicApi(api, { bbox });
    expect(report.status).toBe("passed");
    expect(report.counts.geojsonPages).toBe(2);
    expect(report.counts.geoWorks).toBe(1);
    expect(
      fetch.mock.calls.some(([url]) => String(url).includes("cursor=geo-next")),
    ).toBe(true);
  });

  it("no compara conjuntos incompletos ni interpreta un límite de páginas como ausencia", async () => {
    const { api } = mockApi((url) => {
      if (url.pathname.endsWith("/obras") && url.searchParams.has("bbox")) {
        return json({ ...examples.listPopulated, nextCursor: "more-works" });
      }
      return json(populated(url));
    });
    const report = await auditPublicApi(api, { bbox, maxPages: 1 });
    expect(report.status).toBe("incomplete");
    expect(report.checks.spatialList.code).toBe("PAGE_LIMIT");
    expect(report.checks.spatialConsistency.code).toBe("PAGES_INCOMPLETE");
    expect(report.checks.details.status).toBe("passed");
  });

  it("un área vacía no niega la existencia de obras globales", async () => {
    const { api } = mockApi((url) => {
      if (url.pathname.endsWith("/geojson")) {
        return json({ ...examples.geojsonEmpty, catalogoVersion: "7" });
      }
      if (url.searchParams.has("bbox")) {
        return json({ ...examples.listEmpty, catalogoVersion: "7" });
      }
      return json(populated(url));
    });
    const report = await auditPublicApi(api, { bbox });
    expect(report.status).toBe("incomplete");
    expect(report.checks.generalList.status).toBe("passed");
    expect(report.checks.details.status).toBe("passed");
    expect(report.checks.spatialConsistency.code).toBe("NO_SPATIAL_SAMPLE");
  });

  it.each(["response", "http"])(
    "detiene la auditoría ante cambio de catálogo por %s",
    async (kind) => {
      const { api, fetch } = mockApi((url) => {
        if (url.searchParams.has("bbox")) {
          return kind === "http"
            ? json(examples.errorCatalogChanged, 409)
            : json({
                ...examples.listPopulated,
                catalogoVersion: "9007199254740993",
              });
        }
        return json({
          ...examples.listPopulated,
          catalogoVersion: "9007199254740992",
        });
      });
      const report = await auditPublicApi(api, { bbox });
      expect(report.status).toBe("incomplete");
      expect(report.catalogoVersion).toBe("9007199254740992");
      expect(report.checks.spatialList.code).toBe("CATALOG_CHANGED");
      expect(report.checks.geojson.code).toBe("NOT_RUN");
      expect(fetch).toHaveBeenCalledTimes(2);
    },
  );

  it("detecta un cursor repetido sin volver a solicitarlo", async () => {
    let pages = 0;
    const { api } = mockApi((url) => {
      if (!url.pathname.endsWith("/geojson")) return json(populated(url));
      pages += 1;
      return json({
        ...examples.geojsonPopulated,
        features: [examples.geojsonPopulated.features[pages - 1]],
        nextCursor: "same-cursor",
      });
    });
    const report = await auditPublicApi(api, { bbox, maxPages: 10 });
    expect(report.status).toBe("failed");
    expect(report.checks.geojson.code).toBe("REPEATED_CURSOR");
    expect(pages).toBe(2);
  });

  it.each(["obraId", "revisionId", "publicadoEn"])(
    "detecta identidad de ficha incompatible: %s",
    async (field) => {
      const { api } = mockApi((url) => {
        if (
          url.pathname.endsWith("/obras") ||
          url.pathname.endsWith("/geojson")
        )
          return json(populated(url));
        const detail = structuredClone(examples.detailPopulated);
        if (field === "publicadoEn")
          detail.metadata.publicadoEn = "2026-02-01T00:00:00.000Z";
        else if (field === "obraId")
          detail.obraId = "10000000-0000-4000-8000-000000000099";
        else detail.revisionId = "20000000-0000-4000-8000-000000000099";
        return json(detail);
      });
      const report = await auditPublicApi(api, { bbox });
      expect(report.status).toBe("failed");
      expect(report.checks.details.code).toBe("DETAIL_IDENTITY_MISMATCH");
      expect(report.counts.details).toBe(0);
    },
  );

  it("rechaza conjuntos espaciales completos con revisiones distintas", async () => {
    const { api } = mockApi((url) => {
      if (!url.pathname.endsWith("/geojson")) return json(populated(url));
      const page = structuredClone(examples.geojsonPopulated);
      for (const feature of page.features) {
        feature.properties.revisionId = "20000000-0000-4000-8000-000000000099";
      }
      return json(page);
    });
    const report = await auditPublicApi(api, { bbox });
    expect(report.status).toBe("failed");
    expect(report.checks.spatialConsistency.code).toBe(
      "SPATIAL_IDENTITY_MISMATCH",
    );
  });

  it.each(["http", "schema", "network"])(
    "informa fallos de lectura %s sin mensajes remotos",
    async (kind) => {
      const { api } = mockApi((url) => {
        if (url.searchParams.has("bbox")) return json(populated(url));
        if (kind === "http") return json(examples.errorValidation, 422);
        if (kind === "schema") return json({ items: [] });
        throw new Error("https://private.invalid/secret");
      });
      const report = await auditPublicApi(api, { bbox });
      expect(report.status).toBe("failed");
      expect(report.checks.generalList.code).toBe(
        kind === "http"
          ? "HTTP_ERROR"
          : kind === "schema"
            ? "CONTRACT_INVALID"
            : "READ_ERROR",
      );
      expect(JSON.stringify(report)).not.toContain("private.invalid");
    },
  );

  it("cancela una petición demorada aunque el transporte no respete la señal", async () => {
    const { api, fetch } = mockApi();
    fetch.mockImplementationOnce(() => new Promise<Response>(() => {}));
    const report = await auditPublicApi(api, {
      bbox,
      requestTimeoutMs: 10,
      totalTimeoutMs: 2000,
    });
    expect(report.status).toBe("failed");
    expect(report.checks.generalList.code).toBe("REQUEST_TIMEOUT");
    expect(fetch.mock.calls[0]![1]?.signal?.aborted).toBe(true);
    expect(report.checks.spatialList.status).toBe("passed");
  });

  it("termina al alcanzar el presupuesto global sin nuevos pedidos", async () => {
    const { api, fetch } = mockApi(() => new Promise<Response>(() => {}));
    const report = await auditPublicApi(api, {
      bbox,
      requestTimeoutMs: 1000,
      totalTimeoutMs: 10,
    });
    expect(report.status).toBe("incomplete");
    expect(report.checks.generalList.code).toBe("AUDIT_TIMEOUT");
    expect(report.checks.spatialList.code).toBe("NOT_RUN");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rechaza opciones fuera de los límites antes de consumir la API", async () => {
    const { api, fetch } = mockApi();
    for (const options of [
      { maxPages: 11 },
      { pageSize: 101 },
      { maxDetails: 11 },
      { requestTimeoutMs: 0 },
      { totalTimeoutMs: Infinity },
    ]) {
      await expect(
        auditPublicApi(api, { bbox, ...options }),
      ).rejects.toBeInstanceOf(TypeError);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
