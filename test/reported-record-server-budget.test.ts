/** @file Límites de lectura con texto multibyte sintético: ficha/lista/exportación completas mayores de 2 MiB y cancelación acotada sin API real. */
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { publicApi, MAX_REPORTED_RECORD_BYTES } from "../src/lib/public-api";
import { homogeneousReportedRecordFixture } from "../tools/reported-record-fixtures.mjs";
import { parsePublicResponse } from "../src/api/contract";
import type { ReportedRecordDetail } from "../src/api/reported-records";
import { reportedRecordCsv, reportedRecordExport } from "../src/lib/reported-record-export";

afterEach(() => vi.unstubAllGlobals());

describe("presupuesto de registros con texto completo", () => {
  it("lee un registro válido con veinte campos multibyte completos, y preserva los textos en lista, JSON y CSV", async () => {
    const raw = structuredClone(homogeneousReportedRecordFixture);
    const literal = "界".repeat(100000);
    raw.registro.nombre = literal;
    raw.registro.datos = Array.from({ length: 20 }, (_, index) => ({ campo: "campo" + index, etiqueta: "Campo sintético " + index, valor: literal, estado: "REPORTED", recursoId: raw.registro.fuente.recursoId, columna: "COLUMNA" + index }));
    const detail = parsePublicResponse<ReportedRecordDetail>("ReportedRecordDetail", raw);
    const json = JSON.stringify(detail);
    expect(Buffer.byteLength(json)).toBeGreaterThan(2 * 1024 * 1024);
    expect(Buffer.byteLength(json)).toBeLessThan(MAX_REPORTED_RECORD_BYTES);
    vi.stubGlobal("fetch", vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(json))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [detail], nextCursor: "synthetic-next", limit: 25, catalogoVersion: "13" }))));
    const readDetail = await publicApi().reportedRecord(detail.registroId);
    const readPage = await publicApi().reportedRecords();
    expect(readDetail.registro?.datos[19]?.valor?.length).toBe(100000);
    expect(readPage.items[0]?.registro?.nombre.length).toBe(100000);
    expect(readPage.nextCursor).toBe("synthetic-next");
    const exported = reportedRecordExport(readDetail);
    expect(exported.registro.datos[19]?.valor).toBe(literal);
    const csv = reportedRecordCsv(readDetail);
    expect(Buffer.byteLength(csv)).toBeGreaterThan(2 * 1024 * 1024);
    expect(csv.includes(literal)).toBe(true);
    expect(csv).toContain("CC-BY-4.0");
  });

  it.each(["detail", "list"])("cancela %s por encima de 8 MiB antes de interpretar el cuerpo", async mode => {
    const cancelled = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(MAX_REPORTED_RECORD_BYTES + 1)); }, cancel: cancelled });
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(body)));
    const api = publicApi();
    await expect(mode === "detail" ? api.reportedRecord(homogeneousReportedRecordFixture.registroId) : api.reportedRecords()).rejects.toMatchObject({ status: 413, code: "RESPONSE_BUDGET" });
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it("mantiene el límite de 2 MiB del catálogo de obras", async () => {
    const cancelled = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1)); }, cancel: cancelled });
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(body)));
    await expect(publicApi().list({})).rejects.toMatchObject({ status: 413, code: "RESPONSE_BUDGET" });
    expect(cancelled).toHaveBeenCalledOnce();
  });
});
