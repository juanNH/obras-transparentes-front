/** @file Descarga anónima y sin caché de una proyección pública vigente; vuelve a comprobar retiros y nunca entrega el original. */
import { PublicApiError } from "../../../../api/client";
import { isUUID } from "../../../../lib/explorer-query";
import { publicApi } from "../../../../lib/public-api";
import { reportedRecordCsv, reportedRecordExport } from "../../../../lib/reported-record-export";

/** Impide que una descarga servida antes de un retiro se reutilice desde la caché del servidor. */
export const dynamic = "force-dynamic";

/** Acepta sólo formato=json|csv, relee el registro público y conserva los rechazos seguros sin trasladar cookies ni autorización. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const query = new URL(request.url).searchParams;
  const format = query.get("formato");
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (!isUUID(id) || !["json", "csv"].includes(format ?? "") || [...query.keys()].some(key => key !== "formato") || query.getAll("formato").length !== 1)
    return Response.json({ error: "La descarga requiere un registro y un formato válidos." }, { status: 400, headers });
  try {
    const detail = await publicApi().reportedRecord(id, { signal: request.signal });
    if (detail.estado !== "PUBLISHED" || !detail.registro) return Response.json({ error: "El registro fue retirado. Su contenido anterior no está disponible." }, { status: 410, headers });
    const content = format === "json" ? JSON.stringify(reportedRecordExport(detail), null, 2) + "\n" : reportedRecordCsv(detail);
    return new Response(content, { headers: {
      ...headers,
      "Content-Type": format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="registro-${id}.${format}"`,
    } });
  } catch (error) {
    const notFound = error instanceof PublicApiError && error.status === 404;
    return Response.json({ error: notFound ? "Registro no encontrado." : "La descarga no está disponible. Volvé a intentar." }, { status: notFound ? 404 : 503, headers });
  }
}
