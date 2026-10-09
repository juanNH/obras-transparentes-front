/** @file Comprueba evidencia física CSV/XLSX/JSON y referencias visuales municipales con datos sintéticos, sin red o publicaciones. */
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { WorkDetail } from "../src/api/client";
import { Evidence } from "../src/components/work-evidence";
import { SourceBadge, SourceLegend } from "../src/components/source-origin";
import ProjectPage from "../src/app/proyecto/page";

vi.mock("server-only", () => ({}));

/** Renderiza una referencia física sintética mediante el mismo componente usado en la ficha y resumen públicos. */
function sourceEvidence(
  localizador: Extract<
    WorkDetail["procedencia"][string]["evidencias"][number],
    { tipo: "SOURCE_CELL" }
  >["localizador"],
): string {
  return renderToStaticMarkup(
    createElement(Evidence, {
      obraId: "10000000-0000-4000-8000-000000000001",
      evidence: {
        tipo: "SOURCE_CELL",
        registroOrigenId: "10000000-0000-4000-8000-000000000002",
        resultadoRegistroId: "10000000-0000-4000-8000-000000000003",
        recursoId: "10000000-0000-4000-8000-000000000004",
        columna: "Nombre",
        posicion: 1,
        localizador,
      },
    }),
  );
}

describe("evidencia física pública", () => {
  it("describe referencia GeoRef con provincia y departamento y sólo habilita enlaces seguros", () => {
    const evidence: Extract<
      WorkDetail["procedencia"][string]["evidencias"][number],
      { tipo: "GEOREF_LOCALITY" }
    > = {
      tipo: "GEOREF_LOCALITY",
      codigo: "06861010001",
      nombre: "EJEMPLO SINTÉTICO — Localidad",
      provinciaCodigo: "06",
      provinciaNombre: "EJEMPLO SINTÉTICO — Provincia",
      departamentoCodigo: "06861",
      departamentoNombre: "EJEMPLO SINTÉTICO — Departamento",
      referencia: {
        url: "https://example.test/georef",
        version: "synthetic-georef@1",
        consultadoEn: "2026-10-09T12:00:00Z",
        sha256: "a".repeat(64),
      },
    };
    const html = renderToStaticMarkup(
      createElement(Evidence, {
        obraId: "10000000-0000-4000-8000-000000000001",
        evidence,
      }),
    );
    expect(html).toContain("Referencia GeoRef de localidad");
    expect(html).toContain("06861010001");
    expect(html).toContain(
      "departamento EJEMPLO SINTÉTICO — Departamento (06861)",
    );
    expect(html).toContain('href="https://example.test/georef"');
    expect(html).not.toContain("undefined");
    const unsafe = renderToStaticMarkup(
      createElement(Evidence, {
        obraId: "10000000-0000-4000-8000-000000000001",
        evidence: {
          ...evidence,
          referencia: { ...evidence.referencia, url: "javascript:alert(1)" },
        },
      }),
    );
    expect(unsafe).toContain("Referencia territorial (enlace no disponible)");
    expect(unsafe).not.toContain("javascript:");
  });
  it("describe JSON por registro, pointer y bytes con fin exclusivo", () => {
    const html = sourceEvidence({
      format: "JSON",
      pointer: "/4",
      dataOrdinal: 5,
      byteStart: 120,
      byteEndExclusive: 340,
    });
    expect(html).toContain(
      "JSON · registro 5 · referencia /4 · bytes 120 a 340 (fin exclusivo).",
    );
    expect(html).not.toContain("Hoja");
    expect(html).not.toContain("undefined");
  });
  it("conserva las referencias de líneas CSV y celdas XLSX", () => {
    expect(
      sourceEvidence({
        format: "CSV",
        byteStart: 20,
        byteEndExclusive: 100,
        lineStart: 2,
        lineEnd: 3,
        dataOrdinal: 1,
      }),
    ).toContain("CSV · líneas 2 a 3.");
    expect(
      sourceEvidence({
        format: "XLSX",
        part: "xl/worksheets/sheet1.xml",
        worksheet: "Hoja1",
        row: 2,
        date1904: false,
        cells: ["A2", "B2"],
      }),
    ).toContain("Hoja Hoja1 · fila 2 · celdas A2, B2.");
  });
});

describe("referencia visual municipal", () => {
  it.each([
    "vl-obras",
    "bahia-obras",
    "olavarria-obras",
    "pergamino-obras",
  ] as const)(
    "comparte nivel visual para %s sin atribuir símbolos de un municipio particular",
    (codigo) => {
      const html = renderToStaticMarkup(
        createElement(SourceBadge, { sources: [{ codigo }] }),
      );
      expect(html).toContain('data-source-origin="municipality"');
      expect(html).toContain("Datos de: Municipios");
      expect(html).not.toContain("Vicente López");
    },
  );
  it("explica el ocre compartido y conserva los créditos del mapa base", () => {
    const legend = renderToStaticMarkup(createElement(SourceLegend));
    expect(legend).toContain("Referencia de colores y formas");
    const project = renderToStaticMarkup(createElement(ProjectPage));
    expect(project).toContain(
      "no representan la bandera o el escudo de un municipio particular",
    );
    expect(project).not.toContain("Bandera de Vicente López");
    expect(project).toContain("OpenFreeMap");
    expect(project).toContain("OpenStreetMap");
  });
});
