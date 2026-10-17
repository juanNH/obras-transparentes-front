/** @file Oferta SSR de la base derivada actual de Olavarría, con decisión pendiente explícita, unidades separadas y descarga real sin aceptación contractual. */
import type { ReactNode } from "react";
import type { OlavarriaDerivedDatabase } from "../../../api/client";
import { publicApi } from "../../../lib/public-api";
import { pageMetadata } from "../../../lib/seo";
import { safeSourceUrl } from "../../../lib/presentation";
import { WorkSourceLicenses } from "../../../components/work-source-licenses";

/** Consulta la oferta vigente sin caché para conservar retiros y decisiones actuales. */
export const dynamic = "force-dynamic";
/** Describe una base de datos acotada sin anticipar permiso o publicación. */
export const metadata = pageMetadata("/bases/olavarria-obras", {
  title: "Base derivada de Olavarría",
  description: "Estado de distribución, originales, atribución y descarga de obras y registros informados de Olavarría.",
  index: false,
});

/** Conserva referencias literales sin navegar a esquemas inseguros o URLs con credenciales. */
function SourceLink({ url, children }: { url: string; children: ReactNode }) {
  const href = safeSourceUrl(url);
  return href ? <a href={href} rel="noreferrer">{children}</a> : <span>{children} (enlace no disponible)</span>;
}

/** Presenta un snapshot completo; una falla de lectura no se convierte en cero ni ofrece una descarga parcial. */
export default async function OlavarriaDatabasePage() {
  let offer: OlavarriaDerivedDatabase;
  try { offer = await publicApi().olavarriaDerivedDatabase(); }
  catch {
    return <div className="container detail-page"><h1>Base derivada de Olavarría</h1>
      <p className="notice error" role="status">No se pudo consultar la oferta actual completa. Su estado y sus cantidades son desconocidos; no equivalen a cero.</p>
      <p><a href="/bases/olavarria-obras">Volver a consultar la oferta</a></p><p><a href="/mapa?fuente=olavarria-obras">Consultar la cobertura de la fuente</a></p>
    </div>;
  }
  const pending = offer.estado === "PENDING_POLICY";
  const decisions = offer.licenciaDistribucion.decisionesPublicas;
  return <div className="container detail-page">
    <header className="page-heading"><p className="eyebrow">Datos y procedencia</p><h1>Base derivada de Olavarría</h1>
      <p>Porción actual del original identificado abajo. Contiene dos unidades diferentes: revisiones de obras publicadas y registros informados publicados.</p>
    </header>
    <section className="detail-section" aria-labelledby="offer-state"><h2 id="offer-state">Estado de la oferta</h2>
      <p className="notice"><strong>{pending ? "Decisión de distribución pendiente (PENDING_POLICY)." : "Oferta de distribución activa (ACTIVE)."}</strong> {pending ? "No hay contenido habilitado por esta oferta. La disponibilidad del original no concede permiso." : "La oferta puede estar vacía antes de la primera publicación autorizada."}</p>
      <p className="source-license-notice">{offer.aviso}</p>
      <p>Consultar esta página o descargar el JSON no registra una política ni acepta un acuerdo contractual.</p>
      <dl className="detail-grid"><div><dt>Revisiones de obras publicadas vigentes</dt><dd>{offer.obras.cantidad}</dd></div><div><dt>Registros informados publicados vigentes</dt><dd>{offer.registros.cantidad}</dd></div></dl>
      <p>Las dos cantidades no se suman. Un registro informado no acredita una obra nueva ni resuelve duplicados.</p>
      <p className="muted">Corte coherente: catálogo de obras {offer.catalogos.obras}; catálogo de registros {offer.catalogos.registros}. La descarga vuelve a consultar la oferta vigente y puede reflejar un corte posterior.</p>
      <a className="button" href="/api/public/bases-derivadas/olavarria-obras" download="olavarria-base-derivada.json">{pending ? "Descargar JSON del estado pendiente" : "Descargar base derivada completa en JSON"}</a>
      <p className="muted">Máximo {offer.limites.filasPorUnidad} elementos por unidad y 10 MiB por descarga. No se entrega una porción truncada.</p>
    </section>
    <section className="detail-section" aria-labelledby="offer-original"><h2 id="offer-original">Original exacto de la oferta</h2>
      <dl className="detail-grid"><div><dt>Fuente</dt><dd>Municipalidad de Olavarría · {offer.original.codigo}</dd></div><div><dt>Versión del recurso</dt><dd className="source-license-attribution">{offer.original.recursoId}</dd></div><div><dt>Tamaño del original capturado</dt><dd>{offer.original.bytes} bytes</dd></div></dl>
      <p className="source-license-attribution">SHA-256 del original capturado: <code>{offer.original.sha256}</code></p>
      <p><SourceLink url={offer.original.urlCatalogo}>Consultar catálogo oficial</SourceLink>{" · "}<SourceLink url={offer.original.url}>Consultar CSV en el servidor oficial</SourceLink></p>
      <p>El enlace oficial puede cambiar de contenido. La identidad, el tamaño y la huella indican el original utilizado; el JSON de esta oferta contiene sus proyecciones públicas y no una copia del archivo original.</p>
    </section>
    <section className="detail-section" aria-labelledby="offer-license"><h2 id="offer-license">Licencia, atribución y avisos</h2>
      <p>Distribución: <strong>{offer.licenciaDistribucion.estado === "PENDING" ? "Pendiente de decisión registrada" : "Decisión registrada"}</strong>. <SourceLink url={offer.licenciaDistribucion.url}>{offer.licenciaDistribucion.codigo}</SourceLink>{pending ? " es la licencia propuesta para esta oferta; este estado no la habilita." : ". Los avisos de cada decisión se conservan a continuación."}</p>
      {decisions.length ? <WorkSourceLicenses work={{ licenciasFuentes: decisions, fuentes: [{ codigo: offer.original.codigo, recursoId: offer.original.recursoId, nombre: "Municipalidad de Olavarría" }] }} compact /> : <p>No hay decisiones públicas de licencia registradas en esta oferta.</p>}
      <p>La licencia de base de datos no extiende por sí sola derechos sobre imágenes, documentos u otros contenidos individuales.</p>
    </section>
    <section className="detail-section" aria-labelledby="offer-transformations"><h2 id="offer-transformations">Transformaciones y contenido ofrecido</h2>
      <ul>{offer.transformaciones.map((description, index) => <li key={index}>{description}</li>)}</ul>
      <p className="source-license-attribution">SHA-256 del contenido de las dos colecciones: <code>{offer.contenidoSha256}</code>. No es la huella del archivo original ni la del documento JSON completo.</p>
      <h3>Revisiones de obras publicadas</h3>
      {offer.obras.items.length ? <ul>{offer.obras.items.map(work => <li key={work.obraId}><a href={`/obras/${work.obraId}?revisionId=${work.revisionId}`}>{work.nombre}</a>{!work.ubicaciones.some(location => location.condicion === "ACCEPTED" && location.geometria !== null) && " · Sin ubicación aprobada: no aparece en el mapa."}</li>)}</ul> : <p>No hay revisiones de obras en esta oferta{pending ? " porque la decisión está pendiente" : " actualmente"}.</p>}
      <h3>Registros informados publicados</h3>
      {offer.registros.items.length ? <ul>{offer.registros.items.map(record => <li key={record.registroId}><a href={`/registros/${record.registroId}`}>{record.registro?.nombre ?? record.registroId}</a></li>)}</ul> : <p>No hay registros informados en esta oferta{pending ? " porque la decisión está pendiente" : " actualmente"}.</p>}
      <p>Se excluyen publicaciones retiradas y datos administrativos privados. No se incluyen ubicaciones candidatas.</p>
    </section>
    <nav className="detail-actions" aria-label="Explorar Olavarría"><a href="/mapa?fuente=olavarria-obras">Obras publicadas de la fuente</a>{" · "}<a href="/registros?fuente=olavarria-obras">Registros informados de la fuente</a></nav>
  </div>;
}
