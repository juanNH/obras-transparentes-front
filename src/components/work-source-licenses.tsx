/** @file Presenta licencias y atribución conservadas al publicar una revisión, sin inferir derechos para fuentes o contenidos ausentes. */
import type { ReactNode } from "react";
import type { WorkDetail } from "../api/client.js";
import { publicationDate, safeSourceUrl, sourceLabel } from "../lib/presentation.js";

/** Enlaza únicamente referencias HTTP(S) sin credenciales; conserva la etiqueta si la referencia no es segura. */
function LicenseLink({ url, children }: { url: string; children: ReactNode }) {
  const href = safeSourceUrl(url);
  return href ? <a href={href} rel="noreferrer">{children}</a> : <span>{children} (enlace no disponible)</span>;
}

/** Muestra la evidencia congelada de esta publicación y mantiene independiente la fecha del dato fuente. */
export function WorkSourceLicenses({ work, compact = false }: { work: Pick<WorkDetail, "licenciasFuentes"> & { fuentes: readonly { codigo: string; recursoId: string; nombre?: string }[] }; compact?: boolean }) {
  const Heading = compact ? "h3" : "h2";
  const SourceHeading = compact ? "h4" : "h3";
  const licenses = work.licenciasFuentes ?? [];
  const olavarria = work.fuentes.some(source => source.codigo === "olavarria-obras") || licenses.some(license => license.codigo === "olavarria-obras");
  const generalPueyrredon = work.fuentes.some(source => source.codigo === "general-pueyrredon-registros") || licenses.some(license => license.codigo === "general-pueyrredon-registros");
  return <section className="detail-section source-licenses">
    <Heading>Licencias y atribución</Heading>
    {licenses.length === 0 ? <p>No hay evidencia de licencia registrada en la publicación de esta revisión.</p> : <>
      <p>La atribución y las licencias corresponden a la evidencia conservada al publicar esta revisión.</p>
      <ul className="source-license-list">{licenses.map((license, index) => {
        const source = work.fuentes.find(item => item.codigo === license.codigo && license.recursoVersionIds.includes(item.recursoId));
        return <li key={`${license.fuenteId}:${license.version}:${index}`}>
          <SourceHeading>{source ? source.nombre ?? sourceLabel(source.codigo as WorkDetail["fuentes"][number]["codigo"]) ?? source.codigo : license.codigo}</SourceHeading>
          <dl className="detail-grid">
            <div><dt>Licencia registrada</dt><dd><LicenseLink url={license.urlLicencia}>{license.codigoLicencia}</LicenseLink></dd></div>
            <div><dt>Alcance de la licencia</dt><dd>{{ RESOURCE: "Recurso de datos", DATABASE: "Base de datos", CONTENTS: "Contenidos individuales" }[license.alcance]}</dd></div>
            <div><dt>Atribución</dt><dd className="source-license-attribution">{license.atribucion}</dd></div>
            <div><dt>Evidencia de licencia capturada</dt><dd><time dateTime={license.capturadaEn}>{publicationDate(license.capturadaEn)}</time><p><LicenseLink url={license.evidenciaUrl}>Consultar evidencia de licencia</LicenseLink></p></dd></div>
          </dl>
          {license.distribucionBase && <div>
            <p><strong>Distribución de la base derivada:</strong> <LicenseLink url={license.distribucionBase.url}>{license.distribucionBase.licencia}</LicenseLink>.</p>
            <p className="source-license-notice">{license.distribucionBase.aviso}</p>
          </div>}
          {license.contenidosIndividuales === "LICENSED" && license.licenciaContenidos
            ? <p>Licencia de contenidos individuales: <LicenseLink url={license.licenciaContenidos.url}>{license.licenciaContenidos.codigo}</LicenseLink>.</p>
            : <p>Los contenidos individuales, como imágenes o documentos, no están incluidos en la licencia de datos registrada.</p>}
        </li>;
      })}</ul>
      <p className="muted">La fecha de captura de la evidencia de licencia no indica cuándo se actualizó la información de la obra.</p>
    </>}
    {olavarria && <p><a href="/bases/olavarria-obras">Consultar la base derivada actual de Olavarría, sus avisos y la descarga JSON</a>. La oferta distingue revisiones de obras y registros informados vigentes; no incluye revisiones retiradas.</p>}
    {generalPueyrredon && <p><a href="/bases/general-pueyrredon-registros">Consultar la base derivada actual de General Pueyrredón, sus avisos y la descarga JSON</a>. La oferta conserva las unidades informadas de este corte y su licencia registrada.</p>}
  </section>;
}
