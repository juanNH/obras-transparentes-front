import { describe, expect, it } from "vitest";
import { explorerHref, parseExplorerQuery, queryParams } from "../src/lib/explorer-query";

const parse = (query: string) => parseExplorerQuery(new URLSearchParams(query));
describe("consultas públicas compartibles", () => {
  it("abre mapa y resultados sin aplicar un límite espacial al catálogo", () => {
    expect(parse("")).toEqual({ query: { limit: 20 }, view: "mapa" });
  });
  it("cambiar la presentación conserva la consulta y los faltantes", () => {
    expect(parse("vista=mapa&tieneGeometria=false&cursor=fixture-offset-20").query).toEqual(parse("vista=lista&tieneGeometria=false&cursor=fixture-offset-20").query);
    expect(parse("vista=mapa").query.bbox).toBeUndefined();
    expect(explorerHref({ limit: 20 }, "lista")).toBe("/mapa?vista=lista");
  });
  it("conserva códigos territoriales y separa estado UI del contrato", () => {
    const parsed = parse("territorioEsquema=pba.municipio&municipioCodigo=001&vista=lista&estado=IN_PROGRESS");
    expect(parsed.query.municipioCodigo).toBe("001");
    expect(queryParams(parsed.query).has("vista")).toBe(false);
    expect(explorerHref(parsed.query)).toContain("municipioCodigo=001");
  });
  it.each(["fuente=constructor", "estado=toString", "fuente=pba-edificios&fuente=nacion-obras", "bbox=0,0,0,2", "bbox=,0,1,2", "bbox=-181,0,1,2", "bbox=0,0,1,2&tieneGeometria=false", "municipioCodigo=001", "revisionId=abc", "cursor=" + "x".repeat(4097)])("rechaza una consulta ambigua o incompatible: %s", input => {
    expect(() => parse(input)).toThrow(TypeError);
  });
  it("normaliza identidad sin perder precisión del área", () => {
    const parsed = parse("obra=AAAAAAAA-0000-4000-8000-000000000001&bbox=-58.45678,-35,-58,-34");
    expect(parsed.obra).toBe("aaaaaaaa-0000-4000-8000-000000000001");
    expect(parsed.query.bbox?.[0]).toBe(-58.45678);
  });
  it("conserva una ubicación de la revisión seleccionada fuera de los filtros de API", () => {
    const state = parse("obra=AAAAAAAA-0000-4000-8000-000000000001&revisionId=BBBBBBBB-0000-4000-8000-000000000001&ubicacionId=CCCCCCCC-0000-4000-8000-000000000001");
    expect(state.ubicacionId).toBe("cccccccc-0000-4000-8000-000000000001");
    expect(queryParams(state.query).has("ubicacionId")).toBe(false);
  });
  it.each(["ubicacionId=cccccccc-0000-4000-8000-000000000001", "obra=aaaaaaaa-0000-4000-8000-000000000001&ubicacionId=cccccccc-0000-4000-8000-000000000001", "obra=aaaaaaaa-0000-4000-8000-000000000001&revisionId=bbbbbbbb-0000-4000-8000-000000000001&ubicacionId=otro"])("rechaza una ubicación sin identidad de revisión completa: %s", value => {
    expect(() => parse(value)).toThrow(TypeError);
  });
});
