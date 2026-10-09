/** @file Comprueba conteos de las siete fuentes, versiones compartidas y lecturas municipales sintéticas sin consultar el catálogo activo. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import examples from "../contracts/examples.json" with { type: "json" };
import {
  createPublicApi,
  PublicApiError,
  type MunicipalCoverage,
  type SourceCoverage,
  type WorkCounts,
} from "../src/api/client";
import { SourceCoveragePanel } from "../src/components/source-coverage";
import { parsePublicResponse } from "../src/api/contract";
import type { PublicSourceCoverage } from "../src/lib/source-coverage";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  parties: vi.fn(),
  provinces: vi.fn(),
  localities: vi.fn(),
  organizations: vi.fn(),
  municipalCoverage: vi.fn(),
  sourceCoverage: vi.fn(),
  counts: vi.fn(),
}));
vi.mock("../src/lib/public-api", () => ({ publicApi: () => api }));
vi.mock("../src/lib/config", () => ({
  mapStyleUrl: () => "https://example.test/style.json",
  indexableSiteUrl: () => null,
}));
vi.mock("../src/components/explorer", () => ({ Explorer: () => null }));
import MapPage from "../src/app/mapa/page";
import { GET } from "../src/app/api/public/[...path]/route";

const version = examples.listPopulated.catalogoVersion;
const coverage: MunicipalCoverage = {
  catalogoVersion: version,
  fuentes: [
    {
      fuenteId: "70000000-0000-4000-8000-000000000001",
      codigo: "bahia-obras",
      nombre: "EJEMPLO SINTÉTICO — Bahía Blanca",
      obrasPublicadas: 1,
      obrasConGeometria: 1,
      obrasSinGeometria: 0,
    },
    {
      fuenteId: "70000000-0000-4000-8000-000000000002",
      codigo: "olavarria-obras",
      nombre: "EJEMPLO SINTÉTICO — Olavarría",
      obrasPublicadas: 0,
      obrasConGeometria: 0,
      obrasSinGeometria: 0,
    },
    {
      fuenteId: "70000000-0000-4000-8000-000000000003",
      codigo: "pergamino-obras",
      nombre: "EJEMPLO SINTÉTICO — Pergamino",
      obrasPublicadas: 2,
      obrasConGeometria: 0,
      obrasSinGeometria: 2,
    },
  ],
};
const workCounts: WorkCounts = {
  catalogoVersion: version,
  totalPublicadas: 3,
  totalConGeometria: 1,
  totalSinGeometria: 2,
  area: null,
};
const perSource: Record<string, WorkCounts> = {
  "pba-edificios": {
    ...workCounts,
    totalPublicadas: 4,
    totalConGeometria: 3,
    totalSinGeometria: 1,
  },
  "nacion-obras": {
    ...workCounts,
    totalPublicadas: 5,
    totalConGeometria: 4,
    totalSinGeometria: 1,
  },
  "caba-actualizado": {
    ...workCounts,
    totalPublicadas: 0,
    totalConGeometria: 0,
    totalSinGeometria: 0,
  },
  "vl-obras": {
    ...workCounts,
    totalPublicadas: 2,
    totalConGeometria: 0,
    totalSinGeometria: 2,
  },
  "bahia-obras": {
    ...workCounts,
    totalPublicadas: 1,
    totalConGeometria: 1,
    totalSinGeometria: 0,
  },
  "olavarria-obras": {
    ...workCounts,
    totalPublicadas: 0,
    totalConGeometria: 0,
    totalSinGeometria: 0,
  },
  "pergamino-obras": {
    ...workCounts,
    totalPublicadas: 2,
    totalConGeometria: 0,
    totalSinGeometria: 2,
  },
};
const sourceInventory = parsePublicResponse<SourceCoverage>(
  "PublicSourceCoverage",
  {
    ...examples.sourceCoverage,
    catalogoVersion: version,
    obrasPublicadasUnicas: 14,
    obrasCompartidasEntreFuentes: 0,
    totalVinculosAdicionales: 0,
    fuentes: examples.sourceCoverage.fuentes.map((source) => ({
      ...source,
      obrasPublicadas: perSource[source.codigo]!.totalPublicadas,
      obrasConUbicacionAprobada: perSource[source.codigo]!.totalConGeometria,
      obrasSinUbicacionAprobada: perSource[source.codigo]!.totalSinGeometria,
      localidadesConObrasPublicadas: source.codigo === "nacion-obras" ? 18 : 0,
      ubicacionesAprobadas: perSource[source.codigo]!.totalConGeometria + 1,
      obrasConEvidenciaLicenciaPublicada:
        perSource[source.codigo]!.totalPublicadas,
      obrasSinEvidenciaLicenciaPublicada: 0,
    })),
  },
);
beforeEach(() => {
  vi.resetAllMocks();
  api.list.mockResolvedValue(examples.listPopulated);
  api.municipalCoverage.mockResolvedValue(coverage);
  api.sourceCoverage.mockResolvedValue(sourceInventory);
  api.counts.mockImplementation(async (query: Record<string, string> = {}) =>
    Object.keys(query).length === 1 && query.fuente
      ? perSource[query.fuente]
      : workCounts,
  );
});

/** Recupera props del explorador sin montar el mapa ni crear conexiones reales. */
function explorer(page: ReactElement) {
  return (page.props as { children: ReactElement[] })
    .children[1]! as ReactElement<{
    sourceCoverage: readonly PublicSourceCoverage[];
    initial: { catalogoVersion: string } | null;
  }>;
}

describe("cobertura pública por fuente", () => {
  it("valida el contrato municipal existente y mantiene su lectura anónima", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(coverage)));
    const controller = new AbortController();
    await expect(
      createPublicApi({ fetch: request }).municipalCoverage({
        signal: controller.signal,
      }),
    ).resolves.toEqual(coverage);
    expect(request).toHaveBeenCalledWith(
      "/api/v1/obras/cobertura-municipal",
      expect.objectContaining({
        credentials: "omit",
        redirect: "error",
        signal: controller.signal,
      }),
    );
    for (const body of [
      { ...coverage, fuentes: coverage.fuentes.slice(1) },
      {
        ...coverage,
        fuentes: coverage.fuentes.map((source, index) =>
          index === 2 ? { ...source, obrasPublicadas: 3 } : source,
        ),
      },
      {
        ...coverage,
        fuentes: [
          coverage.fuentes[0],
          coverage.fuentes[0],
          coverage.fuentes[2],
        ],
      },
    ]) {
      request.mockResolvedValueOnce(new Response(JSON.stringify(body)));
      await expect(
        createPublicApi({ fetch: request }).municipalCoverage(),
      ).rejects.toMatchObject({ name: "ApiContractError" });
    }
  });

  it("presenta las siete fuentes en el mismo corte con una lectura agregada independiente de filtros", async () => {
    const page = await MapPage({
      searchParams: Promise.resolve({
        fuente: "pergamino-obras",
        estado: "IN_PROGRESS",
        bbox: "-61,-35,-60,-33",
        vista: "lista",
      }),
    });
    const props = explorer(page).props;
    expect(props.sourceCoverage).toHaveLength(7);
    expect(
      props.sourceCoverage.every((source) => source.estado === "AVAILABLE"),
    ).toBe(true);
    expect(
      props.sourceCoverage.map((source) => source.codigo).slice(0, 2),
    ).toEqual(["pba-edificios", "nacion-obras"]);
    expect(api.municipalCoverage).not.toHaveBeenCalled();
    expect(api.sourceCoverage).toHaveBeenCalledExactlyOnceWith();
    expect(api.counts).toHaveBeenCalledTimes(1);
    const html = renderToStaticMarkup(
      SourceCoveragePanel({
        coverage: props.sourceCoverage,
        catalogoVersion: props.initial!.catalogoVersion,
      }),
    );
    expect(html).toContain("globales del catálogo público");
    expect(html).toContain("comparten corte con el listado y las fichas");
    expect(html).toContain("Provincia de Buenos Aires · edificios escolares");
    expect(html).toContain("Nación · obras");
    expect(html).toContain("Fuente sin publicaciones");
    expect(html).toContain("Publicadas; sin ubicación en el mapa");
    expect(html).toContain(
      "Las publicaciones siguen disponibles en lista y ficha",
    );
    expect(html).toContain("edificios escolares finalizados");
    expect(html).toContain(
      "localizaciones vinculadas; no agrega obras al conteo",
    );
    expect(html).toContain("no se suman para obtener obras únicas");
    for (const source of props.sourceCoverage)
      expect(html).toContain(
        `href="/mapa?fuente=${source.codigo}&amp;vista=lista"`,
      );
    expect(html).not.toContain("bbox=");
  });

  it("oculta todas las cantidades cuando el corte agregado no coincide con el listado", async () => {
    api.sourceCoverage.mockResolvedValue({
      ...sourceInventory,
      catalogoVersion: "987654321",
    });
    const page = await MapPage({
      searchParams: Promise.resolve({ vista: "lista" }),
    });
    const items = explorer(page).props.sourceCoverage;
    expect(
      items.find((source) => source.codigo === "nacion-obras"),
    ).toMatchObject({ estado: "UNKNOWN", obrasPublicadas: null });
    expect(
      items.find((source) => source.codigo === "pba-edificios"),
    ).toMatchObject({ estado: "UNKNOWN", obrasPublicadas: null });
    expect(items.find((source) => source.codigo === "vl-obras")).toMatchObject({
      estado: "UNKNOWN",
      obrasPublicadas: null,
    });
    const html = renderToStaticMarkup(
      SourceCoveragePanel({ coverage: items, catalogoVersion: version }),
    );
    expect(html).toContain("No hay un conteo verificable para el mismo corte");
    expect(html).not.toContain("<dd>");
    expect(html).not.toContain("localizaciones vinculadas");
  });

  it("conserva la lista cuando falla la cobertura unificada y oculta los diagnósticos privados", async () => {
    api.municipalCoverage.mockResolvedValue({
      ...coverage,
      catalogoVersion: "987654321",
    });
    api.counts.mockRejectedValue(new TypeError("private-internal-diagnostic"));
    api.sourceCoverage.mockRejectedValue(
      new TypeError("private-internal-diagnostic"),
    );
    const page = await MapPage({
      searchParams: Promise.resolve({ vista: "lista" }),
    });
    const props = explorer(page).props;
    expect(props.initial).toEqual(examples.listPopulated);
    expect(
      props.sourceCoverage.every((source) => source.estado === "ERROR"),
    ).toBe(true);
    const html = renderToStaticMarkup(
      SourceCoveragePanel({
        coverage: props.sourceCoverage,
        catalogoVersion: version,
      }),
    );
    expect(html).toContain("Error de lectura");
    expect(html).not.toContain("private-internal-diagnostic");
  });

  it("conserva desconocidos si falla el listado aunque el inventario y sus licencias sean válidos", async () => {
    api.list.mockRejectedValue(new Error("Synthetic list unavailable"));
    const items = explorer(
      await MapPage({ searchParams: Promise.resolve({ vista: "lista" }) }),
    ).props.sourceCoverage;
    expect(
      items.every(
        (source) =>
          source.estado === "UNKNOWN" &&
          source.obrasPublicadas === null &&
          !source.inventario,
      ),
    ).toBe(true);
    expect(
      renderToStaticMarkup(
        SourceCoveragePanel({ coverage: items, catalogoVersion: null }),
      ),
    ).not.toContain("<dd>");
  });

  it("el BFF admite hasta siete fuentes y rechaza filtros de obras, paginación y códigos ajenos", async () => {
    const input = new Request(
      "https://example.test/api/public/obras/cobertura-fuentes?fuente=nacion-obras&fuente=pba-edificios",
      {
        headers: {
          Cookie: "private-session=secret",
          Authorization: "Bearer secret",
        },
      },
    );
    const context = {
      params: Promise.resolve({ path: ["obras", "cobertura-fuentes"] }),
    };
    const response = await GET(input, context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(await response.json()).toEqual(sourceInventory);
    expect(api.sourceCoverage).toHaveBeenCalledExactlyOnceWith(
      ["nacion-obras", "pba-edificios"],
      { signal: input.signal },
    );
    for (const query of [
      "fuente=unknown-obras",
      "fuente=",
      "limit=20",
      "bbox=-60,-35,-59,-34",
      "cursor=synthetic-page",
      new URLSearchParams(
        Array.from({ length: 8 }, () => ["fuente", "nacion-obras"]),
      ).toString(),
    ]) {
      expect(
        (
          await GET(
            new Request(input.url.split("?")[0]! + "?" + query),
            context,
          )
        ).status,
      ).toBe(400);
    }
    expect(api.sourceCoverage).toHaveBeenCalledTimes(1);
    api.sourceCoverage.mockRejectedValue(
      new PublicApiError(413, {
        code: "RESPONSE_BUDGET",
        message: "private-diagnostic",
        requestId: null,
      }),
    );
    expect(await (await GET(input, context)).json()).toEqual({
      error: {
        code: "RESPONSE_BUDGET",
        message:
          "No se pudo cargar el inventario de fuentes dentro del límite de lectura.",
      },
    });
  });

  it("admite cobertura municipal BFF anónima, sin caché y rechaza filtros", async () => {
    const input = new Request(
      "https://example.test/api/public/obras/cobertura-municipal",
      {
        headers: {
          Cookie: "private-session=secret",
          Authorization: "Bearer secret",
        },
      },
    );
    const context = {
      params: Promise.resolve({ path: ["obras", "cobertura-municipal"] }),
    };
    const response = await GET(input, context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(coverage);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(api.municipalCoverage).toHaveBeenCalledExactlyOnceWith({
      signal: input.signal,
    });
    expect(
      (await GET(new Request(input.url + "?fuente=pergamino-obras"), context))
        .status,
    ).toBe(400);
    expect(api.municipalCoverage).toHaveBeenCalledTimes(1);
    api.municipalCoverage.mockRejectedValue(
      new PublicApiError(413, {
        code: "RESPONSE_BUDGET",
        message: "private-diagnostic",
        requestId: null,
      }),
    );
    expect(await (await GET(input, context)).json()).toEqual({
      error: {
        code: "RESPONSE_BUDGET",
        message:
          "No se pudieron cargar los totales municipales dentro del límite de lectura.",
      },
    });
  });
});
