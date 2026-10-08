/** @file Comprueba URLs compartibles, filtros incompatibles y conservación de consulta entre presentaciones. */
import { describe, expect, it } from "vitest";
import {
  explorerHref,
  isCivilDate,
  parseExplorerQuery,
  queryParams,
  searchParamsOf,
  unlocatedListHref,
} from "../src/lib/explorer-query";

const parse = (query: string) => parseExplorerQuery(new URLSearchParams(query));
describe("consultas públicas compartibles", () => {
  it.each(["bahia-obras", "olavarria-obras", "pergamino-obras"] as const)(
    "conserva fuente %s y acceso a publicaciones sin ubicación",
    (fuente) => {
      const initial = parse(`fuente=${fuente}&vista=lista`);
      expect(initial.query).toEqual({ limit: 20, fuente });
      const withoutPoint = unlocatedListHref({
        ...initial.query,
        bbox: [-60, -36, -59, -35],
        cursor: "synthetic-page",
      });
      expect(parse(withoutPoint.split("?")[1]!)).toEqual({
        query: { limit: 20, fuente, tieneGeometria: false },
        view: "lista",
      });
      expect(queryParams(initial.query).get("fuente")).toBe(fuente);
    },
  );
  it("combina reporte, asociación espacial y gestión institucional sin sustituir identidades", () => {
    const reported = "aaaaaaaa-0000-4000-8000-000000000001";
    const verified = "bbbbbbbb-0000-4000-8000-000000000001";
    const municipal = "cccccccc-0000-4000-8000-000000000001";
    const organization = "dddddddd-0000-4000-8000-000000000001";
    const state = parse(
      `partidoId=${reported}&partidoVerificadoId=${verified.toUpperCase()}&gestionMunicipalId=${municipal}&organizacionId=${organization}&rolInstitucional=FINANCIADOR&periodoDesde=2020-02-29&periodoHasta=2026-12-31&vista=lista`,
    );
    expect(state.query).toEqual({
      limit: 20,
      partidoId: reported,
      partidoVerificadoId: verified,
      gestionMunicipalId: municipal,
      organizacionId: organization,
      rolInstitucional: "FINANCIADOR",
      periodoDesde: "2020-02-29",
      periodoHasta: "2026-12-31",
    });
    expect(
      parse(explorerHref(state.query, "mapa").split("?")[1]!).query,
    ).toEqual(state.query);
    const unlocated = parse(
      unlocatedListHref({
        ...state.query,
        cursor: "synthetic-page",
        bbox: [-59, -35, -58, -34],
      }).split("?")[1]!,
    );
    expect(unlocated.query).toEqual({ ...state.query, tieneGeometria: false });
    expect(unlocated.view).toBe("lista");
  });
  it("conserva el filtro territorial histórico combinado con asociaciones explícitas", () => {
    const result = parse(
      "territorioEsquema=pba.municipio&municipioCodigo=001&partidoVerificadoId=bbbbbbbb-0000-4000-8000-000000000001",
    );
    expect(result.query.municipioCodigo).toBe("001");
    expect(result.query.partidoVerificadoId).toBe(
      "bbbbbbbb-0000-4000-8000-000000000001",
    );
  });
  it.each([
    "partidoVerificadoId=no-es-uuid",
    "gestionMunicipalId=constructor",
    "organizacionId=secret",
    "rolInstitucional=RESPONSABLE",
    "rolInstitucional=constructor",
    "periodoDesde=2025-02-29",
    "periodoHasta=2026-04-31",
    "periodoDesde=2026-01-02&periodoHasta=2026-01-01",
    "periodoDesde=2026",
    "periodoHasta=2026-10-06T12%3A00%3A00Z",
    "periodoDesde=2026-01-01",
    "periodoHasta=2026-12-31",
    "partidoVerificadoId=aaaaaaaa-0000-4000-8000-000000000001&partidoVerificadoId=bbbbbbbb-0000-4000-8000-000000000001",
  ])("rechaza asociaciones o períodos ambiguos: %s", (input) => {
    expect(() => parse(input)).toThrow(TypeError);
  });
  it("valida días reales sin cambiar su zona horaria", () => {
    expect(isCivilDate("2000-02-29")).toBe(true);
    expect(isCivilDate("2026-10-06")).toBe(true);
    expect(isCivilDate("0001-01-01")).toBe(true);
    for (const input of [
      "0000-01-01",
      "1900-02-29",
      "2026-13-01",
      "2026-01-00",
      "2026-2-01",
      "2026-01-01T00:00:00Z",
    ])
      expect(isCivilDate(input)).toBe(false);
  });
  it("abre publicaciones sin ubicación quitando área y cursor, conservando fuente y municipio", () => {
    const query = {
      fuente: "nacion-obras",
      bbox: [-58.5, -34.6, -58.2, -34.4],
      cursor: "pagina-anterior",
      territorioEsquema: "pba.municipio",
      municipioCodigo: "0861",
      tieneGeometria: true,
    } as const;
    const href = unlocatedListHref(query);
    expect(href).toBe(
      "/mapa?fuente=nacion-obras&territorioEsquema=pba.municipio&municipioCodigo=0861&tieneGeometria=false&vista=lista",
    );
    expect(parse(href.split("?")[1]!)).toEqual({
      query: {
        limit: 20,
        fuente: "nacion-obras",
        territorioEsquema: "pba.municipio",
        municipioCodigo: "0861",
        tieneGeometria: false,
      },
      view: "lista",
    });
    expect(query.bbox).toEqual([-58.5, -34.6, -58.2, -34.4]);
    expect(query.cursor).toBe("pagina-anterior");
  });
  it("abre todo el catálogo sin jurisdicción ni bbox y conserva el alcance global del enlace", () => {
    const initial = parse("");
    expect(initial).toEqual({ query: { limit: 20 }, view: "mapa" });
    expect(explorerHref(initial.query)).toBe("/mapa");
  });
  it("incluye CABA como jurisdicción explícita y combina sus códigos sin provincia oculta", () => {
    expect(parse("provinciaCodigo=02").query).toEqual({
      limit: 20,
      provinciaCodigo: ["02"],
    });
    const state = parse(
      "provinciaCodigo=06&provinciaCodigo=02&provinciaCodigo=02",
    );
    expect(state.query.provinciaCodigo).toEqual(["02", "06"]);
    expect(parse(explorerHref(state.query).split("?")[1]!).query).toEqual(
      state.query,
    );
  });
  it("conserva códigos provinciales de dos dígitos fuera del recorte piloto", () => {
    expect(parse("provinciaCodigo=14&provinciaCodigo=94").query).toEqual({
      limit: 20,
      provinciaCodigo: ["14", "94"],
    });
  });
  it("conserva filtros por códigos oficiales GeoRef de localidad y rechaza códigos desconocidos", () => {
    const state = parse(
      "provinciaCodigo=06&localidadCodigo=06427010&localidadCodigo=06427010&localidadCodigo=06427020",
    );
    expect(state.query).toEqual({
      limit: 20,
      provinciaCodigo: ["06"],
      localidadCodigo: ["06427010", "06427020"],
    });
    expect(parse(explorerHref(state.query).split("?")[1]!).query).toEqual(
      state.query,
    );
    expect(() => parse("provinciaCodigo=06&localidadCodigo=0642701")).toThrow(
      TypeError,
    );
    expect(() => parse("provinciaCodigo=07")).toThrow(TypeError);
    expect(() =>
      parse(
        "localidadCodigo=" +
          Array(101).fill("06427010").join("&localidadCodigo="),
      ),
    ).toThrow(TypeError);
  });
  it("normaliza conjuntos repetidos antes del roundtrip y conserva la selección por revisión", () => {
    const first = "aaaaaaaa-0000-4000-8000-000000000001";
    const second = "bbbbbbbb-0000-4000-8000-000000000001";
    const params = searchParamsOf({
      provinciaCodigo: ["06", "06"],
      partidos: [second.toUpperCase(), first, second],
      partidoVerificadoId: second,
      gestionMunicipalId: first,
      bbox: "-59,-35,-58,-34",
      cursor: "synthetic-page",
      vista: "lista",
      obra: first,
      revisionId: second,
    });
    const state = parseExplorerQuery(params);
    expect(state.query.partidos).toEqual([first, second]);
    expect(state.query.provinciaCodigo).toEqual(["06"]);
    expect(state.obra).toBe(first);
    expect(state.revisionId).toBe(second);
    const shared = queryParams(state.query);
    expect(shared.getAll("partidos")).toEqual([first, second]);
    expect(shared.getAll("provinciaCodigo")).toEqual(["06"]);
    expect(shared.getAll("bbox")).toEqual(["-59,-35,-58,-34"]);
    expect(parseExplorerQuery(shared).query).toEqual(state.query);
    expect(
      parse(explorerHref(state.query, "mapa").split("?")[1]!).query,
    ).toEqual(state.query);
    expect(parse(unlocatedListHref(state.query).split("?")[1]!).query).toEqual({
      ...state.query,
      bbox: undefined,
      cursor: undefined,
      tieneGeometria: false,
    });
  });
  it("cuenta valores crudos antes de deduplicar partidos y provincias", () => {
    const party = "aaaaaaaa-0000-4000-8000-000000000001";
    expect(
      parseExplorerQuery(
        searchParamsOf({
          partidos: Array(135).fill(party),
          provinciaCodigo: Array(24).fill("06"),
        }),
      ).query,
    ).toEqual({ limit: 20, provinciaCodigo: ["06"], partidos: [party] });
    expect(() =>
      parseExplorerQuery(searchParamsOf({ partidos: Array(136).fill(party) })),
    ).toThrow(TypeError);
    expect(() =>
      parseExplorerQuery(
        searchParamsOf({ provinciaCodigo: Array(25).fill("06") }),
      ),
    ).toThrow(TypeError);
  });
  it.each([
    "partidos=invalid",
    "partidos=",
    "partidos=aaaaaaaa-0000-4000-8000-000000000001,bbbbbbbb-0000-4000-8000-000000000001",
    "partidos=aaaaaaaa-0000-4000-8000-000000000001&partidoId=bbbbbbbb-0000-4000-8000-000000000001",
    "partidos=aaaaaaaa-0000-4000-8000-000000000001&partidoId=",
    "partidos=aaaaaaaa-0000-4000-8000-000000000001&territorioEsquema=pba.municipio&municipioCodigo=001",
    "partidos=aaaaaaaa-0000-4000-8000-000000000001&municipioCodigo=001",
    "provinciaCodigo=",
    "provinciaCodigo=6",
    "provinciaCodigo=006",
    "provinciaCodigo=06,06",
  ])("rechaza conjuntos territoriales inválidos o mezclados: %s", (input) => {
    expect(() => parse(input)).toThrow(TypeError);
  });
  it("cambiar la presentación conserva la consulta y los faltantes", () => {
    expect(
      parse("vista=mapa&tieneGeometria=false&cursor=fixture-offset-20").query,
    ).toEqual(
      parse("vista=lista&tieneGeometria=false&cursor=fixture-offset-20").query,
    );
    expect(parse("vista=mapa").query.bbox).toBeUndefined();
    expect(explorerHref({ limit: 20 }, "lista")).toBe("/mapa?vista=lista");
  });
  it("conserva códigos territoriales y separa estado UI del contrato", () => {
    const parsed = parse(
      "territorioEsquema=pba.municipio&municipioCodigo=001&vista=lista&estado=IN_PROGRESS",
    );
    expect(parsed.query.municipioCodigo).toBe("001");
    expect(queryParams(parsed.query).has("vista")).toBe(false);
    expect(explorerHref(parsed.query)).toContain("municipioCodigo=001");
  });
  it.each([
    "fuente=constructor",
    "estado=toString",
    "fuente=pba-edificios&fuente=nacion-obras",
    "bbox=0,0,0,2",
    "bbox=,0,1,2",
    "bbox=-181,0,1,2",
    "bbox=0,0,1,2&tieneGeometria=false",
    "municipioCodigo=001",
    "revisionId=abc",
    "cursor=" + "x".repeat(4097),
  ])("rechaza una consulta ambigua o incompatible: %s", (input) => {
    expect(() => parse(input)).toThrow(TypeError);
  });
  it("normaliza identidad sin perder precisión del área", () => {
    const parsed = parse(
      "obra=AAAAAAAA-0000-4000-8000-000000000001&bbox=-58.45678,-35,-58,-34",
    );
    expect(parsed.obra).toBe("aaaaaaaa-0000-4000-8000-000000000001");
    expect(parsed.query.bbox?.[0]).toBe(-58.45678);
  });
  it("conserva una ubicación de la revisión seleccionada fuera de los filtros de API", () => {
    const state = parse(
      "obra=AAAAAAAA-0000-4000-8000-000000000001&revisionId=BBBBBBBB-0000-4000-8000-000000000001&ubicacionId=CCCCCCCC-0000-4000-8000-000000000001",
    );
    expect(state.ubicacionId).toBe("cccccccc-0000-4000-8000-000000000001");
    expect(queryParams(state.query).has("ubicacionId")).toBe(false);
  });
  it.each([
    "ubicacionId=cccccccc-0000-4000-8000-000000000001",
    "obra=aaaaaaaa-0000-4000-8000-000000000001&ubicacionId=cccccccc-0000-4000-8000-000000000001",
    "obra=aaaaaaaa-0000-4000-8000-000000000001&revisionId=bbbbbbbb-0000-4000-8000-000000000001&ubicacionId=otro",
  ])(
    "rechaza una ubicación sin identidad de revisión completa: %s",
    (value) => {
      expect(() => parse(value)).toThrow(TypeError);
    },
  );
});
