/** @file Comprueba BFF territorial sin parámetros ni credenciales y recuperación sin diagnósticos internos, con mocks aislados. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/pba-parties.json" with { type: "json" };
import examples from "../contracts/examples.json" with { type: "json" };
import boundaries from "./fixtures/pba-party-boundaries.json" with { type: "json" };

const api = vi.hoisted(() => ({ parties: vi.fn(), boundaries: vi.fn(), list: vi.fn(), geojson: vi.fn(), detail: vi.fn() }));
vi.mock("../src/lib/public-api", () => ({ publicApi: () => api }));
import { GET } from "../src/app/api/public/[...path]/route";

const party = fixture.items[0]!.partidoId;
beforeEach(() => { vi.resetAllMocks(); api.parties.mockResolvedValue(fixture); });
describe("lectura territorial de mismo origen", () => {
  it("lee la nómina sin trasladar cookies o autorización", async () => {
    const request = new Request("https://example.test/api/public/territorios/pba/partidos", { headers: { Cookie: "secret-private", Authorization: "Bearer secret-private" } });
    const response = await GET(request, { params: Promise.resolve({ path: ["territorios", "pba", "partidos"] }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(api.parties).toHaveBeenCalledWith({ signal: request.signal });
    expect(await response.json()).toEqual(fixture);
  });
  it("rechaza filtros en la nómina antes de leer el backend", async () => {
    const response = await GET(new Request("https://example.test/api/public/territorios/pba/partidos?partidoId=" + party), { params: Promise.resolve({ path: ["territorios", "pba", "partidos"] }) });
    expect(response.status).toBe(400);
    expect(api.parties).not.toHaveBeenCalled();
  });
  it("reenvía partidoId sólo como filtro de obras y conserva su señal", async () => {
    api.list.mockResolvedValue(examples.listEmpty);
    const request = new Request("https://example.test/api/public/obras?partidoId=" + party);
    const response = await GET(request, { params: Promise.resolve({ path: ["obras"] }) });
    expect(response.status).toBe(200);
    expect(api.list).toHaveBeenCalledWith({ limit: 20, partidoId: party }, { signal: request.signal });
    expect(api.parties).not.toHaveBeenCalled();
  });
  it("oculta diagnósticos de red de una falla territorial", async () => {
    api.parties.mockRejectedValue(new TypeError("http://private.internal secret-private"));
    const response = await GET(new Request("https://example.test/api/public/territorios/pba/partidos"), { params: Promise.resolve({ path: ["territorios", "pba", "partidos"] }) });
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toMatch(/private\.internal|secret-private/);
  });
  it("lee límites por versión explícita y conserva el presupuesto/procedencia independiente", async () => {
    api.boundaries.mockResolvedValue(boundaries);
    const request = new Request("https://example.test/api/public/territorios/pba/partidos/limites?version=pba-partidos-limites%401");
    const response = await GET(request, { params: Promise.resolve({ path: ["territorios", "pba", "partidos", "limites"] }) });
    expect(response.status).toBe(200);
    expect(api.boundaries).toHaveBeenCalledWith("pba-partidos-limites@1", { signal: request.signal });
    expect(await response.json()).toEqual(boundaries);
    expect(response.headers.get("ETag")).toBeNull();
  });
  it.each(["", "?version=pba-partidos-limites%401&version=pba-partidos-limites%401", "?version=pba-partidos-limites%401&partidoId=" + party])("rechaza un límite sin versión única o con filtros de obras: %s", async query => {
    const response = await GET(new Request("https://example.test/api/public/territorios/pba/partidos/limites" + query), { params: Promise.resolve({ path: ["territorios", "pba", "partidos", "limites"] }) });
    expect(response.status).toBe(400);
    expect(api.boundaries).not.toHaveBeenCalled();
  });
  it("rechaza una respuesta territorial cuya versión no coincide sin servir geometría incorrecta", async () => {
    api.boundaries.mockResolvedValue({ ...boundaries, metadata: { ...boundaries.metadata, version: "wrong-version" } });
    const response = await GET(new Request("https://example.test/api/public/territorios/pba/partidos/limites?version=pba-partidos-limites%401"), { params: Promise.resolve({ path: ["territorios", "pba", "partidos", "limites"] }) });
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("FeatureCollection");
  });
});
