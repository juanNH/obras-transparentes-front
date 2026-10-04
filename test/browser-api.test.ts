import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserApiError, readPublic } from "../src/lib/browser-api.js";

afterEach(() => vi.unstubAllGlobals());
const encoder = new TextEncoder();

describe("descarga pública del navegador", () => {
  it("usa el BFF sin credenciales ni caché y conserva el signal", async () => {
    const response = new Response(JSON.stringify({ nombre: "Obra pública" }));
    const request = vi.fn<typeof fetch>().mockResolvedValue(response);
    vi.stubGlobal("fetch", request);
    const controller = new AbortController();
    await expect(readPublic("obras?estado=IN_PROGRESS", controller.signal)).resolves.toEqual({ nombre: "Obra pública" });
    expect(request).toHaveBeenCalledWith("/api/public/obras?estado=IN_PROGRESS", { signal: controller.signal, credentials: "omit", cache: "no-store" });
    expect(response.body?.locked).toBe(false);
  });
  it("reconstruye Unicode partido entre chunks sin perder caracteres", async () => {
    const bytes = encoder.encode(JSON.stringify({ nombre: "Construcción 🏗️" }));
    const body = new ReadableStream<Uint8Array>({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); } });
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(body)));
    await expect(readPublic("obras", new AbortController().signal, bytes.length)).resolves.toEqual({ nombre: "Construcción 🏗️" });
  });
  it("cancela el stream al superar bytes, antes de decodificar el cuerpo entero", async () => {
    const cancelled = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(encoder.encode('"áááá"')); }, cancel: cancelled });
    const response = new Response(body);
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(response));
    await expect(readPublic("geojson", new AbortController().signal, 8)).rejects.toMatchObject({ name: "Error", code: "RESPONSE_BUDGET" });
    expect(cancelled).toHaveBeenCalledOnce();
    expect(response.body?.locked).toBe(false);
  });
  it("propaga cancelaciones de red o lectura sin convertirlas en respuestas válidas", async () => {
    const aborted = new DOMException("Operación cancelada", "AbortError");
    const request = vi.fn<typeof fetch>().mockRejectedValueOnce(aborted);
    vi.stubGlobal("fetch", request);
    await expect(readPublic("obras", new AbortController().signal)).rejects.toBe(aborted);
    const response = new Response(new ReadableStream<Uint8Array>({ start(controller) { controller.error(aborted); } }));
    request.mockResolvedValueOnce(response);
    await expect(readPublic("obras", new AbortController().signal)).rejects.toBe(aborted);
    expect(response.body?.locked).toBe(false);
  });
  it("conserva el código de error del catálogo y rechaza cuerpos vacíos", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "CATALOG_CHANGED", message: "Reiniciá la consulta" } }), { status: 409 }));
    vi.stubGlobal("fetch", request);
    await expect(readPublic("obras", new AbortController().signal)).rejects.toMatchObject({ code: "CATALOG_CHANGED", message: "Reiniciá la consulta" });
    request.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(readPublic("obras", new AbortController().signal)).rejects.toBeInstanceOf(BrowserApiError);
  });
});
