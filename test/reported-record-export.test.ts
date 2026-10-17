/** @file Exportación y descargas con registros sintéticos: literales, atribución, retiro, fórmulas inertes y ausencia de solicitudes privadas. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { documentaryReportedRecordFixture, homogeneousReportedRecordFixture, reportedRecordFixtures } from "../tools/reported-record-fixtures.mjs";
import { parsePublicResponse } from "../src/api/contract";
import type { ReportedRecordDetail } from "../src/api/reported-records";
import { PublicApiError } from "../src/api/client";
import { reportedRecordCitation, reportedRecordCsv, reportedRecordCsvCell, reportedRecordExport } from "../src/lib/reported-record-export";

const api = vi.hoisted(() => ({ reportedRecord: vi.fn() }));
vi.mock("../src/lib/public-api", () => ({ publicApi: () => api }));
import { GET } from "../src/app/registros/[id]/descargar/route";

/** Construye una publicación sintética contra el contrato generado, sin estado real. */
function fixture() {
  return parsePublicResponse<ReportedRecordDetail>("ReportedRecordDetail", structuredClone(reportedRecordFixtures[0]));
}

/** Ejecuta la descarga con cabeceras privadas que el handler no debe reenviar. */
function download(query = "formato=json", id = reportedRecordFixtures[0]!.registroId) {
  return GET(new Request(`https://front.example.invalid/registros/${id}/descargar?${query}`, { headers: { Cookie: "synthetic-private", Authorization: "Bearer synthetic-private" } }), { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.resetAllMocks();
  api.reportedRecord.mockResolvedValue(fixture());
});

describe("proyección pública descargable", () => {
  it("conserva la procedencia del PDF y del JSON derivado en copia, JSON y CSV de secciones", () => {
    const detail = parsePublicResponse<ReportedRecordDetail>("ReportedRecordDetail", structuredClone(documentaryReportedRecordFixture));
    const citation = reportedRecordCitation(detail);
    expect(citation).toContain("Transcripción JSON derivada");
    expect(citation).toContain("PDF original:");
    expect(citation).toContain("página 2; sección SECCIÓN SINTÉTICA");
    for (const content of [JSON.stringify(reportedRecordExport(detail)), reportedRecordCsv(detail)]) {
      expect(content).toContain("DOCUMENT_REPORT_SECTION");
      expect(content).toContain("FIN DE SECCIÓN SINTÉTICA");
      expect(content).toContain("informe-sintetico.pdf");
      expect(content).toContain("c".repeat(64));
      expect(content).toContain("b".repeat(64));
      expect(content).toContain("REPORT_SECTION_GRANULARITY_UNRESOLVED");
      expect(content).not.toContain("originalBase64");
      expect(content).not.toContain("rawCells");
    }
    if (detail.registro?.tipo !== "DOCUMENT_REPORT_SECTION" || !("pagina" in detail.registro.documento)) throw new Error("Expected synthetic PDF document");
    detail.registro.documento.paginaFin = 3;
    expect(reportedRecordCitation(detail)).toContain("páginas 2–3; sección SECCIÓN SINTÉTICA");
    expect(reportedRecordCsv(detail)).toContain('"documento","paginaFin","3"');
  });
  it("conserva texto, cero y desconocido en JSON y licencia y trazabilidad en ambos formatos", () => {
    const detail = fixture();
    detail.registro!.datos[2]!.valor = '=HYPERLINK("https://example.invalid", "sintético")';
    const exported = reportedRecordExport(detail);
    expect(exported.registro.datos[2]!.valor).toMatch(/^=HYPERLINK/);
    expect(exported.registro.datos[0]!.valor).toBeNull();
    expect(exported.registro.datos[1]!.valor).toBe("0");
    expect(exported.referencia).toContain("versión 1");
    expect(reportedRecordCitation(detail)).toContain(detail.registro!.fuente.sha256);
    const csv = reportedRecordCsv(detail);
    expect(csv).toContain('"\'=HYPERLINK(""https://example.invalid""');
    expect(csv).toContain('"NOT_REPORTED"');
    expect(csv).toContain('"0","REPORTED"');
    expect(csv).toContain("Atribución exclusivamente sintética.");
    expect(csv).toContain("SHA-256");
  });

  it.each(["=1+1", "+1+1", "-2+3", "@SUM(1)", "  =SUM(1)", "\t+1", "\r\n=1", "\u0000=1"])("desactiva el prefijo de fórmula de %j", value => {
    expect(reportedRecordCsvCell(value)).toBe('"\'' + value + '"');
  });

  it("escapa comillas y mantiene el contenido literal en JSON", () => {
    expect(reportedRecordCsvCell('uno,"dos"\ntres')).toBe('"uno,""dos""\ntres"');
    expect(reportedRecordCsvCell(null)).toBe('""');
    expect(reportedRecordCsvCell("0")).toBe('"0"');
  });

  it("exporta v2 con texto largo íntegro, estados y motivos sin reintroducir el valor restringido", () => {
    const detail = parsePublicResponse<ReportedRecordDetail>("ReportedRecordDetail", structuredClone(homogeneousReportedRecordFixture));
    const json = JSON.stringify(reportedRecordExport(detail));
    const csv = reportedRecordCsv(detail);
    for (const content of [json, csv]) {
      expect(content).toContain("FIN DEL TÍTULO COMPLETO");
      expect(content).toContain("WITHHELD");
      expect(content).toContain("FIELD_RESTRICTED");
      expect(content).toContain("publicacion-homogenea@2");
      expect(content).toContain("Atribución exclusivamente sintética.");
    }
  });

  it("rechaza una proyección incoherente antes de exportar un valor restringido o desconocido", () => {
    const detail = parsePublicResponse<ReportedRecordDetail>("ReportedRecordDetail", structuredClone(homogeneousReportedRecordFixture));
    if (detail.registro?.version !== "registro-informado@2") throw new Error("Expected synthetic v2");
    const withheld = detail.registro.datos.find(field => field.estado === "WITHHELD")!;
    withheld.valor = "synthetic-value-that-must-not-export";
    expect(() => reportedRecordExport(detail)).toThrow("no puede exponer un valor");
    expect(() => reportedRecordCsv(detail)).toThrow("no puede exponer un valor");
    withheld.valor = null;
    const unknown = detail.registro.datos.find(field => field.estado === "NOT_REPORTED")!;
    unknown.valor = "synthetic-unknown-invalid-value";
    expect(() => reportedRecordExport(detail)).toThrow("no puede exponer un valor");
  });

  it("relee la publicación por cada descarga sin cookies, con no-store y nombre seguro", async () => {
    for (const format of ["json", "csv"]) {
      const response = await download("formato=" + format);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("content-disposition")).toContain(`registro-${reportedRecordFixtures[0]!.registroId}.${format}`);
      expect(await response.text()).toContain("Atribución exclusivamente sintética.");
    }
    expect(api.reportedRecord).toHaveBeenCalledTimes(2);
    expect(api.reportedRecord).toHaveBeenCalledWith(reportedRecordFixtures[0]!.registroId, { signal: expect.any(AbortSignal) });
  });

  it("un retiro no descarga contenido previo y los errores no filtran diagnósticos", async () => {
    api.reportedRecord.mockResolvedValueOnce(reportedRecordFixtures[3]);
    const retired = await download();
    expect(retired.status).toBe(410);
    expect(await retired.text()).not.toContain("Registro de reparación");
    api.reportedRecord.mockRejectedValueOnce(new PublicApiError(404, { code: "NOT_FOUND", message: "private-diagnostic", requestId: null }));
    expect((await download()).status).toBe(404);
    api.reportedRecord.mockRejectedValueOnce(new Error("private-original"));
    const failed = await download();
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("private-original");
  });

  it("rechaza formato, parámetros, duplicados e identidad inválidos antes de consultar", async () => {
    for (const query of ["", "formato=raw", "formato=json&formato=csv", "formato=json&original=true"])
      expect((await download(query)).status).toBe(400);
    expect((await download("formato=json", "bad-id")).status).toBe(400);
    expect(api.reportedRecord).not.toHaveBeenCalled();
  });
});
