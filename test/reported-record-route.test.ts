/** @file Prueba el BFF de registros con API mockeada: filtros cerrados, ausencia de credenciales y errores sin diagnósticos internos. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublicApiError } from "../src/api/client";
import { reportedRecordFixtures } from "../tools/reported-record-fixtures.mjs";

const api = vi.hoisted(() => ({ reportedRecords: vi.fn(), reportedRecordCounts: vi.fn(), reportedRecord: vi.fn() }));
vi.mock("../src/lib/public-api", () => ({ publicApi: () => api }));
import { GET } from "../src/app/api/public/[...path]/route";

/** Ejecuta el handler de mismo origen sin iniciar servidor, sesión ni API real. */
function request(path: string, query = "") {
  return GET(new Request("https://front.example.invalid/api/public/" + path + query, { headers: { Cookie: "private-cookie", Authorization: "Bearer private-token" } }), { params: Promise.resolve({ path: path.split("/") }) });
}

beforeEach(() => {
  vi.resetAllMocks();
  api.reportedRecords.mockResolvedValue({ items: [reportedRecordFixtures[0]], nextCursor: null, limit: 25, catalogoVersion: "13" });
  api.reportedRecord.mockResolvedValue(reportedRecordFixtures[0]);
  api.reportedRecordCounts.mockResolvedValue({ catalogoVersion: "13", totalRegistros: 0, porFuente: [], porTipo: [], partidosConRegistros: 0, localidadesConRegistros: 0 });
});

describe("BFF cerrado de registros informados", () => {
  it("admite las tres lecturas exactas sin trasladar cookies, autorización ni cabeceras del visitante", async () => {
    expect((await request("registros-informados", "?fuente=bahia-obras&limit=1")).status).toBe(200);
    expect(api.reportedRecords).toHaveBeenCalledWith({ fuente: "bahia-obras", limit: 1 }, { signal: expect.any(AbortSignal) });
    expect((await request("registros-informados/conteos", "?tipo=WORK_RECORD")).status).toBe(200);
    expect(api.reportedRecordCounts).toHaveBeenCalledWith({ tipo: "WORK_RECORD" }, { signal: expect.any(AbortSignal) });
    expect((await request("registros-informados/88000000-0000-4000-8000-000000000001")).status).toBe(200);
    expect(api.reportedRecord).toHaveBeenCalledWith("88000000-0000-4000-8000-000000000001", { signal: expect.any(AbortSignal) });
  });

  it("rechaza rutas administrativas, filtros privados, repetidos, paginación en conteos y argumentos de ficha", async () => {
    for (const [path, query] of [
      ["registros-informados", "?organizacionId=secret"],
      ["registros-informados", "?fuente=a&fuente=b"],
      ["registros-informados/conteos", "?limit=25"],
      ["registros-informados/88000000-0000-4000-8000-000000000001", "?version=1"],
    ]) expect((await request(path!, query)).status).toBe(400);
    expect((await request("admin/registros-informados")).status).toBe(404);
    expect(api.reportedRecords).not.toHaveBeenCalled();
    expect(api.reportedRecordCounts).not.toHaveBeenCalled();
    expect(api.reportedRecord).not.toHaveBeenCalled();
  });

  it("oculta diagnósticos privados y conserva recuperación del cursor obsoleto", async () => {
    api.reportedRecords.mockRejectedValueOnce(new Error("http://private-host/raw-notes"));
    const unavailable = await request("registros-informados");
    expect(unavailable.status).toBe(503);
    expect(await unavailable.text()).not.toContain("private-host");
    api.reportedRecords.mockRejectedValueOnce(new PublicApiError(409, { code: "CATALOG_CHANGED", message: "private-diagnostic", requestId: null }));
    const changed = await request("registros-informados", "?cursor=opaque");
    expect(changed.status).toBe(409);
    expect(await changed.text()).toContain("Reiniciá la consulta");
    expect(changed.headers.get("cache-control")).toBe("no-store");
  });
});
