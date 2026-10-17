/** @file Ficha SSR de un registro informado o aviso de retiro, sin reconstruir datos ni vínculos a obras no publicados. */
import { cache } from "react";
import { notFound } from "next/navigation";
import { PublicApiError } from "../../../api/client";
import { isUUID } from "../../../lib/explorer-query";
import { publicApi } from "../../../lib/public-api";
import { pageMetadata } from "../../../lib/seo";
import { ReportedRecordContent } from "../../../components/reported-record";

/** Consulta en cada solicitud para no reutilizar datos retirados. */
export const dynamic = "force-dynamic";
/** Distingue ausencia de indisponibilidad y comparte una sola lectura entre metadatos y contenido. */
const readRecord = cache(async (id: string) => {
  try { return await publicApi().reportedRecord(id); }
  catch (error) { if (error instanceof PublicApiError && error.status === 404) return null; throw error; }
});

/** Parámetro dinámico asíncrono de App Router. */
type RecordPageProps = { params: Promise<{ id: string }> };

/** Describe la ficha como registro, sin atribuir verificación o identidad física; no indexa retiros. */
export async function generateMetadata({ params }: RecordPageProps) {
  const { id } = await params;
  const detail = isUUID(id) ? await readRecord(id) : null;
  return pageMetadata("/registros/" + id, {
    title: detail?.registro?.nombre ? Array.from(detail.registro.nombre).slice(0, 170).join("") : (detail?.estado === "RETIRED" ? "Registro retirado" : "Registro no encontrado"),
    description: detail?.registro?.version === "registro-informado@4" ? "Fila de oferta institucional educativa informada por la fuente, con identificador reportado, procedencia y límites. No acredita obra, edificio intervenido, institución nueva o geometría." : "Información reportada por una fuente, con sus advertencias y límites. No acredita una obra única.",
    index: detail?.estado === "PUBLISHED",
  });
}

/** Devuelve la publicación exacta o retiro seguro; una ausencia no se sustituye por una obra. */
export default async function ReportedRecordPage({ params }: RecordPageProps) {
  const { id } = await params;
  if (!isUUID(id)) notFound();
  const detail = await readRecord(id);
  if (!detail) notFound();
  return <div className="container detail-page">
    <nav className="detail-breadcrumb" aria-label="Ruta de navegación"><a href="/registros">← Registros informados</a></nav>
    <ReportedRecordContent detail={detail} />
    {detail.registro?.version === "registro-informado@4" && <p><a href="/registros?fuente=pba-establecimientos&tipo=EDUCATIONAL_ESTABLISHMENT_RECORD">Consultar el padrón institucional de ofertas educativas</a></p>}
    <nav className="detail-actions" aria-label="Continuar consulta"><a className="button secondary" href="/registros">Volver a registros</a><a href="/mapa">Explorar obras publicadas</a></nav>
  </div>;
}
