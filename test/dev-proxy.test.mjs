/** @file Comprueba aislamiento de rutas, credenciales, redirecciones y cancelación del proxy de diagnóstico. */
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, request } from "node:http";
import test from "node:test";
import { createPublicProxy } from "../tools/dev-proxy.mjs";

async function listen(t, server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  );
  return `http://127.0.0.1:${server.address().port}`;
}

function raw(origin, path, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = request(origin, { path, method }, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () =>
        resolve({ status: res.statusCode, headers: res.headers, body }),
      );
    });
    req.on("error", reject);
    req.end();
  });
}

test("forwards public reads and conditional caching without credentials or cookies", async (t) => {
  const received = [];
  const apiOrigin = await listen(
    t,
    createServer((req, res) => {
      received.push({ url: req.url, method: req.method, headers: req.headers });
      res.writeHead(req.headers["if-none-match"] ? 304 : 200, {
        "content-type": "application/json",
        "cache-control": "public, max-age=60",
        etag: '"public-v1"',
        "set-cookie": "private=secret",
        "x-private": "secret",
        "x-request-id": "invalid-upstream-id",
      });
      res.end('{"items":[]}');
    }),
  );
  const origin = await listen(t, createPublicProxy({ apiOrigin }));
  const paths = [
    "/api/v1/obras?limit=20",
    "/api/v1/obras/geojson?bbox=1,2,3,4",
    "/api/v1/obras/123e4567-e89b-12d3-a456-426614174000",
    "/api/v1/territorios/provincias",
    "/api/v1/obras/cobertura-municipal",
    "/api/v1/obras/cobertura-fuentes",
    "/api/v1/obras?provinciaCodigo=06&partidos=aaaaaaaa-0000-4000-8000-000000000001&partidos=bbbbbbbb-0000-4000-8000-000000000001",
  ];
  for (const path of paths) {
    const response = await fetch(origin + path, {
      headers: {
        accept: "application/json",
        authorization: "Bearer secret",
        cookie: "session=secret",
        origin: "https://private.example",
        "x-forwarded-for": "1.2.3.4",
        "x-request-id": "untrusted",
      },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { items: [] });
    assert.equal(response.headers.get("etag"), '"public-v1"');
    assert.equal(response.headers.get("cache-control"), "public, max-age=60");
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(response.headers.get("x-private"), null);
    assert.match(response.headers.get("x-request-id"), /^[0-9a-f-]{36}$/);
    assert.equal(received.at(-1).url, path);
    for (const name of ["authorization", "cookie", "origin", "x-forwarded-for"])
      assert.equal(received.at(-1).headers[name], undefined);
    assert.equal(received.at(-1).headers.accept, "application/json");
    assert.equal(
      received.at(-1).headers["x-request-id"],
      response.headers.get("x-request-id"),
    );
  }
  const cached = await fetch(origin + paths[0], {
    headers: { "if-none-match": '"public-v1"' },
  });
  assert.equal(cached.status, 304);
  assert.equal(await cached.text(), "");
  assert.equal(received.at(-1).headers["if-none-match"], '"public-v1"');
  const head = await fetch(origin + paths[0], { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.equal(received.at(-1).method, "HEAD");
});

test("rejects private routes, writes, malformed targets and oversized queries before upstream", async (t) => {
  let calls = 0;
  const apiOrigin = await listen(
    t,
    createServer((_req, res) => {
      calls++;
      res.end();
    }),
  );
  const origin = await listen(t, createPublicProxy({ apiOrigin }));
  for (const path of [
    "/api/v1/admin",
    "/api/v1/auth",
    "/docs-json",
    "/api/v1/obras/not-a-uuid",
    "/api/v1/obras/../admin",
    "/api/v1/obras/%2e%2e/admin",
    "/api/v1/obras/",
    "/api/v1/territorios/provincias/",
    "/api/v1/territorios/provincias/admin",
  ]) {
    const response = await raw(origin, path);
    assert.equal(response.status, 404, path);
    assert.equal(JSON.parse(response.body).error.code, "NOT_FOUND");
  }
  for (const method of ["POST", "PUT", "DELETE", "OPTIONS"])
    assert.equal((await raw(origin, "/api/v1/obras", method)).status, 405);
  for (const path of [
    "/api/v1/obras?x=%ZZ",
    "//external.example/api/v1/obras",
    "http://external.example/api/v1/obras",
    "/api/v1/obras#admin",
  ]) {
    assert.equal((await raw(origin, path)).status, 400, path);
  }
  assert.equal(
    (await raw(origin, "/api/v1/obras?" + "x".repeat(8193))).status,
    414,
  );
  const root = await fetch(origin);
  assert.deepEqual((await root.json()).links, {
    obras: "/api/v1/obras",
    geojson: "/api/v1/obras/geojson",
  });
  assert.equal(calls, 0);
});

test("does not follow or expose upstream redirects, but preserves ordinary error statuses", async (t) => {
  let calls = 0;
  const requestId = "123e4567-e89b-12d3-a456-426614174000";
  const apiOrigin = await listen(
    t,
    createServer((req, res) => {
      calls++;
      res.writeHead(req.url.endsWith("geojson") ? 503 : 302, {
        location: "/admin",
        "content-type": "application/json",
        "x-request-id": requestId,
      });
      res.end(
        JSON.stringify({
          error: { code: "UNAVAILABLE", message: "Unavailable", requestId },
        }),
      );
    }),
  );
  const origin = await listen(t, createPublicProxy({ apiOrigin }));
  const redirect = await fetch(origin + "/api/v1/obras");
  assert.equal(redirect.status, 502);
  assert.equal(redirect.headers.get("location"), null);
  assert.deepEqual(await redirect.json(), {
    error: {
      code: "UPSTREAM_REDIRECT",
      message: "Upstream redirects are not allowed",
      requestId,
    },
  });
  const unavailable = await fetch(origin + "/api/v1/obras/geojson");
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), {
    error: { code: "UNAVAILABLE", message: "Unavailable", requestId },
  });
  assert.equal(unavailable.headers.get("x-request-id"), requestId);
  assert.equal(calls, 2);
});

test("bounds upstream waits and cancels upstream when the client disconnects", async (t) => {
  let upstreamStarted;
  let upstreamClosed;
  const started = new Promise((resolve) => {
    upstreamStarted = resolve;
  });
  const closed = new Promise((resolve) => {
    upstreamClosed = resolve;
  });
  const apiOrigin = await listen(
    t,
    createServer((req, res) => {
      if (req.url.endsWith("geojson")) {
        res.once("close", upstreamClosed);
        upstreamStarted();
      }
    }),
  );
  const timeoutOrigin = await listen(
    t,
    createPublicProxy({ apiOrigin, timeoutMs: 30 }),
  );
  const timeout = await fetch(timeoutOrigin + "/api/v1/obras");
  assert.equal(timeout.status, 504);
  assert.deepEqual(await timeout.json(), {
    error: {
      code: "UPSTREAM_TIMEOUT",
      message: "Upstream timeout",
      requestId: timeout.headers.get("x-request-id"),
    },
  });
  const origin = await listen(
    t,
    createPublicProxy({ apiOrigin, timeoutMs: 5_000 }),
  );
  const abort = new AbortController();
  const pending = fetch(origin + "/api/v1/obras/geojson", {
    signal: abort.signal,
  });
  await started;
  abort.abort();
  await assert.rejects(pending, { name: "AbortError" });
  await Promise.race([
    closed,
    new Promise((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Upstream was not cancelled")),
        1_000,
      );
      timer.unref();
    }),
  ]);
});

test("rejects ambiguous upstream configuration", () => {
  for (const apiOrigin of [
    "file:///tmp/api",
    "https://user:pass@example.com",
    "https://example.com/api",
    "https://example.com/?secret=1",
  ]) {
    assert.throws(() => createPublicProxy({ apiOrigin }), TypeError);
  }
  assert.throws(() => createPublicProxy({ timeoutMs: 0 }), TypeError);
});
