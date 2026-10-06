/** @file Comprueba SEO y recuperación 404 de fichas con datos sintéticos; conserva descripciones, UUID y errores de servicio sin red. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import examples from "../contracts/examples.json" with { type: "json" };
import { PublicApiError, type WorkDetail } from "../src/api/client";
import { parsePublicResponse } from "../src/api/contract";
import { stateLabel } from "../src/lib/presentation";

const api = vi.hoisted(() => ({ detail: vi.fn() }));
const seo = vi.hoisted(() => ({ origin: null as URL | null }));
vi.mock("../src/lib/public-api.js", () => ({ publicApi: () => api }));
vi.mock("../src/lib/config", () => ({ indexableSiteUrl: () => seo.origin, reportEmail: () => null }));
import WorkPage, { generateMetadata } from "../src/app/obras/[id]/page";

const work = parsePublicResponse<WorkDetail>("PublicWorkDetail", examples.detailPopulated);
const props = (query: Record<string, string | string[] | undefined> = {}, id = work.obraId) => ({ params: Promise.resolve({ id }), searchParams: Promise.resolve(query) });
beforeEach(() => { vi.resetAllMocks(); seo.origin = null; api.detail.mockResolvedValue(work); });

describe("metadatos de ficha", () => {
  it("conserva la descripción y agrega sólo territorio informado al título", async () => {
    const metadata = await generateMetadata(props());
    expect(metadata.description).toBe(`${work.nombre}. ${stateLabel(work.estado)}. Consultá la información disponible, sus fechas y fuentes en Obras Transparentes.`);
    expect(metadata.title).toBe(`${work.nombre} · ${work.territorios[0]!.nombre}`);
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata).not.toHaveProperty("alternates");
    expect(metadata).not.toHaveProperty("openGraph");
  });

  it("no inventa territorio cuando no está publicado", async () => {
    api.detail.mockResolvedValue({ ...work, territorios: [] });
    expect((await generateMetadata(props())).title).toBe(work.nombre);
  });

  it("habilita sólo la ficha actual, manteniendo canonical actual en historia", async () => {
    seo.origin = new URL("https://obras.example.org");
    const current = await generateMetadata(props());
    expect(current.robots).toEqual({ index: true, follow: true });
    expect(current.alternates).toEqual({ canonical: `https://obras.example.org/obras/${work.obraId}` });
    const historical = await generateMetadata(props({ revisionId: work.revisionId }));
    expect(historical.robots).toEqual({ index: false, follow: true });
    expect(historical.alternates).toEqual(current.alternates);
    expect(historical.openGraph).toMatchObject({ url: `https://obras.example.org/obras/${work.obraId}` });
    api.detail.mockResolvedValue({ ...work, publicadaActualmente: false });
    expect((await generateMetadata(props())).robots).toEqual({ index: false, follow: true });
  });

  it.each([
    ["missing", {}],
    [work.obraId, { revisionId: "invalid-revision" }],
    [work.obraId, { revisionId: [work.revisionId, work.revisionId] }],
  ])("metadatos de ruta inválida no consultan API ni interrumpen render: %s", async (id, query) => {
    seo.origin = new URL("https://obras.example.org");
    const metadata = await generateMetadata(props(query, id));
    expect(metadata).toEqual({ title: "Obra no encontrada", robots: { index: false, follow: true }, alternates: null, openGraph: null });
    expect(api.detail).not.toHaveBeenCalled();
  });

  it("trata 404 como ausencia con noindex y deja notFound para el render de la página", async () => {
    seo.origin = new URL("https://obras.example.org");
    api.detail.mockRejectedValue(new PublicApiError(404, { code: "NOT_FOUND", message: "Ficha no encontrada", details: {}, requestId: null }));
    const metadata = await generateMetadata(props());
    expect(metadata).toEqual({ title: "Obra no encontrada", robots: { index: false, follow: true }, alternates: null, openGraph: null });
    await expect(WorkPage(props())).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    await expect(WorkPage(props({}, "missing"))).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  it.each([
    new PublicApiError(503, { code: "UNAVAILABLE", message: "Servicio no disponible", details: {}, requestId: null }),
    new TypeError("network failure"),
  ])("propaga errores ajenos a 404 para conservar recuperación de servicio", async error => {
    api.detail.mockRejectedValue(error);
    await expect(generateMetadata(props())).rejects.toBe(error);
    await expect(WorkPage(props())).rejects.toBe(error);
  });

  it("conserva la normalización de UUID en metadatos", async () => {
    const id = "ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF";
    const revision = "BCDEFABC-DEFA-4BCD-8EFA-BCDEFABCDEFA";
    api.detail.mockResolvedValue({ ...work, obraId: id.toLowerCase(), revisionId: revision.toLowerCase() });
    await generateMetadata(props({ revisionId: revision }, id));
    expect(api.detail).toHaveBeenCalledWith(id.toLowerCase(), revision.toLowerCase());
  });
});
