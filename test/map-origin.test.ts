import { describe, expect, it } from "vitest";
import { mapOriginCategory } from "../src/lib/map-origin.js";

describe("procedencia institucional para el mapa", () => {
  it.each([
    ["nacion-obras", "nation"],
    ["caba-actualizado", "caba"],
    ["pba-edificios", "province"],
    ["vl-obras", "municipality"],
  ] as const)("clasifica %s por el catálogo de origen", (codigo, expected) => {
    expect(mapOriginCategory([{ codigo }])).toBe(expected);
  });

  it("deja explícitas las obras con fuentes de más de un nivel", () => {
    expect(mapOriginCategory([{ codigo: "nacion-obras" }, { codigo: "caba-actualizado" }])).toBe("mixed");
  });

  it("distingue una fuente no informada", () => {
    expect(mapOriginCategory([])).toBe("unknown");
  });
});
