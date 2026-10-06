/** @file Entrada del explorador con lista HTML consultada en servidor y filtros compartibles validados. */
import { pageMetadata } from "../../lib/seo";
import { Explorer } from "../../components/explorer";
import { publicApi } from "../../lib/public-api";
import { mapStyleUrl } from "../../lib/config";
import { explorerHref, parseExplorerQuery, searchParamsOf } from "../../lib/explorer-query";
import { PublicApiError } from "../../api/client";
import type { InstitutionalOrganizationCatalog, PartyCatalog, WorkList } from "../../api/client";

/** Fuerza lectura de catálogo en cada solicitud para evitar mezclar publicaciones almacenadas. */
export const dynamic = "force-dynamic";
/** Canonical de exploración sin indexar combinaciones de filtros y selecciones. */
export const metadata = pageMetadata("/mapa", { title: "Explorar obras", description: "Consultá las obras publicadas como lista accesible o mapa, con sus fuentes y revisiones.", index: false });
/** Valida la URL y entrega lista HTML inicial con error recuperable; el explorador se reinicia al cambiar consulta/versión. */
export default async function MapPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  let state;
  try { state = parseExplorerQuery(searchParamsOf(await searchParams)); }
  catch { return <section className="container page-heading"><p className="eyebrow">Explorar obras</p><h1>Revisá este enlace</h1><p>Los filtros o el área no son válidos. Podés empezar otra consulta.</p><a className="button" href="/mapa">Ver todo el catálogo</a></section>; }
  let initial: WorkList | null = null;
  let partyCatalog: PartyCatalog | null = null;
  let institutionalCatalog: InstitutionalOrganizationCatalog | null = null;
  let initialError: string | null = null;
  const api = publicApi();
  const [works, parties, organizations] = await Promise.allSettled([api.list(state.query), api.parties(), api.organizations()]);
  if (works.status === "fulfilled") initial = works.value;
  else { initialError = works.reason instanceof PublicApiError && works.reason.requiresPaginationRestart ? "CATALOG_CHANGED" : "UNAVAILABLE"; }
  if (parties.status === "fulfilled") partyCatalog = parties.value;
  if (organizations.status === "fulfilled") institutionalCatalog = organizations.value;
  return <section className="container explorer-page">
    <div className="page-heading"><p className="eyebrow">El catálogo público</p><h1>Las obras, en su territorio.</h1><p>Elegí una obra para ubicarla. Acercar el mapa no cambia los resultados.</p></div>
    <Explorer key={explorerHref(state.query) + ":" + (initial?.catalogoVersion ?? initialError)} initial={initial} initialError={initialError} state={state} styleUrl={mapStyleUrl()} partyCatalog={partyCatalog} institutionalCatalog={institutionalCatalog} />
  </section>;
}
