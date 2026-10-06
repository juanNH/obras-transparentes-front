/** @file Comprueba que una falla territorial no retire la lista HTML y una falla de obras conserve el padrón, con API sintética sin red. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import examples from "../contracts/examples.json" with { type: "json" };

const api = vi.hoisted(() => ({ list: vi.fn(), parties: vi.fn(), organizations: vi.fn() }));
vi.mock("../src/lib/public-api", () => ({ publicApi: () => api }));
vi.mock("../src/lib/config", () => ({ mapStyleUrl: () => "https://example.test/style.json", indexableSiteUrl: () => null }));
vi.mock("../src/components/explorer", () => ({ Explorer: () => null }));
import MapPage from "../src/app/mapa/page";

beforeEach(() => { vi.resetAllMocks(); api.list.mockResolvedValue(examples.listPopulated); api.organizations.mockResolvedValue({ items: [] }); });
describe("lecturas independientes de padrón y obras", () => {
  it("conserva obras y partidos cuando falla el catálogo institucional", async () => {
    const catalog = { version: "synthetic-catalog-only" };
    api.parties.mockResolvedValue(catalog);
    api.organizations.mockRejectedValue(new TypeError("private-diagnostic"));
    const page = await MapPage({ searchParams: Promise.resolve({ vista: "lista" }) });
    const explorer = (page as ReactElement<{ children: ReactElement[] }>).props.children[1] as ReactElement<{ initial: unknown; institutionalCatalog: unknown; partyCatalog: unknown }>;
    expect(explorer.props.initial).toEqual(examples.listPopulated);
    expect(explorer.props.partyCatalog).toEqual(catalog);
    expect(explorer.props.institutionalCatalog).toBeNull();
  });
  it("mantiene las publicaciones cuando no se obtiene la nómina", async () => {
    api.parties.mockRejectedValue(new TypeError("private-diagnostic"));
    const page = await MapPage({ searchParams: Promise.resolve({ vista: "lista" }) });
    const explorer = (page as ReactElement<{ children: ReactElement[] }>).props.children[1] as ReactElement<{ initial: unknown; initialError: string | null; partyCatalog: unknown }>;
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
    const explorer = (page as ReactElement<{ children: ReactElement[] }>).props.children[1] as ReactElement<{ initial: unknown; initialError: string | null; partyCatalog: unknown }>;
    expect(explorer.props.initial).toBeNull();
    expect(explorer.props.initialError).toBe("UNAVAILABLE");
    expect(explorer.props.partyCatalog).toEqual(catalog);
  });
});
