/** @file Verifica contrato, transporte anónimo y semántica de registros sintéticos, sin consultar servicios ni datos reales. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createPublicApi } from "../src/api/client";
import { ApiContractError, parsePublicResponse } from "../src/api/contract";
import { assertReportedRecord, parseReportedRecordQuery, reportedRecordsHref, type ReportedRecordDetail } from "../src/api/reported-records";
import { ReportedRecordContent, ReportedRecordCard } from "../src/components/reported-record";
import { documentaryReportedRecordFixture, homogeneousReportedRecordFixture, reportedRecordFixtures } from "../tools/reported-record-fixtures.mjs";

/** Copia y valida una publicación sintética contra los tipos y esquema generados. */
function publishedRecord(): ReportedRecordDetail {
  return parsePublicResponse("ReportedRecordDetail", structuredClone(reportedRecordFixtures[0]));
}

describe("registros públicos informados", () => {
  it("presenta secciones documentales con PDF original, transcripción separada y texto completo sin asignar territorio", () => {
    const detail = parsePublicResponse<ReportedRecordDetail>("ReportedRecordDetail", structuredClone(documentaryReportedRecordFixture));
    const html = renderToStaticMarkup(createElement(ReportedRecordContent, { detail }));
    expect(html).toContain("Sección de informe documental");
    expect(html).toContain("FIN DE SECCIÓN SINTÉTICA");
    expect(html).toContain("no acredita una obra única");
    expect(html).toContain("Territorio informado por la fuente: No informado");
    expect(html).toContain('href="https://example.invalid/informe-sintetico.pdf"');
    expect(html).toContain("Página del PDF original");
    expect(html).toContain("SECCIÓN SINTÉTICA");
    expect(html).toContain("c".repeat(64));
    expect(html).toContain("b".repeat(64));
    expect(html).toContain("Huella SHA-256 de la transcripción JSON derivada");
    expect(html).not.toContain("originalBase64");
    expect(html).not.toContain("rawCells");
    if (detail.registro?.tipo !== "DOCUMENT_REPORT_SECTION" || !("pagina" in detail.registro.documento)) throw new Error("Expected synthetic PDF document");
    detail.registro.documento.paginaFin = 3;
    const rangeHtml = renderToStaticMarkup(createElement(ReportedRecordContent, { detail }));
    expect(rangeHtml).toContain("Páginas del PDF original");
    expect(rangeHtml).toContain("2–3");
    detail.registro.documento.paginaFin = 1;
    expect(() => assertReportedRecord(detail)).toThrow("rango de páginas");
    expect(parseReportedRecordQuery(new URLSearchParams("fuente=lujan-documentos&tipo=DOCUMENT_REPORT_SECTION&territorio=UNKNOWN"))).toEqual({ fuente: "lujan-documentos", tipo: "DOCUMENT_REPORT_SECTION", territorio: "UNKNOWN" });
  });

  it("rechaza secciones sin procedencia y conserva los tipos históricos sin documento", () => {
    const missing = structuredClone(documentaryReportedRecordFixture);
    Reflect.deleteProperty(missing.registro, "documento");
    expect(() => parsePublicResponse("ReportedRecordDetail", missing)).toThrow(ApiContractError);
    const legacy = structuredClone(reportedRecordFixtures[0]!);
    Reflect.set(legacy.registro!, "documento", documentaryReportedRecordFixture.registro.documento);
    expect(() => parsePublicResponse("ReportedRecordDetail", legacy)).toThrow(ApiContractError);
    const prior = structuredClone(homogeneousReportedRecordFixture);
    Reflect.set(prior.registro, "documento", documentaryReportedRecordFixture.registro.documento);
    expect(() => parsePublicResponse("ReportedRecordDetail", prior)).toThrow(ApiContractError);
  });
  it("conserva filtros y cursor opaco sin aceptar privados, repetidos ni geometría", () => {
    const query = parseReportedRecordQuery(new URLSearchParams("fuente=bahia-obras&tipo=WORK_RECORD&limit=1&cursor=opaque%2Btoken"));
    expect(reportedRecordsHref(query, "next+token")).toBe("/registros?fuente=bahia-obras&tipo=WORK_RECORD&limit=1&cursor=next%2Btoken");
    expect(reportedRecordsHref(query)).not.toContain("cursor");
    for (const value of ["fuente=a&fuente=b", "loteId=secret", "bbox=1,2,3,4", "limit=101", "limit=", "tipo=UNKNOWN", "cursor="]) expect(() => parseReportedRecordQuery(new URLSearchParams(value))).toThrow(TypeError);
    expect(() => parseReportedRecordQuery(new URLSearchParams("cursor=x"), false)).toThrow(TypeError);
    expect(parseReportedRecordQuery(new URLSearchParams("provinciaCodigo=06&partidoCodigo=06056&localidadCodigo=060560001"))).toEqual({ provinciaCodigo: "06", partidoCodigo: "06056", localidadCodigo: "060560001" });
    expect(parseReportedRecordQuery(new URLSearchParams("territorio=UNKNOWN"))).toEqual({ territorio: "UNKNOWN" });
    expect(() => parseReportedRecordQuery(new URLSearchParams("territorio=UNKNOWN&provinciaCodigo=06"))).toThrow(TypeError);
    expect(() => parseReportedRecordQuery(new URLSearchParams("territorio=KNOWN"))).toThrow(TypeError);
  });

  it("renderiza dudas y motivos visibles en tarjeta y ficha, con desconocido distinto de cero", () => {
    const detail = publishedRecord();
    for (const component of [ReportedRecordContent, ReportedRecordCard]) {
      const html = renderToStaticMarkup(createElement(component, { detail }));
      expect(html).toContain("Posible duplicado");
      expect(html).toContain("Datos contradictorios");
      expect(html).toContain("Otro registro podría describir la misma intervención");
      expect(html).not.toContain("<summary>Advertencias");
      expect(html).not.toContain("Ver en mapa");
      expect(html).not.toContain("/obras/");
    }
    const html = renderToStaticMarkup(createElement(ReportedRecordContent, { detail }));
    expect(html).toContain("No informado");
    expect(html).toContain(">0</dd>");
    expect(html).toContain("999999999999999999.1234");
    expect(html).toContain("Atribución exclusivamente sintética.");
    expect(html).toContain("Captura de la fuente");
    expect(html).toContain("Publicación del registro");
  });

  it("un retiro no revela la instantánea anterior y una URL insegura no se vuelve enlace", () => {
    const retired = parsePublicResponse<ReportedRecordDetail>("ReportedRecordDetail", reportedRecordFixtures[3]);
    const html = renderToStaticMarkup(createElement(ReportedRecordContent, { detail: retired }));
    expect(html).toContain("Registro retirado");
    expect(html).not.toContain("Registro de reparación");
    expect(html).not.toContain("recurso");
    const detail = publishedRecord();
    detail.registro!.fuente.urlCatalogo = "https://user:secret@example.invalid";
    detail.registro!.datos[0]!.valor = "<script>private()</script>";
    detail.registro!.datos[0]!.estado = "REPORTED";
    const unsafe = renderToStaticMarkup(createElement(ReportedRecordContent, { detail }));
    expect(unsafe).not.toContain('href="https://user');
    expect(unsafe).not.toContain("<script>");
  });

  it("conserva territorio y captura desconocidos sin usar el municipio de la fuente para ubicarlos", () => {
    const detail = publishedRecord();
    detail.registro!.territorio = null;
    detail.registro!.fuente.capturadaEn = null;
    const html = renderToStaticMarkup(createElement(ReportedRecordContent, { detail }));
    expect(html).toContain("Territorio informado por la fuente: No informado");
    expect(html).toContain("Fecha no informada");
    expect(html).not.toContain("Bahía Blanca");
    expect(html).not.toContain("coordinates");
  });

  it("rechaza campos privados y geometrías fuera del contrato público", () => {
    const detail = publishedRecord();
    expect(() => parsePublicResponse("ReportedRecordDetail", { ...detail, actorId: "PRIVATE" })).toThrow(ApiContractError);
    expect(() => parsePublicResponse("ReportedRecordDetail", { ...detail, registro: { ...detail.registro, observacion: { raw: "PRIVATE" } } })).toThrow(ApiContractError);
    expect(() => parsePublicResponse("ReportedRecordDetail", { ...detail, registro: { ...detail.registro, geometria: { type: "Point", coordinates: [1, 2] } } })).toThrow(ApiContractError);
  });

  it("usa rutas públicas anónimas y rechaza identidades, retiros inconsistentes y duplicados de página", async () => {
    const detail = publishedRecord();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(detail)));
    const api = createPublicApi({ baseUrl: "https://api.example.invalid/api/v1", fetch: fetcher });
    expect(await api.reportedRecord(detail.registroId)).toEqual(detail);
    expect(fetcher).toHaveBeenCalledWith("https://api.example.invalid/api/v1/registros-informados/" + detail.registroId, expect.objectContaining({ method: "GET", credentials: "omit", redirect: "error", headers: { Accept: "application/json" } }));
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ ...detail, estado: "RETIRED" })));
    await expect(api.reportedRecord(detail.registroId)).rejects.toThrow(ApiContractError);
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ items: [detail, detail], nextCursor: null, limit: 25, catalogoVersion: "13" })));
    await expect(api.reportedRecords()).rejects.toThrow(ApiContractError);
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify(detail)));
    await expect(api.reportedRecord("88000000-0000-4000-8000-000000000099")).rejects.toThrow(ApiContractError);
    await expect(api.reportedRecord("not-an-id")).rejects.toThrow(TypeError);
    const malformed = structuredClone(detail);
    malformed.registro!.datos[0]!.valor = "synthetic-hidden";
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify(malformed)));
    await expect(api.reportedRecord(detail.registroId)).rejects.toThrow(ApiContractError);
  });

  it("los conteos de registros concilian sus desgloses y no contienen un total de obras", async () => {
    const counts = { catalogoVersion: "13", totalRegistros: 2, porFuente: [{ codigo: "bahia-obras", cantidad: 2 }], porTipo: [{ tipo: "WORK_RECORD", cantidad: 2 }], partidosConRegistros: 1, localidadesConRegistros: 0 };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(counts)));
    const api = createPublicApi({ fetch: fetcher });
    expect(await api.reportedRecordCounts()).toEqual(counts);
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ ...counts, totalRegistros: 3 })));
    await expect(api.reportedRecordCounts()).rejects.toThrow(ApiContractError);
  });

  it("v2 conserva texto completo y distingue avisos comunes, problemas concretos y un campo restringido", () => {
    const detail = parsePublicResponse<ReportedRecordDetail>("ReportedRecordDetail", structuredClone(homogeneousReportedRecordFixture));
    const html = renderToStaticMarkup(createElement(ReportedRecordContent, { detail }));
    expect(html).toContain("FIN DEL TÍTULO COMPLETO");
    expect(html).toContain("Cómo interpretar estos datos");
    expect(html).toContain("Dudas específicas del registro");
    expect(html).toContain("Qué se observó y cómo se publica");
    expect(html).toContain("Campo no publicado");
    expect(html).toContain("no impide leer el resto del registro");
    expect(html).toContain("columna RESTRINGIDO");
    expect(html).toContain("publicacion-homogenea@2");
    expect(html).toContain("=HYPERLINK");
    expect(html).not.toContain('<a href="https://example.invalid">dato literal');
    const card = renderToStaticMarkup(createElement(ReportedRecordCard, { detail }));
    expect(card).toContain("Título abreviado en esta lista");
    expect(card).not.toContain("FIN DEL TÍTULO COMPLETO");
    expect(card).not.toContain("Cómo interpretar estos datos");
  });

  it("una etiqueta elaborada remite a su motivo y procedencia sin atribuir ausencia de título", () => {
    const detail = parsePublicResponse<ReportedRecordDetail>("ReportedRecordDetail", structuredClone(homogeneousReportedRecordFixture));
    if (detail.registro?.version !== "registro-informado@2") throw new Error("Expected synthetic v2");
    detail.registro.nombreGenerado = true;
    detail.registro.nombre = "Registro de ejemplo sin título";
    detail.registro.hallazgos.push({ codigo: "TITLE_GENERATED", campo: "title", motivo: "Rótulo compuesto durante la transcripción a partir de acción y sitio; conserva el texto íntegro de esta etiqueta.", tratamiento: "GENERATED_LABEL", recursoId: detail.registro.fuente.recursoId, columna: "rawCells", politicaVersion: "publicacion-homogenea@2" });
    for (const Component of [ReportedRecordContent, ReportedRecordCard]) {
      const html = renderToStaticMarkup(createElement(Component, { detail }));
      expect(html).toContain("Etiqueta elaborada para identificar el registro. Consultá el motivo y su procedencia.");
      expect(html).toContain("Rótulo compuesto durante la transcripción a partir de acción y sitio; conserva el texto íntegro de esta etiqueta.");
      expect(html).toContain("columna rawCells");
      expect(html).toContain("TITLE_GENERATED");
      expect(html).not.toContain("La fuente no informó un título utilizable");
      expect(html).not.toContain("No es un título informado por la fuente");
    }
  });

  it("un problema v2 presente en hallazgos no se repite como otra duda independiente", () => {
    const detail = parsePublicResponse<ReportedRecordDetail>("ReportedRecordDetail", structuredClone(homogeneousReportedRecordFixture));
    if (detail.registro?.version !== "registro-informado@2") throw new Error("Expected synthetic v2");
    detail.registro.hallazgos.push({ codigo: "FIELD_CONFLICT", campo: null, motivo: "Conflicto sintético único.", tratamiento: "PUBLISHED_LITERAL", recursoId: detail.registro.fuente.recursoId, columna: null, politicaVersion: "publicacion-homogenea@2" });
    detail.registro.advertencias = [{ codigo: "FIELD_CONFLICT", motivo: "Conflicto sintético único." }];
    const html = renderToStaticMarkup(createElement(ReportedRecordContent, { detail }));
    expect((html.match(/Conflicto sintético único\./g) ?? []).length).toBe(1);
    expect(html).not.toContain("Dudas específicas del registro");
  });
});
