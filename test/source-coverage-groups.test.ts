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
      "provincia-06",
      "provincia-02",
    ]);
    expect(groups[0]!.fuentes.map((source) => source.codigo)).toEqual([
      "nacion-obras",
    ]);
    expect(groups[1]!.fuentes.map((source) => source.codigo)).toEqual([
      "pba-edificios",
      "vl-obras",
      "bahia-obras",
      "olavarria-obras",
      "pergamino-obras",
    ]);
    expect(groups[2]!.fuentes.map((source) => source.codigo)).toEqual([
      "caba-actualizado",
    ]);
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
    ).toEqual([5, 1]);
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
      "provincia-06",
      "provincia-02",
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
    expect(html).toContain("5 fuentes");
    expect(html).toContain("no se suman para obtener obras únicas");
    for (const source of items)
      expect(html).toContain(
        `href="/mapa?fuente=${source.codigo}&amp;vista=lista"`,
      );
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
});
