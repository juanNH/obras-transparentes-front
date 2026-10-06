/** @file Ficha pública por obra y revisión, con canonical actual e indexación restringida de revisiones históricas. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PublicApiError } from "../../../api/client.js";
import { WorkDetailContent } from "../../../components/work-detail.js";
import { publicApi } from "../../../lib/public-api.js";
import { indexableSiteUrl, reportEmail } from "../../../lib/config.js";
import { pageMetadata } from "../../../lib/seo.js";
import { stateLabel } from "../../../lib/presentation.js";
import { parseWorkRoute } from "../../../lib/work-route.js";

/** Parámetros asíncronos de App Router para obra y revisión pública opcional. */
type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Deduplica la lectura de la solicitud; distingue una publicación ausente de fallas de servicio sin lanzar notFound desde metadatos. */
const readWork = cache(async (id: string, revisionId?: string) => {
  try { return await publicApi().detail(id, revisionId); }
  catch (error) {
    if (error instanceof PublicApiError && error.status === 404) return null;
    throw error;
  }
});

/** Valida y normaliza UUID antes de consultar; devuelve null ante rutas o revisiones inválidas/repetidas. */
async function route(props: PageProps) {
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  return parseWorkRoute(id, query.revisionId);
}

/** Ausencia sin canonical ni preview heredado, también para RSC o cambios posteriores al precheck de documento. */
const missingMetadata: Metadata = { title: "Obra no encontrada", robots: { index: false, follow: true }, alternates: null, openGraph: null };

/** Genera canonical actual o noindex de ausencia sin interrumpir metadatos; Proxy resuelve antes del render las ausencias confirmadas de documentos HTML. */
export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const selection = await route(props);
  if (!selection) return missingMetadata;
  const { id, revisionId } = selection;
  const work = await readWork(id, revisionId);
  if (!work) return missingMetadata;
  const origin = indexableSiteUrl();
  const canonical = origin ? new URL(`/obras/${id}`, origin).href : null;
  const territory = work.territorios[0]?.nombre;
  return {
    ...pageMetadata(`/obras/${id}`, {
      title: `${work.nombre}${territory ? ` · ${territory}` : ""}`,
      description: `${work.nombre}. ${stateLabel(work.estado)}. Consultá la información disponible, sus fechas y fuentes en Obras Transparentes.`,
      index: revisionId === undefined && work.publicadaActualmente,
    }),
    ...(canonical ? { openGraph: { title: work.nombre, description: "Información pública sobre esta obra, sus fechas y sus fuentes.", url: canonical, type: "article" as const, locale: "es_AR", siteName: "Obras Transparentes" } } : {}),
  };
}

/** Conserva validación y notFound de RSC/leaf, enlaces y errores recuperables; el precheck de Proxy ofrece recuperación estática a documentos ausentes. */
export default async function WorkPage(props: PageProps) {
  const selection = await route(props);
  if (!selection) notFound();
  const { id, revisionId } = selection;
  const work = await readWork(id, revisionId);
  if (!work) notFound();
  const email = reportEmail();
  const path = `/obras/${id}`;
  const origin = indexableSiteUrl();
  const canonical = origin ? new URL(path, origin).href : path;
  return <div className="container detail-page">
    <nav className="detail-breadcrumb" aria-label="Ruta de navegación"><Link href="/mapa">← Explorar obras</Link></nav>
    <WorkDetailContent work={work} />
    <aside className="detail-section detail-actions" aria-label="Enlaces de la ficha">
      <h2>Compartir y revisar la información</h2>
      <p><a href={canonical}>Enlace permanente a la ficha actual</a>. Podés copiarlo desde la barra de direcciones de tu navegador.</p>
      <p><a href={`/obras/${id}?revisionId=${work.revisionId}`}>Enlace a esta revisión publicada</a>.</p>
      {email && <p><a href={`mailto:${email}?subject=${encodeURIComponent(`Revisión de información: ${work.nombre}`)}&body=${encodeURIComponent(`Ficha: ${canonical}\nRevisión: ${work.revisionId}\n\nDato a revisar y fuente que lo respalda:\n`)}`}>Informar un posible error en los datos</a></p>}
      <Link href="/mapa" className="button button-secondary">Volver al listado</Link>
    </aside>
  </div>;
}
