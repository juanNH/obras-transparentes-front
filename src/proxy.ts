/** @file Precheck acotado de fichas HTML: confirma ausencias con el contrato de error sin leer dos veces el contenido de una ficha válida. */
import { NextRequest, NextResponse } from "next/server";
import { parsePublicResponse } from "./api/contract";
import { parseWorkRoute, type WorkRoute } from "./lib/work-route";

/** Limita la comprobación previa a la URL de una ficha; no interviene en API, mapa ni assets. */
export const config = { matcher: "/obras/:id" };

/** Máximo de 16 KiB para confirmar el sobre de error de un 404; el resto sigue al render habitual. */
const MAX_MISSING_ERROR_BYTES = 16 * 1024;

/** Selecciona GET de documento y omite RSC, precargas y solicitudes de formatos distintos de HTML. */
function isDocumentRequest(request: NextRequest): boolean {
  const accept = request.headers.get("accept");
  const destination = request.headers.get("sec-fetch-dest");
  const purpose = `${request.headers.get("purpose") ?? ""} ${request.headers.get("sec-purpose") ?? ""}`;
  return request.method === "GET" && request.headers.get("rsc") !== "1" && !request.headers.has("next-router-prefetch") && !request.headers.has("x-middleware-prefetch") && !/prefetch/i.test(purpose) && (!destination || destination === "document") && (!accept || accept.includes("text/html") || accept.includes("*/*"));
}

/** Reescribe internamente a la 404 estática sin cambiar el enlace ni trasladar parámetros. */
function missingDocument(request: NextRequest): NextResponse {
  return NextResponse.rewrite(new URL("/404", request.url), { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

/**
 * Construye una única lectura anónima del detalle desde la base configurada, sin usar Host u otros headers entrantes.
 * @throws Si PUBLIC_API_URL no es HTTP(S), tiene credenciales, parámetros o fragmento.
 */
function detailUrl({ id, revisionId }: WorkRoute): URL {
  const base = new URL(process.env.PUBLIC_API_URL ?? "http://127.0.0.1:3000/api/v1");
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new TypeError("URL pública de API inválida.");
  const url = new URL(`${base.href.replace(/\/$/, "")}/obras/${id}`);
  if (revisionId !== undefined) url.searchParams.set("revisionId", revisionId);
  return url;
}

/**
 * Confirma un 404 sólo con el sobre público válido, hasta 16 KiB y dentro de la señal del precheck.
 * Una respuesta vacía, HTML, JSON inválido o esquema incorrecto conserva el error recuperable del cliente vigente.
 * @returns Si el 404 es compatible con PublicApiError; nunca propaga diagnósticos upstream.
 */
async function confirmsMissing(response: Response, signal: AbortSignal): Promise<boolean> {
  const reader = response.body?.getReader();
  if (!reader) return false;
  /** Cierra una lectura pendiente cuando se cancela el documento o vence el timeout total. */
  const onAbort = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", onAbort, { once: true });
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    if (signal.aborted) return false;
    while (true) {
      const { done, value } = await reader.read();
      if (signal.aborted) return false;
      if (done) break;
      size += value.byteLength;
      if (size > MAX_MISSING_ERROR_BYTES) return false;
      text += decoder.decode(value, { stream: true });
    }
    parsePublicResponse("PublicApiError", JSON.parse(text + decoder.decode()));
    return true;
  } catch { return false; }
  finally {
    signal.removeEventListener("abort", onAbort);
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/**
 * Comprueba HTTP en hasta 2 segundos: valida sólo sobres 404 acotados y cancela sin leer los demás bodies.
 * Un enlace inválido o un 404 compatible con el contrato recibe recuperación estática; otras respuestas/errores conservan el render vigente.
 * @returns Rewrite 404 sin API para identidad inválida, o continuación normal ante datos/errores no concluyentes.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (!isDocumentRequest(request)) return NextResponse.next();
  const match = /^\/obras\/([^/]+)\/?$/.exec(request.nextUrl.pathname);
  if (!match) return NextResponse.next();
  let id: string;
  try { id = decodeURIComponent(match[1]!); } catch { return missingDocument(request); }
  const revisions = request.nextUrl.searchParams.getAll("revisionId");
  const selection = parseWorkRoute(id, revisions.length > 1 ? revisions : revisions[0]);
  if (!selection) return missingDocument(request);
  try {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(2000)]);
    const response = await fetch(detailUrl(selection), {
      method: "GET",
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal,
    });
    if (response.status === 404) {
      if (await confirmsMissing(response, signal)) return missingDocument(request);
    } else if (response.body) await response.body.cancel().catch(() => undefined);
  } catch { /* El render habitual mantiene la recuperación de servicio y la validación completa. */ }
  return NextResponse.next();
}
