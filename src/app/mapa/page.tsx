/** @file Entrada del explorador con lista HTML consultada en servidor y filtros compartibles validados. */
import { pageMetadata } from "../../lib/seo";
import { Explorer } from "../../components/explorer";
import { publicApi } from "../../lib/public-api";
import { mapStyleUrl } from "../../lib/config";
import {
  countsQuery,
  explorerHref,
  parseExplorerQuery,
  searchParamsOf,
} from "../../lib/explorer-query";
import { buildSourceCoverage } from "../../lib/source-coverage";
import { PublicApiError } from "../../api/client";
import type {
  InstitutionalOrganizationCatalog,
  LocalityCatalog,
  PartyCatalog,
  ProvinceCatalog,
  WorkCounts,
  WorkList,
} from "../../api/client";
import type { PublicSourceCoverage } from "../../lib/source-coverage";

/** Fuerza lectura de catálogo en cada solicitud para evitar mezclar publicaciones almacenadas. */
export const dynamic = "force-dynamic";
/** Canonical de exploración sin indexar combinaciones de filtros y selecciones. */
export const metadata = pageMetadata("/mapa", {
  title: "Explorar obras",
  description:
    "Consultá las obras publicadas como lista accesible o mapa, con sus fuentes y revisiones.",
  index: false,
});
/** Valida la URL y entrega lista HTML inicial con error recuperable; el explorador se reinicia al cambiar consulta/versión. */
export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let state;
  try {
    state = parseExplorerQuery(searchParamsOf(await searchParams));
  } catch {
    return (
      <section className="container page-heading">
        <p className="eyebrow">Explorar obras</p>
        <h1>Revisá este enlace</h1>
        <p>
          Los filtros o el área no son válidos. Podés empezar otra consulta.
        </p>
        <a className="button" href="/mapa">
          Ver todo el catálogo
        </a>
      </section>
    );
  }
  let initial: WorkList | null = null;
  let partyCatalog: PartyCatalog | null = null;
  let provinceCatalog: ProvinceCatalog | null = null;
  let localityCatalog: LocalityCatalog | null = null;
  let institutionalCatalog: InstitutionalOrganizationCatalog | null = null;
  let workCounts: WorkCounts | null = null;
  let sourceCoverage: PublicSourceCoverage[] = [];
  let countsError: "UNAVAILABLE" | "CATALOG_CHANGED" | null = null;
  let initialError: string | null = null;
  const api = publicApi();
  const localityRead =
    state.query.provinciaCodigo?.length === 1
      ? api.localities(state.query.provinciaCodigo)
      : Promise.resolve(null);
  const [primaryReads, localityReads] = await Promise.all([
    Promise.allSettled([
      api.list(state.query),
      api.parties(),
      api.provinces(),
      api.organizations(),
      api.counts(countsQuery(state.query)),
      api.sourceCoverage(),
    ]),
    Promise.allSettled([localityRead]),
  ]);
  const [works, parties, provinces, organizations, counts, sources] =
    primaryReads;
  if (works.status === "fulfilled") initial = works.value;
  else {
    initialError =
      works.reason instanceof PublicApiError &&
      works.reason.requiresPaginationRestart
        ? "CATALOG_CHANGED"
        : "UNAVAILABLE";
  }
  if (parties.status === "fulfilled") partyCatalog = parties.value;
  if (provinces.status === "fulfilled") provinceCatalog = provinces.value;
  if (localityReads[0]?.status === "fulfilled")
    localityCatalog = localityReads[0].value;
  if (organizations.status === "fulfilled")
    institutionalCatalog = organizations.value;
  if (
    counts.status === "fulfilled" &&
    initial &&
    counts.value.catalogoVersion === initial.catalogoVersion
  )
    workCounts = counts.value;
  else
    countsError =
      counts.status === "fulfilled" && initial
        ? "CATALOG_CHANGED"
        : "UNAVAILABLE";
  sourceCoverage = buildSourceCoverage(
    initial?.catalogoVersion ?? null,
    sources,
  );
  return (
    <section className="container explorer-page">
      <div className="page-heading">
        <p className="eyebrow">El catálogo público</p>
        <h1>Las obras, en su territorio.</h1>
        <p>
          Elegí una obra para ubicarla. Acercar el mapa no cambia los
          resultados.
        </p>
      </div>
      <Explorer
        key={
          explorerHref(state.query) +
          ":" +
          (initial?.catalogoVersion ?? initialError)
        }
        initial={initial}
        initialError={initialError}
        state={state}
        styleUrl={mapStyleUrl()}
        partyCatalog={partyCatalog}
        provinceCatalog={provinceCatalog}
        localityCatalog={localityCatalog}
        institutionalCatalog={institutionalCatalog}
        counts={workCounts}
        countsError={countsError}
        sourceCoverage={sourceCoverage}
      />
    </section>
  );
}
