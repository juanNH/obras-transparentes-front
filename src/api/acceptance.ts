/** @file Auditoría pública de lectura con límites de páginas, fichas y tiempo; un pase describe únicamente la muestra. */
import {
  createPublicApi,
  PublicApiError,
  serializeBBox,
  type BoundingBox,
  type WorkSummary,
} from "./client.js";
import { ApiContractError } from "./contract.js";

/** Resultado de la muestra: consistente, inconclusa por límites o fallida por inconsistencia/lectura. */
export type AcceptanceStatus = "passed" | "incomplete" | "failed";
/** Resultado de una comprobación sin datos de obras; conserva código y estado HTTP cuando aplica. */
export interface AcceptanceCheck {
  status: AcceptanceStatus;
  code: string;
  httpStatus?: number;
}
/** Área WGS84 y presupuestos que impiden barrer indefinidamente el catálogo activo. */
export interface AcceptanceOptions {
  bbox: BoundingBox;
  maxPages?: number;
  pageSize?: number;
  maxDetails?: number;
  requestTimeoutMs?: number;
  totalTimeoutMs?: number;
}
/** Informe de sólo lectura con conteos, completitud y límites; no incluye identidades ni ubicaciones de obras. */
export interface AcceptanceReport {
  mode: "read-only";
  status: AcceptanceStatus;
  catalogoVersion: string | null;
  checks: Record<
    | "generalList"
    | "spatialList"
    | "geojson"
    | "spatialConsistency"
    | "details",
    AcceptanceCheck
  >;
  counts: {
    generalWorks: number;
    spatialWorks: number;
    features: number;
    geoWorks: number;
    details: number;
    spatialListPages: number;
    geojsonPages: number;
  };
  sampling: {
    generalHasNextPage: boolean | null;
    spatialListComplete: boolean;
    geojsonComplete: boolean;
    detailsLimited: boolean;
  };
}

/** Incidencia interna de auditoría que distingue falta de evidencia de una falla y permite detener la muestra. */
class AuditIssue extends Error {
  /** Conserva clasificación, código y señal de interrupción sin incluir datos de registros. */
  constructor(
    readonly status: AcceptanceStatus,
    readonly code: string,
    readonly stop = false,
  ) {
    super(code);
  }
}

/**
 * Exige un entero positivo dentro del presupuesto antes de iniciar solicitudes.
 * @throws TypeError Si la opción excede el límite admitido.
 */
function boundedInteger(value: number, maximum: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new TypeError(`${name} debe ser un entero entre 1 y ${maximum}.`);
  }
  return value;
}

/** Auditoría acotada de lectura. Un pase valida la muestra, no su representatividad. */
export async function auditPublicApi(
  api: ReturnType<typeof createPublicApi>,
  options: AcceptanceOptions,
): Promise<AcceptanceReport> {
  serializeBBox(options.bbox);
  const maxPages = boundedInteger(options.maxPages ?? 3, 10, "maxPages");
  const pageSize = boundedInteger(options.pageSize ?? 20, 100, "pageSize");
  const maxDetails = boundedInteger(options.maxDetails ?? 3, 10, "maxDetails");
  const requestTimeoutMs = boundedInteger(
    options.requestTimeoutMs ?? 5000,
    2_147_483_647,
    "requestTimeoutMs",
  );
  const totalTimeoutMs = boundedInteger(
    options.totalTimeoutMs ?? 30000,
    2_147_483_647,
    "totalTimeoutMs",
  );
  const deadline = Date.now() + totalTimeoutMs;
  /** Inicializa una comprobación sin evidencia; nunca la presenta como aprobada antes de ejecutarla. */
  const pending = (): AcceptanceCheck => ({
    status: "incomplete",
    code: "NOT_RUN",
  });
  const report: AcceptanceReport = {
    mode: "read-only",
    status: "incomplete",
    catalogoVersion: null,
    checks: {
      generalList: pending(),
      spatialList: pending(),
      geojson: pending(),
      spatialConsistency: pending(),
      details: pending(),
    },
    counts: {
      generalWorks: 0,
      spatialWorks: 0,
      features: 0,
      geoWorks: 0,
      details: 0,
      spatialListPages: 0,
      geojsonPages: 0,
    },
    sampling: {
      generalHasNextPage: null,
      spatialListComplete: false,
      geojsonComplete: false,
      detailsLimited: false,
    },
  };
  let stopped = false;
  const samples = new Map<string, WorkSummary>();
  const spatialWorks = new Map<string, string>();
  const geoWorks = new Map<string, string>();
  const locations = new Set<string>();

  /** Fija la versión de la primera respuesta y detiene la auditoría si cambia durante la lectura. */
  function catalog(response: { catalogoVersion: string }): void {
    if (report.catalogoVersion === null) {
      report.catalogoVersion = response.catalogoVersion;
    } else if (report.catalogoVersion !== response.catalogoVersion) {
      throw new AuditIssue("incomplete", "CATALOG_CHANGED", true);
    }
  }

  /** Retiene una ficha de muestra por obra y detecta revisiones/fechas incompatibles entre resúmenes. */
  function sample(summary: WorkSummary): void {
    const existing = samples.get(summary.obraId);
    if (
      existing &&
      (existing.revisionId !== summary.revisionId ||
        existing.numeroRevision !== summary.numeroRevision ||
        existing.metadata.publicadoEn !== summary.metadata.publicadoEn)
    ) {
      throw new AuditIssue("failed", "SUMMARY_IDENTITY_MISMATCH");
    }
    samples.set(summary.obraId, summary);
  }

  /** Limita cada lectura al menor timeout disponible y cancela la solicitud al vencer el presupuesto global. */
  async function request<T>(
    read: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const remaining = deadline - Date.now();
    if (remaining <= 0)
      throw new AuditIssue("incomplete", "AUDIT_TIMEOUT", true);
    const timeout = Math.min(requestTimeoutMs, remaining);
    const totalBound = remaining <= requestTimeoutMs;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expiration = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const issue = new AuditIssue(
          totalBound ? "incomplete" : "failed",
          totalBound ? "AUDIT_TIMEOUT" : "REQUEST_TIMEOUT",
          totalBound,
        );
        reject(issue);
        controller.abort();
      }, timeout);
    });
    try {
      return await Promise.race([read(controller.signal), expiration]);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Registra el resultado de un bloque sin volcar excepciones ni registros y propaga la necesidad de detenerse. */
  async function check(
    name: keyof AcceptanceReport["checks"],
    action: () => Promise<void>,
  ): Promise<void> {
    if (stopped) return;
    try {
      await action();
      report.checks[name] = { status: "passed", code: "VERIFIED_SAMPLE" };
    } catch (error) {
      if (error instanceof AuditIssue) {
        report.checks[name] = { status: error.status, code: error.code };
        stopped ||= error.stop;
      } else if (error instanceof PublicApiError) {
        const changed = error.requiresPaginationRestart;
        report.checks[name] = {
          status: changed ? "incomplete" : "failed",
          code: changed ? "CATALOG_CHANGED" : "HTTP_ERROR",
          httpStatus: error.status,
        };
        stopped ||= changed;
      } else {
        report.checks[name] = {
          status: "failed",
          code:
            error instanceof ApiContractError
              ? "CONTRACT_INVALID"
              : "READ_ERROR",
        };
      }
    }
  }

  await check("generalList", async () => {
    const page = await request((signal) =>
      api.list({ limit: pageSize }, { signal }),
    );
    catalog(page);
    report.counts.generalWorks = page.items.length;
    report.sampling.generalHasNextPage = page.nextCursor !== null;
    const works = new Set<string>();
    for (const item of page.items) {
      if (works.has(item.obraId))
        throw new AuditIssue("failed", "DUPLICATE_WORK");
      works.add(item.obraId);
      sample(item);
    }
    if (!page.items.length)
      throw new AuditIssue("incomplete", "NO_PUBLIC_WORKS");
  });

  await check("spatialList", async () => {
    let cursor: string | undefined;
    const cursors = new Set<string>();
    for (let index = 0; index < maxPages; index += 1) {
      const page = await request((signal) =>
        api.list(
          {
            bbox: options.bbox,
            limit: pageSize,
            ...(cursor ? { cursor } : {}),
          },
          { signal },
        ),
      );
      catalog(page);
      report.counts.spatialListPages += 1;
      for (const item of page.items) {
        if (spatialWorks.has(item.obraId))
          throw new AuditIssue("failed", "DUPLICATE_WORK");
        spatialWorks.set(item.obraId, item.revisionId);
        sample(item);
      }
      report.counts.spatialWorks = spatialWorks.size;
      if (page.nextCursor === null) {
        report.sampling.spatialListComplete = true;
        break;
      }
      if (cursors.has(page.nextCursor))
        throw new AuditIssue("failed", "REPEATED_CURSOR");
      cursors.add(page.nextCursor);
      cursor = page.nextCursor;
    }
    if (!report.sampling.spatialListComplete)
      throw new AuditIssue("incomplete", "PAGE_LIMIT");
    if (!spatialWorks.size)
      throw new AuditIssue("incomplete", "NO_SPATIAL_SAMPLE");
  });

  await check("geojson", async () => {
    let cursor: string | undefined;
    const cursors = new Set<string>();
    for (let index = 0; index < maxPages; index += 1) {
      const page = await request((signal) =>
        api.geojson(
          {
            bbox: options.bbox,
            limit: pageSize,
            ...(cursor ? { cursor } : {}),
          },
          { signal },
        ),
      );
      catalog(page);
      report.counts.geojsonPages += 1;
      for (const feature of page.features) {
        const { obraId, revisionId, ubicacionId } = feature.properties;
        if (feature.id !== ubicacionId)
          throw new AuditIssue("failed", "FEATURE_IDENTITY_MISMATCH");
        if (locations.has(feature.id))
          throw new AuditIssue("failed", "DUPLICATE_FEATURE");
        locations.add(feature.id);
        const revision = geoWorks.get(obraId);
        if (revision !== undefined && revision !== revisionId) {
          throw new AuditIssue("failed", "FEATURE_IDENTITY_MISMATCH");
        }
        geoWorks.set(obraId, revisionId);
      }
      report.counts.features = locations.size;
      report.counts.geoWorks = geoWorks.size;
      if (page.nextCursor === null) {
        report.sampling.geojsonComplete = true;
        break;
      }
      if (cursors.has(page.nextCursor))
        throw new AuditIssue("failed", "REPEATED_CURSOR");
      cursors.add(page.nextCursor);
      cursor = page.nextCursor;
    }
    if (!report.sampling.geojsonComplete)
      throw new AuditIssue("incomplete", "PAGE_LIMIT");
    if (!geoWorks.size) throw new AuditIssue("incomplete", "NO_SPATIAL_SAMPLE");
  });

  await check("spatialConsistency", async () => {
    if (
      !report.sampling.spatialListComplete ||
      !report.sampling.geojsonComplete
    ) {
      throw new AuditIssue("incomplete", "PAGES_INCOMPLETE");
    }
    if (
      spatialWorks.size !== geoWorks.size ||
      [...spatialWorks].some(([id, revision]) => geoWorks.get(id) !== revision)
    ) {
      throw new AuditIssue("failed", "SPATIAL_IDENTITY_MISMATCH");
    }
    if (!spatialWorks.size)
      throw new AuditIssue("incomplete", "NO_SPATIAL_SAMPLE");
  });

  await check("details", async () => {
    const selected = [...samples.values()].slice(0, maxDetails);
    report.sampling.detailsLimited = samples.size > selected.length;
    if (!selected.length)
      throw new AuditIssue("incomplete", "NO_DETAIL_SAMPLE");
    for (const summary of selected) {
      const detail = await request((signal) =>
        api.detail(summary.obraId, summary.revisionId, { signal }),
      );
      catalog(detail);
      if (
        detail.obraId !== summary.obraId ||
        detail.revisionId !== summary.revisionId ||
        detail.numeroRevision !== summary.numeroRevision ||
        detail.metadata.publicadoEn !== summary.metadata.publicadoEn
      ) {
        throw new AuditIssue("failed", "DETAIL_IDENTITY_MISMATCH");
      }
      report.counts.details += 1;
    }
  });

  const statuses = Object.values(report.checks).map((item) => item.status);
  report.status = statuses.includes("failed")
    ? "failed"
    : statuses.includes("incomplete")
      ? "incomplete"
      : "passed";
  return report;
}
