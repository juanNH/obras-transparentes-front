/** @file Comprueba presupuesto territorial propio y cancelación del cuerpo excesivo usando streams sintéticos, sin API activa. */
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { publicApi } from "../src/lib/public-api";
import { MAX_PARTY_CATALOG_BYTES } from "../src/lib/party-catalog";
import { MAX_PARTY_BOUNDARY_BYTES } from "../src/lib/party-boundaries";
import { MAX_INSTITUTIONAL_CATALOG_BYTES } from "../src/lib/institutional-organizations";

afterEach(() => vi.unstubAllGlobals());
describe("presupuesto independiente de nómina", () => {
  it("cancela el inventario provincial/nacional de más de 32 KiB con fuentes filtradas", async () => {
    const cancelled = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(32 * 1024 + 1)); }, cancel: cancelled });
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
    vi.stubGlobal("fetch", request);
    await expect(publicApi().sourceCoverage(["nacion-obras"])).rejects.toMatchObject({ status: 413, code: "RESPONSE_BUDGET" });
    expect(cancelled).toHaveBeenCalledOnce();
    expect(String(request.mock.calls[0]![0])).toMatch(/\/obras\/cobertura-fuentes\?fuente=nacion-obras$/);
    expect(request.mock.calls[0]![1]?.cache).toBe("no-store");
  });
  it("cancela conteos filtrados de más de 32 KiB sin asignarles el presupuesto cartográfico", async () => {
    const cancelled = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(32 * 1024 + 1)); }, cancel: cancelled });
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
    vi.stubGlobal("fetch", request);
    await expect(publicApi().counts({ fuente: "pergamino-obras", bbox: [-61, -35, -60, -33] })).rejects.toMatchObject({ status: 413, code: "RESPONSE_BUDGET" });
    expect(cancelled).toHaveBeenCalledOnce();
    expect(String(request.mock.calls[0]![0])).toMatch(/\/obras\/conteos\?/);
    expect(request.mock.calls[0]![1]?.cache).toBe("no-store");
  });
  it("cancela totales municipales de más de 32 KiB sin usar el presupuesto de obras", async () => {
    const cancelled = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(32 * 1024 + 1)); }, cancel: cancelled });
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(body)));
    await expect(publicApi().municipalCoverage()).rejects.toMatchObject({ status: 413, code: "RESPONSE_BUDGET" });
    expect(cancelled).toHaveBeenCalledOnce();
  });
  it("cancela provincias que exceden el presupuesto territorial de 128 KiB", async () => {
    const cancelled = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(MAX_PARTY_CATALOG_BYTES + 1)); }, cancel: cancelled });
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
    vi.stubGlobal("fetch", request);
    await expect(publicApi().provinces()).rejects.toMatchObject({ status: 413, code: "RESPONSE_BUDGET" });
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(String(request.mock.calls[0]![0])).toMatch(/\/territorios\/provincias$/);
    expect(request.mock.calls[0]![1]?.cache).toBe("no-store");
    expect(request.mock.calls[0]![1]?.signal).toBeInstanceOf(AbortSignal);
  });
  it("cancela el catálogo institucional excesivo sin usar el presupuesto de obras", async () => {
    const cancelled = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(MAX_INSTITUTIONAL_CATALOG_BYTES + 1)); }, cancel: cancelled });
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(body)));
    await expect(publicApi().organizations()).rejects.toMatchObject({ status: 413, code: "RESPONSE_BUDGET" });
    expect(cancelled).toHaveBeenCalledTimes(1);
  });
  it("cancela una respuesta territorial mayor a 128 KiB antes de interpretar el contrato", async () => {
    const cancelled = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(MAX_PARTY_CATALOG_BYTES + 1)); },
      cancel: cancelled,
    });
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
    vi.stubGlobal("fetch", request);
    await expect(publicApi().parties()).rejects.toMatchObject({ status: 413, code: "RESPONSE_BUDGET" });
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(String(request.mock.calls[0]![0])).toMatch(/\/territorios\/pba\/partidos$/);
    expect(request.mock.calls[0]![1]?.cache).toBe("no-store");
    expect(request.mock.calls[0]![1]?.signal).toBeInstanceOf(AbortSignal);
  });
  it("aplica 1,5 MiB a límites sin reutilizar el presupuesto de obras", async () => {
    const cancelled = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(MAX_PARTY_BOUNDARY_BYTES + 1)); },
      cancel: cancelled,
    });
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(body)));
    await expect(publicApi().boundaries("pba-partidos-limites@1")).rejects.toMatchObject({ status: 413, code: "RESPONSE_BUDGET" });
    expect(cancelled).toHaveBeenCalledTimes(1);
  });
});
