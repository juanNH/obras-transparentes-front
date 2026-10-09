/** @file Verifica inventario público, alcance de fuentes, particiones y solapamientos sin duplicar obras ni consultar la API activa. */
import { describe, expect, it, vi } from "vitest";
import examples from "../contracts/examples.json" with { type: "json" };
import { createPublicApi, type SourceCoverageCode } from "../src/api/client";
import { ApiContractError } from "../src/api/contract";

describe("inventario público de todas las fuentes", () => {
  it("conserva unidades, obras compartidas, localizaciones y evidencia de licencia del corte exacto", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(examples.sourceCoverage));
    const signal = new AbortController().signal;
    const result = await createPublicApi({ fetch: request }).sourceCoverage(
      undefined,
      { signal },
    );
    expect(result).toEqual(examples.sourceCoverage);
    expect(result.obrasPublicadasUnicas).toBe(2);
    expect(result.fuentes).toHaveLength(7);
    expect(
      result.fuentes.reduce((sum, source) => sum + source.obrasPublicadas, 0),
    ).toBe(3);
    expect(result.fuentes[1]!.recursos[1]!.unidadDocumental).toBe(
      "SPATIAL_LOCATION_RECORD",
    );
    expect(request).toHaveBeenCalledExactlyOnceWith(
      "/api/v1/obras/cobertura-fuentes",
      expect.objectContaining({
        credentials: "omit",
        redirect: "error",
        signal,
      }),
    );
  });

  it("serializa fuentes repetidas como conjunto y exige exactamente el conjunto solicitado", async () => {
    const nation = examples.sourceCoverage.fuentes[1]!;
    const single = {
      ...examples.sourceCoverage,
      obrasPublicadasUnicas: nation.obrasPublicadas,
      obrasCompartidasEntreFuentes: 0,
      totalVinculosAdicionales: 0,
      fuentes: [nation],
    };
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(single));
    await expect(
      createPublicApi({ fetch: request }).sourceCoverage([
        "nacion-obras",
        "nacion-obras",
      ]),
    ).resolves.toEqual(single);
    expect(request.mock.calls[0]![0]).toBe(
      "/api/v1/obras/cobertura-fuentes?fuente=nacion-obras",
    );
    request.mockResolvedValueOnce(Response.json(single));
    await expect(
      createPublicApi({ fetch: request }).sourceCoverage(),
    ).rejects.toBeInstanceOf(ApiContractError);
    for (const codes of [
      [],
      ["unknown-obras"],
      Array.from({ length: 8 }, () => "nacion-obras"),
    ])
      await expect(
        createPublicApi({ fetch: request }).sourceCoverage(
          codes as SourceCoverageCode[],
        ),
      ).rejects.toBeInstanceOf(TypeError);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("rechaza particiones inválidas y duplicados aunque el transporte cumpla JSON Schema", async () => {
    const bodies = [
      { ...examples.sourceCoverage, totalVinculosAdicionales: 0 },
      { ...examples.sourceCoverage, obrasPublicadasUnicas: 8 },
      {
        ...examples.sourceCoverage,
        obrasPublicadasUnicas: 1,
        obrasCompartidasEntreFuentes: 1,
        fuentes: [examples.sourceCoverage.fuentes[1]],
      },
      { ...examples.sourceCoverage, obrasCompartidasEntreFuentes: 3 },
      {
        ...examples.sourceCoverage,
        fuentes: [
          examples.sourceCoverage.fuentes[0],
          examples.sourceCoverage.fuentes[0],
        ],
      },
      ...[
        "obrasConUbicacionAprobada",
        "obrasSinEvidenciaLicenciaPublicada",
        "ubicacionesAprobadas",
      ].map((field) => ({
        ...examples.sourceCoverage,
        fuentes: examples.sourceCoverage.fuentes.map((source, index) =>
          index === 1
            ? { ...source, [field]: field === "ubicacionesAprobadas" ? 0 : 99 }
            : source,
        ),
      })),
      {
        ...examples.sourceCoverage,
        fuentes: examples.sourceCoverage.fuentes.map((source, index) =>
          index === 1
            ? { ...source, recursos: [source.recursos[0], source.recursos[0]] }
            : source,
        ),
      },
      {
        ...examples.sourceCoverage,
        fuentes: examples.sourceCoverage.fuentes.map((source, index) =>
          index === 1 ? { ...source, recursos: [source.recursos[1]] } : source,
        ),
      },
    ];
    for (const body of bodies) {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json(body));
      await expect(
        createPublicApi({ fetch: request }).sourceCoverage(),
      ).rejects.toBeInstanceOf(ApiContractError);
    }
  });

  it("cuenta una obra compartida por tres fuentes como una obra y dos vínculos adicionales", async () => {
    const body = {
      ...examples.sourceCoverage,
      obrasPublicadasUnicas: 1,
      obrasCompartidasEntreFuentes: 1,
      totalVinculosAdicionales: 2,
      fuentes: examples.sourceCoverage.fuentes.map((source, index) => ({
        ...source,
        obrasPublicadas: index < 3 ? 1 : 0,
        obrasConUbicacionAprobada: 0,
        obrasSinUbicacionAprobada: index < 3 ? 1 : 0,
        localidadesConObrasPublicadas: 0,
        ubicacionesAprobadas: 0,
        obrasConEvidenciaLicenciaPublicada: 0,
        obrasSinEvidenciaLicenciaPublicada: index < 3 ? 1 : 0,
      })),
    };
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(body));
    await expect(
      createPublicApi({ fetch: request }).sourceCoverage(),
    ).resolves.toEqual(body);
    request.mockResolvedValueOnce(
      Response.json({ ...body, totalVinculosAdicionales: 1 }),
    );
    await expect(
      createPublicApi({ fetch: request }).sourceCoverage(),
    ).rejects.toBeInstanceOf(ApiContractError);
  });

  it("rechaza ámbitos nacionales con provincia y municipios cuyo código no corresponde a su provincia", async () => {
    const nation = examples.sourceCoverage.fuentes.find(
      (source) => source.codigo === "nacion-obras",
    )!;
    const municipality = examples.sourceCoverage.fuentes.find(
      (source) => source.codigo === "vl-obras",
    )!;
    for (const [codigo, alcanceTerritorial] of [
      [
        nation.codigo,
        {
          nivel: "NACIONAL",
          provincia: { codigo: "06", nombre: "EJEMPLO SINTÉTICO" },
          municipio: null,
        },
      ],
      [
        municipality.codigo,
        {
          nivel: "MUNICIPAL",
          provincia: { codigo: "02", nombre: "EJEMPLO SINTÉTICO" },
          municipio: {
            esquema: "indec.departamento",
            codigo: "06861",
            nombre: "EJEMPLO SINTÉTICO",
          },
        },
      ],
    ]) {
      const body = {
        ...examples.sourceCoverage,
        fuentes: examples.sourceCoverage.fuentes.map((source) =>
          source.codigo === codigo ? { ...source, alcanceTerritorial } : source,
        ),
      };
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json(body));
      await expect(
        createPublicApi({ fetch: request }).sourceCoverage(),
      ).rejects.toBeInstanceOf(ApiContractError);
    }
  });

  it("rechaza unidades invertidas, principal provincial de obra y cardinalidades ajenas al perfil", async () => {
    const bodies = [
      {
        ...examples.sourceCoverage,
        fuentes: examples.sourceCoverage.fuentes.map((source, index) =>
          index === 1
            ? {
                ...source,
                recursos: [
                  {
                    rol: "principal",
                    unidadDocumental: "SPATIAL_LOCATION_RECORD",
                  },
                  { rol: "geometrias", unidadDocumental: "WORK_RECORD" },
                ],
              }
            : source,
        ),
      },
      {
        ...examples.sourceCoverage,
        fuentes: examples.sourceCoverage.fuentes.map((source, index) =>
          index === 0
            ? {
                ...source,
                recursos: [
                  { rol: "principal", unidadDocumental: "WORK_RECORD" },
                ],
              }
            : source,
        ),
      },
      {
        ...examples.sourceCoverage,
        fuentes: examples.sourceCoverage.fuentes.map((source, index) =>
          index === 1 ? { ...source, recursos: [source.recursos[0]] } : source,
        ),
      },
      {
        ...examples.sourceCoverage,
        fuentes: examples.sourceCoverage.fuentes.map((source, index) =>
          index === 0
            ? {
                ...source,
                recursos: [
                  ...source.recursos,
                  {
                    rol: "geometrias",
                    unidadDocumental: "SPATIAL_LOCATION_RECORD",
                  },
                ],
              }
            : source,
        ),
      },
    ];
    for (const body of bodies) {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json(body));
      await expect(
        createPublicApi({ fetch: request }).sourceCoverage(),
      ).rejects.toBeInstanceOf(ApiContractError);
    }
  });
});
