/** @file Comprueba el precheck HTML de fichas con fetch sintético: 404 exactas, body cancelado y aislamiento de headers/base sin red. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";

const id = "abcdefab-cdef-4abc-8def-abcdefabcdef";
const revision = "bcdefabc-defa-4bcd-8efa-bcdefabcdefa";
const missingEnvelope = JSON.stringify({ error: { code: "NOT_FOUND", message: "Ficha sintética no encontrada", details: {}, requestId: null } });
const fetchMock = vi.fn<typeof fetch>();
const input = (path = `/obras/${id}`, init: NonNullable<ConstructorParameters<typeof NextRequest>[1]> = {}) => {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "text/html");
  return new NextRequest(`https://public.example.org${path}`, { ...init, headers });
};
beforeEach(() => {
  vi.stubEnv("PUBLIC_API_URL", "http://127.0.0.1:4100/api/v1");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response("synthetic", { status: 200 }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("precheck de documento de ficha", () => {
  it.each([
    { method: "POST" },
    { method: "HEAD" },
    { headers: { RSC: "1" } },
    { headers: { "Next-Router-Prefetch": "1" } },
    { headers: { "X-Middleware-Prefetch": "1" } },
    { headers: { Purpose: "prefetch" } },
    { headers: { "Sec-Purpose": "prefetch;prerender" } },
    { headers: { Purpose: "navigate", "Sec-Purpose": "prefetch" } },
    { headers: { "Sec-Fetch-Dest": "empty" } },
    { headers: { Accept: "application/json" } },
  ])("omite métodos/formato, RSC y precargas: %j", async init => {
    const response = await proxy(input(undefined, init));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "/obras/missing", `/obras/${id}?revisionId=invalid`, `/obras/${id}?revisionId=${revision}&revisionId=${revision}`, "/obras/%E0%A4%A",
  ])("un enlace inválido reescribe 404 sin API: %s", async path => {
    const response = await proxy(input(path));
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://public.example.org/404");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reescribe solamente un 404 con sobre válido y cierra la lectura acotada del error", async () => {
    const upstream = new Response(missingEnvelope, { status: 404 });
    const reader = upstream.body!.getReader();
    const cancel = vi.spyOn(reader, "cancel");
    vi.spyOn(upstream.body!, "getReader").mockReturnValue(reader);
    fetchMock.mockResolvedValue(upstream);
    const response = await proxy(input(`/obras/${id}?revisionId=${revision}&tracking=ignored`));
    expect(response.status).toBe(404);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0].toString()).toBe(`http://127.0.0.1:4100/api/v1/obras/${id}?revisionId=${revision}`);
  });

  it.each([null, "", "<html>Infrastructure not found</html>", "{malformed", JSON.stringify({ error: { code: "NOT_FOUND" } })])("no sustituye un 404 inválido por una obra inexistente: %s", async body => {
    fetchMock.mockResolvedValue(new Response(body, { status: 404 }));
    const response = await proxy(input());
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.has("x-middleware-rewrite")).toBe(false);
  });

  it("no lee errores 404 que excedan 16 KiB", async () => {
    const oversized = JSON.stringify({ error: { code: "NOT_FOUND", message: "x".repeat(16 * 1024), details: {}, requestId: null } });
    fetchMock.mockResolvedValue(new Response(oversized, { status: 404 }));
    const response = await proxy(input());
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("la señal de 2 segundos también cierra un body 404 incompleto sin falso 404", async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const cancel = vi.fn();
    fetchMock.mockResolvedValue(new Response(new ReadableStream({ start(stream) { stream.enqueue(new TextEncoder().encode('{"error":')); }, cancel }), { status: 404 }));
    const pending = proxy(input());
    await Promise.resolve();
    controller.abort();
    const response = await pending;
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it.each([200, 204, 301, 403, 429, 500, 503])("mantiene render vigente para estado %i, sin falso 404", async status => {
    const cancel = vi.fn();
    fetchMock.mockResolvedValue(new Response(status === 204 ? null : new ReadableStream({ cancel }), { status }));
    const response = await proxy(input());
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.has("x-middleware-rewrite")).toBe(false);
    if (status !== 204) expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("usa base fija y política anónima sin Host, Cookie, Authorization ni X-Forwarded-For entrantes", async () => {
    const response = await proxy(input(`/obras/${id.toUpperCase()}?revisionId=${revision.toUpperCase()}`, { headers: { Host: "attacker.invalid", Cookie: "private=secret", Authorization: "Bearer secret", "X-Forwarded-For": "203.0.113.1" } }));
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toBe(`http://127.0.0.1:4100/api/v1/obras/${id}?revisionId=${revision}`);
    expect(options).toMatchObject({ method: "GET", credentials: "omit", redirect: "error", cache: "no-store", headers: { Accept: "application/json" } });
    expect(Object.keys(options!.headers!)).toEqual(["Accept"]);
    expect(options!.signal).toBeInstanceOf(AbortSignal);
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(await response.text()).not.toContain("secret");
  });

  it.each([
    "https://user:pass@api.example.org/api/v1", "ftp://api.example.org/api/v1", "https://api.example.org/api/v1?token=secret", "https://api.example.org/api/v1#fragment", "/api/v1",
  ])("no consulta bases inseguras y conserva error del render: %s", async base => {
    vi.stubEnv("PUBLIC_API_URL", base);
    const response = await proxy(input());
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("combina cancelación del documento y timeout de 2 segundos sin convertirla en 404", async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockImplementation(async (_url, options) => new Promise((_resolve, reject) => {
      options!.signal!.addEventListener("abort", () => reject(new DOMException("Canceled", "AbortError")), { once: true });
    }));
    const pending = proxy(input(undefined, { signal: controller.signal }));
    controller.abort();
    const response = await pending;
    expect(timeout).toHaveBeenCalledWith(2000);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.has("x-middleware-rewrite")).toBe(false);
  });

  it("una caída de red mantiene recuperación del render sin exponer su diagnóstico", async () => {
    fetchMock.mockRejectedValue(new Error("http://private.internal secret"));
    const response = await proxy(input());
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(await response.text()).not.toMatch(/private\.internal|secret/);
  });
});
