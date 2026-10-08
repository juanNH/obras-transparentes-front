/** @file Comprueba independencia de catálogos, consulta global inicial y filtros repetidos de la lista HTML, con API sintética sin red. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import examples from "../contracts/examples.json" with { type: "json" };

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

beforeEach(() => {
  vi.resetAllMocks();
  api.list.mockResolvedValue(examples.listPopulated);
  api.provinces.mockResolvedValue({
    version: "synthetic-provinces@1",
    items: [{ codigo: "06", nombre: "Buenos Aires", tipo: "PROVINCIA" }],
  });
  api.localities.mockResolvedValue(null);
  api.organizations.mockResolvedValue({ items: [] });
  api.municipalCoverage.mockRejectedValue(
    new Error("Synthetic independent coverage unavailable"),
  );
  api.sourceCoverage.mockRejectedValue(
    new Error("Synthetic independent source inventory unavailable"),
  );
  api.counts.mockRejectedValue(
    new Error("Synthetic independent counts unavailable"),
  );
});
describe("lecturas independientes de padrón y obras", () => {
  it("consulta todas las publicaciones por defecto sin filtro de jurisdicción o área", async () => {
    await MapPage({ searchParams: Promise.resolve({ vista: "lista" }) });
    expect(api.list).toHaveBeenCalledWith({ limit: 20 });
    expect(api.provinces).toHaveBeenCalledTimes(1);
    expect(api.parties).toHaveBeenCalledTimes(1);
    expect(api.organizations).toHaveBeenCalledTimes(1);
  });
  it("una falla provincial conserva publicaciones y partidos de la consulta OR normalizada", async () => {
    const first = "aaaaaaaa-0000-4000-8000-000000000001";
    const second = "bbbbbbbb-0000-4000-8000-000000000001";
    const partyCatalog = { version: "synthetic-parties@1" };
    api.parties.mockResolvedValue(partyCatalog);
    api.provinces.mockRejectedValue(new TypeError("private-diagnostic"));
    const page = await MapPage({
      searchParams: Promise.resolve({
        provinciaCodigo: ["06", "06"],
        partidos: [second.toUpperCase(), first, second],
        vista: "lista",
      }),
    });
    const explorer = (page as ReactElement<{ children: ReactElement[] }>).props
      .children[1] as ReactElement<{
      initial: unknown;
      initialError: string | null;
      partyCatalog: unknown;
      provinceCatalog: unknown;
    }>;
    expect(api.list).toHaveBeenCalledWith({
      limit: 20,
      provinciaCodigo: ["06"],
      partidos: [first, second],
    });
    expect(explorer.props.initial).toEqual(examples.listPopulated);
    expect(explorer.props.initialError).toBeNull();
    expect(explorer.props.partyCatalog).toEqual(partyCatalog);
    expect(explorer.props.provinceCatalog).toBeNull();
  });
  it("carga localidades oficiales sólo para una provincia aplicada", async () => {
    const catalog = {
      version: "georef-localidades@2.0-20261008",
      items: [{ codigo: "06427010" }],
    };
    api.localities.mockResolvedValue(catalog);
    const page = await MapPage({
      searchParams: Promise.resolve({ provinciaCodigo: "06" }),
    });
    const explorer = (page as ReactElement<{ children: ReactElement[] }>).props
      .children[1] as ReactElement<{ localityCatalog: unknown }>;
    expect(api.localities).toHaveBeenCalledExactlyOnceWith(["06"]);
    expect(explorer.props.localityCatalog).toEqual(catalog);
    await MapPage({
      searchParams: Promise.resolve({ provinciaCodigo: ["06", "02"] }),
    });
    expect(api.localities).toHaveBeenCalledTimes(1);
  });
  it("conserva obras y partidos cuando falla el catálogo institucional", async () => {
    const catalog = { version: "synthetic-catalog-only" };
    api.parties.mockResolvedValue(catalog);
    api.organizations.mockRejectedValue(new TypeError("private-diagnostic"));
    const page = await MapPage({
      searchParams: Promise.resolve({ vista: "lista" }),
    });
    const explorer = (page as ReactElement<{ children: ReactElement[] }>).props
      .children[1] as ReactElement<{
      initial: unknown;
      institutionalCatalog: unknown;
      partyCatalog: unknown;
    }>;
    expect(explorer.props.initial).toEqual(examples.listPopulated);
    expect(explorer.props.partyCatalog).toEqual(catalog);
    expect(explorer.props.institutionalCatalog).toBeNull();
  });
  it("mantiene las publicaciones cuando no se obtiene la nómina", async () => {
    api.parties.mockRejectedValue(new TypeError("private-diagnostic"));
    const page = await MapPage({
      searchParams: Promise.resolve({ vista: "lista" }),
    });
    const explorer = (page as ReactElement<{ children: ReactElement[] }>).props
      .children[1] as ReactElement<{
      initial: unknown;
      initialError: string | null;
      partyCatalog: unknown;
    }>;
    expect(explorer.props.initial).toEqual(examples.listPopulated);
    expect(explorer.props.initialError).toBeNull();
    expect(explorer.props.partyCatalog).toBeNull();
    expect(api.parties).toHaveBeenCalledTimes(1);
  });
  it("mantiene el padrón cuando la lista está temporalmente fuera de servicio", async () => {
    const catalog = { version: "synthetic-catalog-only" };
    api.parties.mockResolvedValue(catalog);
    api.list.mockRejectedValue(new TypeError("private-diagnostic"));
    const page = await MapPage({ searchParams: Promise.resolve({}) });
    const explorer = (page as ReactElement<{ children: ReactElement[] }>).props
      .children[1] as ReactElement<{
      initial: unknown;
      initialError: string | null;
      partyCatalog: unknown;
    }>;
    expect(explorer.props.initial).toBeNull();
    expect(explorer.props.initialError).toBe("UNAVAILABLE");
    expect(explorer.props.partyCatalog).toEqual(catalog);
  });
});
