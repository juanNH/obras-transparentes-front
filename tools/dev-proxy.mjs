/** @file Proxy de diagnóstico limitado a GET/HEAD públicos, sin credenciales entrantes y con origen fijo. */
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const publicPath =
  /^\/api\/v1\/(?:obras(?:\/geojson|\/cobertura-municipal|\/cobertura-fuentes|\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})?|territorios\/provincias)$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const responseHeaders = [
  "content-type",
  "cache-control",
  "etag",
  "last-modified",
];

/** Envía JSON sin caché respetando HEAD, que debe mantener cabeceras sin body. */
function json(res, status, body, head = false) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(head ? undefined : JSON.stringify(body));
}

/** Construye el sobre público de error del proxy con su requestId de diagnóstico. */
function fail(res, status, code, message, requestId, head = false) {
  return json(res, status, { error: { code, message, requestId } }, head);
}

/** Development gateway only. Its CLI listens on loopback, never on a public interface. */
export function createPublicProxy({
  apiOrigin = "http://127.0.0.1:3000",
  timeoutMs = 10_000,
} = {}) {
  const origin = new URL(apiOrigin);
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new TypeError(
      "apiOrigin must be an HTTP(S) origin without credentials, path, query, or fragment",
    );
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)
    throw new TypeError("timeoutMs must be a positive integer");

  return createServer(async (req, res) => {
    let requestId = randomUUID();
    res.setHeader("x-request-id", requestId);
    const head = req.method === "HEAD";
    if (req.method !== "GET" && !head) {
      res.setHeader("allow", "GET, HEAD");
      return fail(
        res,
        405,
        "METHOD_NOT_ALLOWED",
        "Method not allowed",
        requestId,
      );
    }

    const target = req.url ?? "";
    const queryStart = target.indexOf("?");
    if (queryStart !== -1 && target.length - queryStart - 1 > 8192) {
      return fail(
        res,
        414,
        "URI_TOO_LONG",
        "Query is too long",
        requestId,
        head,
      );
    }
    try {
      if (
        !target.startsWith("/") ||
        target.startsWith("//") ||
        /[\\#\s]/.test(target)
      )
        throw new Error();
      decodeURIComponent(target);
    } catch {
      return fail(
        res,
        400,
        "INVALID_REQUEST",
        "Malformed request URL",
        requestId,
        head,
      );
    }
    // Validate the raw path before URL parsing can normalize dot segments.
    const pathname = queryStart === -1 ? target : target.slice(0, queryStart);
    if (pathname === "/") {
      return json(
        res,
        200,
        {
          stage: 1,
          description:
            "Development gateway for the public ObrasTransparentes API. No frontend UI yet.",
          links: { obras: "/api/v1/obras", geojson: "/api/v1/obras/geojson" },
        },
        head,
      );
    }
    if (!publicPath.test(pathname))
      return fail(
        res,
        404,
        "NOT_FOUND",
        "Public route not found",
        requestId,
        head,
      );

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    /** Cancela upstream si el consumidor cierra la respuesta antes de completarla. */
    const disconnect = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.once("close", disconnect);
    try {
      const headers = { "x-request-id": requestId };
      for (const name of ["accept", "if-none-match"]) {
        if (typeof req.headers[name] === "string")
          headers[name] = req.headers[name];
      }
      const upstream = await fetch(new URL(target, origin), {
        method: req.method,
        headers,
        redirect: "manual",
        signal: controller.signal,
      });
      const upstreamRequestId = upstream.headers.get("x-request-id");
      if (upstreamRequestId && uuid.test(upstreamRequestId)) {
        requestId = upstreamRequestId;
        res.setHeader("x-request-id", requestId);
      }
      if (
        upstream.status >= 300 &&
        upstream.status < 400 &&
        upstream.status !== 304
      ) {
        await upstream.body?.cancel();
        return fail(
          res,
          502,
          "UPSTREAM_REDIRECT",
          "Upstream redirects are not allowed",
          requestId,
          head,
        );
      }
      res.statusCode = upstream.status;
      for (const name of responseHeaders) {
        const value = upstream.headers.get(name);
        if (value !== null) res.setHeader(name, value);
      }
      if (head || !upstream.body) res.end();
      else
        await pipeline(Readable.fromWeb(upstream.body), res, {
          signal: controller.signal,
        });
    } catch {
      if (!res.destroyed && !res.headersSent) {
        fail(
          res,
          timedOut ? 504 : 502,
          timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE",
          timedOut ? "Upstream timeout" : "Upstream unavailable",
          requestId,
          head,
        );
      } else if (!res.destroyed) res.destroy();
    } finally {
      clearTimeout(timer);
      res.off("close", disconnect);
    }
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const server = createPublicProxy({
    apiOrigin: process.env.API_ORIGIN,
    timeoutMs: Number(process.env.API_TIMEOUT_MS ?? 10_000),
  });
  server.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  server.listen(3001, "127.0.0.1", () =>
    console.log("Public development gateway: http://127.0.0.1:3001"),
  );
}
