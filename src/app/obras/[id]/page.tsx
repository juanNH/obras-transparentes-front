import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PublicApiError } from "../../../api/client.js";
import { WorkDetailContent } from "../../../components/work-detail.js";
import { publicApi } from "../../../lib/public-api.js";
import { reportEmail, siteUrl } from "../../../lib/config.js";
import { stateLabel } from "../../../lib/presentation.js";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const uuid = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;
const readWork = cache(async (id: string, revisionId?: string) => {
  try { return await publicApi().detail(id, revisionId); }
  catch (error) {
    if (error instanceof PublicApiError && error.status === 404) notFound();
    throw error;
  }
});

async function route(props: PageProps) {
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  const revisionId = query.revisionId;
  if (!uuid.test(id) || (revisionId !== undefined && (typeof revisionId !== "string" || !uuid.test(revisionId)))) notFound();
  return { id: id.toLowerCase(), revisionId: revisionId?.toLowerCase() };
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { id, revisionId } = await route(props);
  const work = await readWork(id, revisionId);
  const canonical = new URL(`/obras/${id}`, siteUrl()).href;
  return {
    title: work.nombre,
    description: `${work.nombre}. ${stateLabel(work.estado)}. Consultá la información disponible, sus fechas y fuentes en Obras Transparentes.`,
    alternates: { canonical },
    robots: { index: process.env.SITE_INDEXABLE === "true" && revisionId === undefined && work.publicadaActualmente, follow: true },
    openGraph: { title: work.nombre, description: "Información pública sobre esta obra, sus fechas y sus fuentes.", url: canonical, type: "article" },
  };
}

export default async function WorkPage(props: PageProps) {
  const { id, revisionId } = await route(props);
  const work = await readWork(id, revisionId);
  const email = reportEmail();
  const canonical = new URL(`/obras/${id}`, siteUrl()).href;
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
