/** @file Comprueba validación de rutas BFF y errores públicos sin URLs internas ni parámetros ajenos. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import examples from "../contracts/examples.json" with { type: "json" };
import { PublicApiError } from "../src/api/client.js";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  geojson: vi.fn(),
  organizations: vi.fn(),
  provinces: vi.fn(),
  localities: vi.fn(),
}));
const seo = vi.hoisted(() => ({
  origin: new URL("https://obras.example.org") as URL | null,
}));
vi.mock("../src/lib/public-api", () => ({ publicApi: () => api }));
vi.mock("../src/lib/config", () => ({ indexableSiteUrl: () => seo.origin }));

import { GET } from "../src/app/api/public/[...path]/route";
import { GET as sitemap } from "../src/app/sitemap.xml/route";

const id = examples.detailPopulated.obraId;
const revision = examples.detailPopulated.revisionId;
const request = (path: string, query = "", init?: RequestInit) =>
  new Request(`https://obras.example.org/api/public/${path}${query}`, init);
const context = (...path: string[]) => ({ params: Promise.resolve({ path }) });
beforeEach(() => {
  vi.resetAllMocks();
  seo.origin = new URL("https://obras.example.org");
});

describe("BFF de lectura pública", () => {
  it("lee provincias por ruta pública sin filtros ni credenciales entrantes", async () => {
    const catalog = {
      version: "provincias@1",
      items: [{ codigo: "06", nombre: "Buenos Aires", tipo: "PROVINCIA" }],
    };
    api.provinces.mockResolvedValue(catalog);
    const input = request("territorios/provincias", "", {
      headers: {
        Cookie: "private-session=secret",
        Authorization: "Bearer secret",
      },
    });
    const response = await GET(input, context("territorios", "provincias"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(await response.json()).toEqual(catalog);
    expect(api.provinces).toHaveBeenCalledWith({ signal: input.signal });
    expect(
      (
        await GET(
          request("territorios/provincias", "?provinciaCodigo=06"),
          context("territorios", "provincias"),
        )
      ).status,
    ).toBe(400);
    expect(api.provinces).toHaveBeenCalledTimes(1);
  });
  it("reenvía sólo códigos provinciales en la consulta anónima de localidades", async () => {
    const catalog = {
      version: "georef-localidades@2.0-20261008",
      consultadoEn: "2026-10-08",
      fuentes: [
        {
          nombre: "GeoRef",
          url: "https://example.test/localidades",
          licencia: {
            nombre: "CC BY 4.0",
            url: "https://creativecommons.org/licenses/by/4.0/",
          },
        },
      ],
      items: [],
    };
    api.localities.mockResolvedValue(catalog);
    const input = request(
      "territorios/localidades",
      "?provinciaCodigo=06&provinciaCodigo=02",
      {
        headers: {
          Cookie: "private-session=secret",
          Authorization: "Bearer secret",
        },
      },
    );
    const response = await GET(input, context("territorios", "localidades"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual(catalog);
    expect(api.localities).toHaveBeenCalledExactlyOnceWith(["02", "06"], {
      signal: input.signal,
    });
    for (const query of ["limit=20", "provinciaCodigo=07"]) {
      const result = await GET(
        request("territorios/localidades", "?" + query),
        context("territorios", "localidades"),
      );
      expect(result.status).toBe(400);
    }
    expect(api.localities).toHaveBeenCalledTimes(1);
  });
  it("normaliza arrays OR igual para lista y mapa mientras conserva asociaciones escalares", async () => {
    const first = "aaaaaaaa-0000-4000-8000-000000000001";
    const second = "bbbbbbbb-0000-4000-8000-000000000001";
    const query = `?provinciaCodigo=06&provinciaCodigo=02&provinciaCodigo=06&partidos=${second.toUpperCase()}&partidos=${first}&partidos=${second}&partidoVerificadoId=${second}&gestionMunicipalId=${first}&cursor=synthetic-page`;
    const filters = {
      provinciaCodigo: ["02", "06"],
      partidos: [first, second],
      partidoVerificadoId: second,
      gestionMunicipalId: first,
      cursor: "synthetic-page",
    };
    api.list.mockResolvedValue(examples.listEmpty);
    api.geojson.mockResolvedValue(examples.geojsonEmpty);
    const list = request("obras", query);
    expect((await GET(list, context("obras"))).status).toBe(200);
    expect(api.list).toHaveBeenCalledWith(
      { ...filters, limit: 20 },
      { signal: list.signal },
    );
    const map = request("geojson", query + "&bbox=-59,-35,-58,-34");
    expect((await GET(map, context("geojson"))).status).toBe(200);
    expect(api.geojson).toHaveBeenCalledWith(
      { ...filters, limit: 100, bbox: [-59, -35, -58, -34] },
      { signal: map.signal },
    );
  });
  it("explica una respuesta provincial excesiva y oculta el diagnóstico interno", async () => {
    api.provinces.mockRejectedValue(
      new PublicApiError(413, {
        code: "RESPONSE_BUDGET",
        message: "private-diagnostic",
        requestId: null,
      }),
    );
    const response = await GET(
      request("territorios/provincias"),
      context("territorios", "provincias"),
    );
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: {
        code: "RESPONSE_BUDGET",
        message:
          "No se pudo cargar la referencia territorial dentro del límite de lectura.",
      },
    });
  });
  it("conserva llamadas BFF globales cuando no hay provincia explícita", async () => {
    api.list.mockResolvedValue(examples.listEmpty);
    const input = request("obras");
    expect((await GET(input, context("obras"))).status).toBe(200);
    expect(api.list).toHaveBeenCalledWith(
      { limit: 20 },
      { signal: input.signal },
    );
  });
  it("lee el catálogo institucional sin parámetros ni credenciales de visitante", async () => {
    api.organizations.mockResolvedValue({ items: [] });
    const input = request("organizaciones-institucionales", "", {
      headers: {
        Cookie: "private-session=secret",
        Authorization: "Bearer secret",
      },
    });
    const response = await GET(
      input,
      context("organizaciones-institucionales"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
    expect(api.organizations).toHaveBeenCalledWith({ signal: input.signal });
    const rejected = await GET(
      request("organizaciones-institucionales", "?organizacionId=unknown"),
      context("organizaciones-institucionales"),
    );
    expect(rejected.status).toBe(400);
    expect(api.organizations).toHaveBeenCalledTimes(1);
  });
  it("reenvía relaciones verificadas y vigencia del rol iguales a lista y GeoJSON", async () => {
    api.list.mockResolvedValue(examples.listEmpty);
    api.geojson.mockResolvedValue(examples.geojsonEmpty);
    const associationFilters = {
      partidoVerificadoId: "aaaaaaaa-0000-4000-8000-000000000001",
      gestionMunicipalId: "bbbbbbbb-0000-4000-8000-000000000001",
      organizacionId: "cccccccc-0000-4000-8000-000000000001",
      rolInstitucional: "FINANCIADOR",
      periodoDesde: "2020-01-01",
      periodoHasta: "2026-12-31",
    };
    const query = "?" + new URLSearchParams(associationFilters);
    const listInput = request("obras", query);
    expect((await GET(listInput, context("obras"))).status).toBe(200);
    expect(api.list).toHaveBeenCalledWith(
      { ...associationFilters, limit: 20 },
      { signal: listInput.signal },
    );
    const mapInput = request("geojson", query + "&bbox=-59,-35,-58,-34");
    expect((await GET(mapInput, context("geojson"))).status).toBe(200);
    expect(api.geojson).toHaveBeenCalledWith(
      { ...associationFilters, bbox: [-59, -35, -58, -34], limit: 100 },
      { signal: mapInput.signal },
    );
  });
  it("clasifica la caída de red como 503 sin exponer el diagnóstico interno", async () => {
    api.list.mockRejectedValue(
      new TypeError(
        "fetch failed: http://private.internal/api secret-private-diagnostic",
      ),
    );
    const response = await GET(request("obras"), context("obras"));
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(body.error.code).toBe("UNAVAILABLE");
    expect(JSON.stringify(body)).not.toMatch(
      /private\.internal|secret-private-diagnostic|INVALID_QUERY/,
    );
  });

  it.each([
    ["obras", "?admin=true"],
    ["obras", "?vista=mapa"],
    ["obras", "?limit=50000"],
    ["obras", "?fuente=constructor"],
    ["obras", "?estado=IN_PROGRESS&estado=COMPLETED"],
    ["geojson", ""],
    ["geojson", "?bbox=-59,-35,-58,-34&tieneGeometria=false"],
    ["obras", "?periodoDesde=2026-02-30"],
    ["obras", "?periodoDesde=2026-01-01"],
    ["obras", "?periodoHasta=2026-12-31"],
    ["obras", "?organizacionId=no-es-identidad"],
    ["obras", "?provinciaCodigo=07"],
    ["obras", "?provinciaCodigo="],
    ["obras", "?partidos=invalid"],
    [
      "obras",
      "?partidos=aaaaaaaa-0000-4000-8000-000000000001&partidoId=bbbbbbbb-0000-4000-8000-000000000001",
    ],
    [
      "obras",
      "?partidos=aaaaaaaa-0000-4000-8000-000000000001&municipioCodigo=001&territorioEsquema=pba.municipio",
    ],
    [
      "obras",
      "?" +
        Array(136)
          .fill("partidos=aaaaaaaa-0000-4000-8000-000000000001")
          .join("&"),
    ],
    ["obras", "?" + Array(25).fill("provinciaCodigo=06").join("&")],
    ["geojson", "?bbox=-59,-35,-58,-34&rolInstitucional=RESPONSABLE"],
  ])(
    "rechaza parámetros no admitidos antes de consultar %s%s",
    async (path, query) => {
      const response = await GET(request(path, query), context(path));
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("INVALID_QUERY");
      expect(api.list).not.toHaveBeenCalled();
      expect(api.detail).not.toHaveBeenCalled();
      expect(api.geojson).not.toHaveBeenCalled();
    },
  );

  it("reenvía solo filtros públicos normalizados, con su signal y límite fijo", async () => {
    api.list.mockResolvedValue(examples.listEmpty);
    const input = request(
      "obras",
      "?bbox=-59,-35,-58,-34&fuente=nacion-obras&estado=IN_PROGRESS&territorioEsquema=pba.municipio&municipioCodigo=001&cursor=abc",
      {
        headers: {
          Cookie: "private-session=secret",
          Authorization: "Bearer secret",
        },
      },
    );
    const response = await GET(input, context("obras"));
    expect(response.status).toBe(200);
    expect(api.list).toHaveBeenCalledWith(
      {
        limit: 20,
        bbox: [-59, -35, -58, -34],
        fuente: "nacion-obras",
        estado: "IN_PROGRESS",
        territorioEsquema: "pba.municipio",
        municipioCodigo: "001",
        cursor: "abc",
      },
      { signal: input.signal },
    );
    expect(await response.json()).toEqual(examples.listEmpty);
  });

  it("limita GeoJSON a 100 ubicaciones y conserva exactamente el área", async () => {
    api.geojson.mockResolvedValue(examples.geojsonEmpty);
    const input = request(
      "geojson",
      "?bbox=-58.45678,-35,-58,-34&sector=educacion",
    );
    const response = await GET(input, context("geojson"));
    expect(response.status).toBe(200);
    expect(api.geojson).toHaveBeenCalledWith(
      { limit: 100, bbox: [-58.45678, -35, -58, -34], sector: "educacion" },
      { signal: input.signal },
    );
  });

  it("consulta la revisión elegida sin propagar cookies ni autorización entrantes", async () => {
    api.detail.mockResolvedValue(examples.detailPopulated);
    const input = request(`obras/${id}`, `?revisionId=${revision}`, {
      headers: {
        Cookie: "private-session=secret",
        Authorization: "Bearer secret",
      },
    });
    const response = await GET(input, context("obras", id));
    expect(response.status).toBe(200);
    expect(api.detail).toHaveBeenCalledWith(id, revision, {
      signal: input.signal,
    });
    expect((await response.json()).revisionId).toBe(revision);
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });

  it("rechaza parámetros extra y revisiones repetidas en una ficha", async () => {
    for (const query of [
      `?revisionId=${revision}&secret=x`,
      `?revisionId=${revision}&revisionId=${revision}`,
    ]) {
      const response = await GET(
        request(`obras/${id}`, query),
        context("obras", id),
      );
      expect(response.status).toBe(400);
    }
    expect(api.detail).not.toHaveBeenCalled();
  });

  it("preserva el 409 de catálogo sin filtrar detalles de diagnóstico", async () => {
    api.list.mockRejectedValue(
      new PublicApiError(409, {
        code: "CATALOG_CHANGED",
        message: "private-diagnostic",
        details: { internal: "private-diagnostic" },
        requestId: "private-diagnostic",
      }),
    );
    const response = await GET(
      request("obras", "?cursor=abc"),
      context("obras"),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "CATALOG_CHANGED",
        message: "El catálogo cambió. Reiniciá la consulta.",
      },
    });
  });

  it("no convierte rutas administrativas en solicitudes al backend", async () => {
    const response = await GET(
      request("admin/accesos"),
      context("admin", "accesos"),
    );
    expect(response.status).toBe(404);
    expect(api.list).not.toHaveBeenCalled();
    expect(api.detail).not.toHaveBeenCalled();
    expect(api.geojson).not.toHaveBeenCalled();
  });
});

describe("sitemap acotado y consistente", () => {
  it("no anuncia sitemap ni consulta el catálogo cuando producción no está habilitada", async () => {
    seo.origin = null;
    const response = await sitemap();
    expect(response.status).toBe(404);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(api.list).not.toHaveBeenCalled();
  });

  it("incluye fichas canónicas solo al terminar todas las páginas", async () => {
    api.list
      .mockResolvedValueOnce({ ...examples.listPopulated, nextCursor: "next" })
      .mockResolvedValueOnce({
        ...examples.listEmpty,
        catalogoVersion: examples.listPopulated.catalogoVersion,
      });
    const response = await sitemap();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/xml");
    const xml = await response.text();
    expect(xml).toContain(`<loc>https://obras.example.org/obras/${id}</loc>`);
    expect(xml).toContain("<loc>https://obras.example.org/terminos</loc>");
    expect(xml).not.toContain("revisionId");
    const signal = api.list.mock.calls[0]![1].signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(api.list).toHaveBeenNthCalledWith(
      2,
      { limit: 200, cursor: "next" },
      { signal },
    );
  });

  it("devuelve 503 si cambia el catálogo, sin entregar un XML parcial", async () => {
    api.list
      .mockResolvedValueOnce({ ...examples.listPopulated, nextCursor: "next" })
      .mockResolvedValueOnce({ ...examples.listEmpty, catalogoVersion: "8" });
    const response = await sitemap();
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("300");
    expect(await response.text()).not.toContain(id);
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it("detiene un cursor repetido y anuncia indisponibilidad temporal", async () => {
    api.list.mockResolvedValue({
      ...examples.listPopulated,
      nextCursor: "repeated",
    });
    const response = await sitemap();
    expect(response.status).toBe(503);
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it("acota a diez páginas y no publica un catálogo truncado", async () => {
    let page = 0;
    api.list.mockImplementation(async () => ({
      ...examples.listPopulated,
      nextCursor: `next-${++page}`,
    }));
    const response = await sitemap();
    expect(response.status).toBe(503);
    expect(api.list).toHaveBeenCalledTimes(10);
  });
});
