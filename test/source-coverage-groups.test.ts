/** @file Comprueba agrupación declarada, búsqueda territorial y retiro de cifras con ejemplos sintéticos, sin API activa. */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import examples from "../contracts/examples.json" with { type: "json" };
import type { SourceCoverage } from "../src/api/client";
import { SourceCoveragePanel } from "../src/components/source-coverage";
import {
  buildSourceCoverage,
  filterSourceCoverageGroups,
  groupSourceCoverage,
} from "../src/lib/source-coverage";
import type { PublicSourceCoverage } from "../src/lib/source-coverage";
import { reportedRecordsHref } from "../src/api/reported-records";

/** Construye el inventario sintético con tipos del contrato regenerado y la misma versión del listado. */
function sources(): PublicSourceCoverage[] {
  const inventory = examples.sourceCoverage as SourceCoverage;
  return buildSourceCoverage(inventory.catalogoVersion, {
    status: "fulfilled",
    value: inventory,
  });
}

describe("cobertura por provincia y fuente", () => {
  it("contiene Vicente López y las fuentes municipales en Buenos Aires y separa Nación y CABA", () => {
    const groups = groupSourceCoverage(sources());
    expect(groups.map((group) => group.id)).toEqual([
      "nacional",
      "multiprovincial",
      "provincia-06",
      "provincia-02",
      "provincia-50",
      "provincia-58",
    ]);
    expect(groups[0]!.fuentes.map((source) => source.codigo)).toEqual([
      "nacion-obras",
    ]);
    expect(
      groups
        .find((group) => group.id === "provincia-06")!
        .fuentes.map((source) => source.codigo),
    ).toEqual([
      "pba-edificios",
      "vl-obras",
      "bahia-obras",
      "olavarria-obras",
      "pergamino-obras",
      "mercedes-obras",
      "lujan-documentos",
      "general-pueyrredon-registros",
      "tandil-documentos",
      "general-rodriguez-documentos",
      "coronel-suarez-documentos",
    ]);
    expect(
      groups
        .find((group) => group.id === "provincia-02")!
        .fuentes.map((source) => source.codigo),
    ).toEqual(["caba-actualizado"]);
  });

  it("usa alcance declarado aunque el nombre sugiera otra provincia y no asigna fuentes sin alcance", () => {
    const known = sources()[0]!;
    const group = groupSourceCoverage([
      {
        ...known,
        nombre: "EJEMPLO SINTÉTICO — obra de Córdoba",
        alcanceTerritorial: null,
      },
    ]);
    expect(group).toHaveLength(1);
    expect(group[0]!.id).toBe("unknown");
    expect(group[0]!.nombre).toBe("Alcance por confirmar");
    expect(
      groupSourceCoverage([
        { ...known, nombre: "EJEMPLO SINTÉTICO — Córdoba" },
      ])[0]!.id,
    ).toBe("provincia-06");
  });

  it("busca provincias, municipios y fuentes sin tildes y conserva las identidades", () => {
    const groups = groupSourceCoverage(sources());
    expect(
      filterSourceCoverageGroups(groups, " buenos aires ").map(
        (group) => group.fuentes.length,
      ),
    ).toEqual([1, 11, 1]);
    expect(
      filterSourceCoverageGroups(groups, "vicente lopez")[0]!.fuentes.map(
        (source) => source.codigo,
      ),
    ).toEqual(["vl-obras"]);
    expect(filterSourceCoverageGroups(groups, "nacion")[0]!.id).toBe(
      "nacional",
    );
    expect(filterSourceCoverageGroups(groups, "Fuente inexistente")).toEqual(
      [],
    );
    expect(filterSourceCoverageGroups(groups, "")).toEqual(groups);
  });

  it("retira todas las cifras e inventarios de otro corte pero conserva el alcance explícito y enlaces", () => {
    const inventory = examples.sourceCoverage as SourceCoverage;
    const items = buildSourceCoverage("987654321", {
      status: "fulfilled",
      value: inventory,
    });
    expect(
      items.every(
        (source) =>
          source.estado === "UNKNOWN" &&
          source.obrasPublicadas === null &&
          source.inventario === undefined,
      ),
    ).toBe(true);
    expect(groupSourceCoverage(items).map((group) => group.id)).toEqual([
      "nacional",
      "multiprovincial",
      "provincia-06",
      "provincia-02",
      "provincia-50",
      "provincia-58",
    ]);
    const html = renderToStaticMarkup(
      SourceCoveragePanel({ coverage: items, catalogoVersion: "987654321" }),
    );
    expect(html).not.toContain("<dd>");
    expect(html).toContain("no se informa como cero");
    expect(html).toContain('href="/mapa?fuente=vl-obras&amp;vista=lista"');
  });

  it("conserva error de lectura y alcance por confirmar sin convertirlo en cero ni exponer errores internos", () => {
    const items = buildSourceCoverage("7", {
      status: "rejected",
      reason: new Error("private-secret"),
    });
    expect(
      items.every(
        (source) =>
          source.estado === "ERROR" && source.alcanceTerritorial === null,
      ),
    ).toBe(true);
    const html = renderToStaticMarkup(
      SourceCoveragePanel({ coverage: items, catalogoVersion: "7" }),
    );
    expect(html).toContain("Alcance por confirmar");
    expect(html).toContain(
      "El error no significa que tenga cero publicaciones",
    );
    expect(html).not.toContain("private-secret");
    expect(html).not.toContain("<dd>");
  });

  it("entrega HTML plegable con todos los enlaces, separa fuentes de obras y retira cifras al cambiar catálogo", () => {
    const items = sources();
    const html = renderToStaticMarkup(
      SourceCoveragePanel({
        coverage: items,
        catalogoVersion: examples.sourceCoverage.catalogoVersion,
      }),
    );
    expect(html).toContain('class="source-coverage-overview"');
    expect(html).toContain("Buscar provincia, municipio o fuente");
    expect(html).toContain(`${items.length} fuentes`);
    expect(html).toContain("no se suman para obtener obras únicas");
    for (const source of items) {
      const href =
        source.codigo === "lujan-documentos" ||
        source.codigo === "coronel-suarez-documentos"
          ? reportedRecordsHref({
              fuente: source.codigo,
              tipo: "DOCUMENT_REPORT_SECTION",
            })
          : source.codigo === "mendoza-obras" ||
              source.codigo === "general-rodriguez-documentos" ||
              source.codigo === "tandil-documentos"
            ? reportedRecordsHref({
                fuente: source.codigo,
                tipo: "PROCUREMENT_ACT_RECORD",
              })
            : source.codigo === "general-pueyrredon-registros"
              ? reportedRecordsHref({ fuente: source.codigo })
              : `/mapa?fuente=${source.codigo}&vista=lista`;
      expect(html).toContain(`href="${href.replaceAll("&", "&amp;")}"`);
    }
    const stale = renderToStaticMarkup(
      SourceCoveragePanel({
        coverage: items,
        catalogoVersion: null,
        stale: true,
      }),
    );
    expect(stale).not.toContain("<dd>");
    expect(stale).toContain("El catálogo cambió durante la consulta");
  });

  it("ofrece Luján en el inventario como fuente documental enlazada a registros con conteo de obras separado", () => {
    const item = sources().find(
      (source) => source.codigo === "lujan-documentos",
    );
    expect(item).toBeDefined();
    expect(item!.inventario!.recursos[0]!.unidadDocumental).toBe(
      "DOCUMENT_REPORT_SECTION",
    );
    expect(item!.obrasPublicadas).toBe(0);
    const html = renderToStaticMarkup(
      SourceCoveragePanel({
        coverage: [item!],
        catalogoVersion: examples.sourceCoverage.catalogoVersion,
      }),
    );
    expect(html).toContain("Fuente de informes documentales");
    expect(html).toContain("Obras consolidadas publicadas");
    expect(html).toContain("no cuenta secciones documentales");
    expect(html).toContain(
      'href="/registros?fuente=lujan-documentos&amp;tipo=DOCUMENT_REPORT_SECTION&amp;limit=25"',
    );
    expect(html).not.toContain("Fuente sin publicaciones");
    expect(html).not.toContain("/mapa?fuente=lujan-documentos");
  });

  it("muestra ACUMAR una sola vez con sus provincias y Neuquén bajo su provincia, sin multiplicar cifras", () => {
    const items = sources();
    const groups = groupSourceCoverage(items);
    const acumar = groups.find((group) => group.id === "multiprovincial")!;
    expect(acumar.nombre).toBe("Fuentes de varias provincias");
    expect(acumar.fuentes.map((source) => source.codigo)).toEqual([
      "acumar-obras",
    ]);
    expect(
      groups
        .find((group) => group.id === "provincia-58")!
        .fuentes.map((source) => source.codigo),
    ).toEqual(["neuquen-obras"]);
    const grouped = groups.flatMap((group) => group.fuentes);
    expect(grouped).toHaveLength(items.length);
    expect(new Set(grouped.map((source) => source.codigo)).size).toBe(
      items.length,
    );
    expect(
      filterSourceCoverageGroups(groups, "buenos aires").some((group) =>
        group.fuentes.some((source) => source.codigo === "acumar-obras"),
      ),
    ).toBe(true);
    const html = renderToStaticMarkup(
      SourceCoveragePanel({
        coverage: items,
        catalogoVersion: examples.sourceCoverage.catalogoVersion,
      }),
    );
    expect(html).toContain("Fuente de varias provincias");
    expect(html.match(/data-source="acumar-obras"/g)).toHaveLength(1);
    expect(html).toContain('href="/mapa?fuente=neuquen-obras&amp;vista=lista"');
  });

  it("agrupa Ciudad de Mendoza bajo Mendoza con alcance municipal y distingue sus actos de contratación", () => {
    const items = sources();
    const group = groupSourceCoverage(items).find(
      (entry) => entry.id === "provincia-50",
    )!;
    expect(group.nombre).toBe("Mendoza");
    expect(group.fuentes.map((entry) => entry.codigo)).toEqual([
      "mendoza-obras",
    ]);
    expect(group.fuentes[0]!.alcanceTerritorial?.nivel).toBe("MUNICIPAL");
    expect(
      filterSourceCoverageGroups([group], "ciudad de mendoza"),
    ).toHaveLength(1);
    const html = renderToStaticMarkup(
      SourceCoveragePanel({
        coverage: items,
        catalogoVersion: examples.sourceCoverage.catalogoVersion,
      }),
    );
    expect(html).toContain(
      "actos de contratación; sus filas no acreditan obras únicas",
    );
    expect(html).toContain(
      'href="/registros?fuente=mendoza-obras&amp;tipo=PROCUREMENT_ACT_RECORD&amp;limit=25"',
    );
  });
});
