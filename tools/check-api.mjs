/** @file CLI de auditoría acotada y de sólo lectura; informa passed/incomplete/failed sin volcar registros ni coordenadas. */
import { createPublicApi } from "../dist/src/api/client.js";
import { auditPublicApi } from "../dist/src/api/acceptance.js";

try {
  const origin = new URL(process.env.API_ORIGIN ?? "http://127.0.0.1:3000");
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new TypeError(
      "API_ORIGIN debe ser un origen HTTP(S) sin credenciales.",
    );

  const coordinates = (
    process.env.API_CHECK_BBOX ?? "-59,-35.2,-57.5,-34"
  ).split(",");
  if (coordinates.length !== 4 || coordinates.some((value) => !value.trim())) {
    throw new TypeError("API_CHECK_BBOX requiere cuatro coordenadas.");
  }
  const report = await auditPublicApi(
    createPublicApi({ baseUrl: `${origin.origin}/api/v1` }),
    {
      bbox: coordinates.map(Number),
      maxPages: Number(process.env.API_CHECK_MAX_PAGES ?? 3),
      pageSize: Number(process.env.API_CHECK_PAGE_SIZE ?? 20),
      maxDetails: Number(process.env.API_CHECK_MAX_DETAILS ?? 3),
      requestTimeoutMs: Number(process.env.API_CHECK_TIMEOUT_MS ?? 5000),
      totalTimeoutMs: Number(process.env.API_CHECK_TOTAL_TIMEOUT_MS ?? 30000),
    },
  );
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = { passed: 0, incomplete: 2, failed: 1 }[report.status];
} catch {
  console.log(
    JSON.stringify(
      {
        mode: "read-only",
        status: "failed",
        code: "INVALID_CHECK_CONFIGURATION",
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
