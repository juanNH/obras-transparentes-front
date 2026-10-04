import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import examples from "../contracts/examples.json" with { type: "json" };
import type { WorkDetail } from "../src/api/client.js";
import { parsePublicResponse } from "../src/api/contract.js";
import { WorkDetailContent } from "../src/components/work-detail.js";
import { civilDate, formatExactDecimal, publicationDate, reportedDate, safeSourceUrl, stateLabel } from "../src/lib/presentation.js";

describe("Presentación pública sin inferencias", () => {
  it("conserva importes mayores que el entero seguro y todos sus decimales", () => {
    expect(formatExactDecimal("90071992547409931234.567890123456789")).toBe("90.071.992.547.409.931.234,567890123456789");
    expect(formatExactDecimal("-0000.00")).toBe("-0,00");
    expect(formatExactDecimal("0")).toBe("0");
    expect(formatExactDecimal(null)).toBe("No informado");
    expect(formatExactDecimal(undefined)).toBe("No informado");
  });
  it("no convierte desconocidos en estado ni altera fechas civiles", () => {
    expect(stateLabel(null)).toBe("Estado no informado");
    expect(civilDate("2026-01-01")).toBe("01/01/2026");
    expect(reportedDate({ campo: "inicio", anio: "2026", precision: "YEAR", naturaleza: null })).toBe("2026 (solo se conoce el año)");
    expect(publicationDate("2026-01-01T00:05:00.000Z")).toContain("1 de enero de 2026");
    expect(publicationDate("2026-01-01T00:05:00.000Z")).toContain("UTC");
  });
  it("solo enlaza fuentes HTTP(S) sin credenciales", () => {
    expect(safeSourceUrl("https://datos.example.org/catalogo?q=obra")).toBe("https://datos.example.org/catalogo?q=obra");
    for (const value of ["javascript:alert(1)", "data:text/html,hola", "file:///C:/datos", "https://user:secret@example.org", "/relative", "mailto:example@example.org"]) expect(safeSourceUrl(value)).toBeNull();
  });
  it("entrega la ficha textual desde el servidor, conservando faltantes y ubicaciones no mapeables", () => {
    const work = parsePublicResponse<WorkDetail>("PublicWorkDetail", examples.detailPartial);
    const html = renderToStaticMarkup(createElement(WorkDetailContent, { work }));
    expect(html).toContain(work.nombre);
    expect(html).toContain("Estado no informado");
    expect(html).toContain("Fecha no informada");
    expect(html).toContain("Sin geometría aprobada para mostrar en el mapa");
    expect(html).toContain("revisión histórica");
    expect(html).not.toContain('"coordinates"');
  });
  it("omite enlaces inseguros de origen sin omitir la fuente y muestra cero como dato", () => {
    const work = structuredClone(parsePublicResponse<WorkDetail>("PublicWorkDetail", examples.detailPopulated));
    work.fuentes[0]!.urlCatalogo = "javascript:alert(1)";
    work.avanceFisico = "0";
    const html = renderToStaticMarkup(createElement(WorkDetailContent, { work, compact: true }));
    expect(html).not.toContain("javascript:");
    expect(html).toContain("Obras de Nación (enlace no disponible)");
    expect(html).toContain("0 %");
    expect(html).toContain("<h2>");
    expect(html).not.toContain("<h1>");
  });
});
