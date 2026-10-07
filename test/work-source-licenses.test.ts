/** @file Comprueba atribución congelada, faltantes históricos y enlaces seguros con licencias sintéticas, sin consultas ni publicaciones. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import examples from "../contracts/examples.json" with { type: "json" };
import type { WorkDetail } from "../src/api/client";
import { WorkSourceLicenses } from "../src/components/work-source-licenses";
import { WorkDetailContent } from "../src/components/work-detail";

/** Copia un ejemplo sintético y agrega una licencia ODbL conservada al publicar esa revisión. */
function licensedWork(): WorkDetail {
  const work = structuredClone(examples.detailPartial) as WorkDetail;
  work.fuentes[0]!.codigo = "olavarria-obras";
  work.licenciasFuentes = [{
    fuenteId: "70000000-0000-4000-8000-000000000001", codigo: "olavarria-obras", version: 2,
    codigoLicencia: "ODbL-1.0", urlLicencia: "https://opendatacommons.org/licenses/odbl/1-0/",
    atribucion: "Atribución sintética exacta — base municipal.\nSegunda línea conservada.",
    evidenciaUrl: "https://example.invalid/evidencia-licencia", capturadaEn: "2026-10-06T12:00:00Z",
    alcance: "DATABASE", recursoVersionIds: [work.fuentes[0]!.recursoId],
    distribucionBase: { licencia: "ODbL-1.0", url: "https://opendatacommons.org/licenses/odbl/1-0/", aviso: "Aviso de distribución sintético y explícito." },
    contenidosIndividuales: "EXCLUDED", licenciaContenidos: null,
  }];
  return work;
}

describe("publicación y evidencia de licencia", () => {
  it("no inventa derechos para una revisión histórica sin evidencia de licencia", () => {
    const work = structuredClone(examples.detailPartial) as WorkDetail;
    delete work.licenciasFuentes;
    for (const licenses of [undefined, []]) {
      if (licenses === undefined) delete work.licenciasFuentes;
      else work.licenciasFuentes = licenses;
      const html = renderToStaticMarkup(createElement(WorkSourceLicenses, { work }));
      expect(html).toContain("No hay evidencia de licencia registrada en la publicación de esta revisión.");
      expect(html).not.toContain("CC-BY");
      expect(html).not.toContain("ODbL");
    }
  });
  it("preserva atribución, aviso ODbL, alcance y captura sin presentarla como actualización de la obra", () => {
    const work = licensedWork();
    const html = renderToStaticMarkup(createElement(WorkSourceLicenses, { work }));
    expect(html).toContain(work.licenciasFuentes![0]!.atribucion);
    expect(html).toContain(work.licenciasFuentes![0]!.distribucionBase!.aviso);
    expect(html).toContain("Municipalidad de Olavarría");
    expect(html).toContain("Base de datos");
    expect(html).toContain('dateTime="2026-10-06T12:00:00Z"');
    expect(html).toContain("UTC");
    expect(html).toContain("no indica cuándo se actualizó");
    expect(html).toContain("no están incluidos en la licencia de datos registrada");
    expect(html).not.toContain("<img");
  });
  it("rechaza enlaces inseguros y escapa atribuciones de texto sin ejecutar HTML de fuente", () => {
    const work = licensedWork();
    const license = work.licenciasFuentes![0]!;
    license.urlLicencia = "javascript:alert('fixture')";
    license.evidenciaUrl = "https://user:secret@example.invalid/evidencia";
    license.distribucionBase!.url = "data:text/html,fixture";
    license.atribucion = "Atribución <script>fixture</script>";
    const html = renderToStaticMarkup(createElement(WorkSourceLicenses, { work }));
    expect(html).toContain("&lt;script&gt;fixture&lt;/script&gt;");
    expect(html.match(/enlace no disponible/g)).toHaveLength(3);
    expect(html).not.toContain("href=");
    expect(html).not.toContain("user:secret");
    expect(html).not.toContain("<script>");
  });
  it("muestra la licencia individual explícita y adapta jerarquía del resumen sin cambiar geometría o roles", () => {
    const work = licensedWork();
    work.licenciasFuentes![0]!.contenidosIndividuales = "LICENSED";
    work.licenciasFuentes![0]!.licenciaContenidos = { codigo: "CC-BY-4.0", url: "https://creativecommons.org/licenses/by/4.0/" };
    const before = structuredClone(work);
    const html = renderToStaticMarkup(createElement(WorkDetailContent, { work, compact: true }));
    expect(html).toContain("<h3>Licencias y atribución</h3>");
    expect(html).toContain("<h4>Municipalidad de Olavarría</h4>");
    expect(html).toContain('href="https://creativecommons.org/licenses/by/4.0/"');
    expect(html).toContain("Revisión sin ubicación en el mapa");
    expect(work).toEqual(before);
  });
});
