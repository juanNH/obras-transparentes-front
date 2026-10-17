/** @file Oferta SSR completa del corte de General Pueyrredón, con licencia pendiente explícita y descarga de registros vigentes; no acepta contratos. */
import type { ReactNode } from "react";
import type { GeneralPueyrredonDerivedDatabase } from "../../../api/client";
import { publicApi } from "../../../lib/public-api";
import { pageMetadata } from "../../../lib/seo";
import { safeSourceUrl } from "../../../lib/presentation";
import { WorkSourceLicenses } from "../../../components/work-source-licenses";

/** Consulta el estado actual sin caché para respetar las decisiones y los retiros. */
export const dynamic = "force-dynamic";
/** Identifica el recurso acotado, con publicación pendiente hasta contar con una decisión registrada. */
export const metadata = pageMetadata("/bases/general-pueyrredon-registros", {
  title: "Base derivada de General Pueyrredón",
  description: "Corte 2025: procedencia, licencia, atribución y descarga completa de los registros municipales publicados.",
  index: false,
});

/** Mantiene texto legible cuando una referencia no es un enlace HTTP(S) seguro. */
function SourceLink({ url, children }: { url: string; children: ReactNode }) {
  const href = safeSourceUrl(url);
  return href ? <a href={href} rel="noreferrer">{children}</a> : <span>{children} (enlace no disponible)</span>;
}

/** Presenta una respuesta completa validada; un fallo de lectura conserva cantidades y estado como desconocidos. */
export default async function GeneralPueyrredonDatabasePage() {
  let offer: GeneralPueyrredonDerivedDatabase;
  try { offer = await publicApi().generalPueyrredonDerivedDatabase(); }
  catch {
    return <div className="container detail-page"><h1>Base derivada de General Pueyrredón</h1>
      <p className="notice error" role="status">No se pudo consultar la oferta completa. Su estado y cantidades son desconocidos.</p>
      <p><a href="/bases/general-pueyrredon-registros">Volver a consultar la oferta</a></p>
    </div>;
  }
  const pending = offer.estado === "PENDING_POLICY";
  const decisions = offer.licenciaDistribucion.decisionesPublicas;
  return <div className="container detail-page">
    <header className="page-heading"><p className="eyebrow">Datos y procedencia</p><h1>Base derivada de General Pueyrredón</h1>
      <p>Corte municipal 2025 de 218 filas de distinta naturaleza. Cuatro informan «Obra nueva»; las restantes informan trabajos en vía pública y trámites relacionados. Cada registro conserva su clasificación.</p>
    </header>
    <section className="detail-section" aria-labelledby="gpp-state"><h2 id="gpp-state">Estado de la oferta</h2>
      <p className="notice"><strong>{pending ? "Decisión de distribución pendiente (PENDING_POLICY)." : "Oferta de distribución activa (ACTIVE)."}</strong> {pending ? "La oferta no habilita contenido hasta registrar la decisión correspondiente al recurso exacto." : "Se ofrecen los registros publicados vigentes del original identificado abajo."}</p>
      <p className="source-license-notice">{offer.aviso}</p>
      <p>Consultar esta página o descargar el JSON no acepta un acuerdo ni registra una política de distribución.</p>
      <dl className="detail-grid"><div><dt>Registros informados publicados vigentes</dt><dd>{offer.registros.cantidad}</dd></div><div><dt>Catálogo de registros</dt><dd>{offer.catalogos.registros}</dd></div></dl>
      <p>Las filas se cuentan como registros informados. Su publicación no acredita una obra única, ejecución física ni una ubicación en el mapa.</p>
      <a className="button" href="/api/public/bases-derivadas/general-pueyrredon-registros" download="general-pueyrredon-base-derivada.json">{pending ? "Descargar JSON del estado pendiente" : "Descargar base derivada completa en JSON"}</a>
      <p className="muted">Máximo {offer.limites.filasPorUnidad} registros y 10 MiB por descarga. La respuesta se entrega completa; la descarga consulta el estado vigente y puede reflejar un corte posterior al HTML.</p>
    </section>
    <section className="detail-section" aria-labelledby="gpp-original"><h2 id="gpp-original">Original exacto de la oferta</h2>
      <dl className="detail-grid"><div><dt>Fuente</dt><dd>Municipalidad de General Pueyrredón · {offer.original.codigo}</dd></div><div><dt>Versión del recurso</dt><dd className="source-license-attribution">{offer.original.recursoId ?? "Pendiente de recepción"}</dd></div><div><dt>Tamaño del original</dt><dd>{offer.original.bytes} bytes</dd></div><div><dt>Captura declarada</dt><dd>{offer.original.capturadaEn ?? "No informada"}</dd></div></dl>
      <p className="source-license-attribution">SHA-256 del CSV original: <code>{offer.original.sha256}</code></p>
      <p><SourceLink url={offer.original.urlCatalogo}>Consultar catálogo oficial</SourceLink>{" · "}<SourceLink url={offer.original.url}>Consultar CSV en el servidor oficial</SourceLink></p>
      <p>El enlace oficial puede cambiar. La descarga ofrece la proyección pública de este original, con su identidad y transformaciones; los campos privados permanecen fuera de ella.</p>
    </section>
    <section className="detail-section" aria-labelledby="gpp-license"><h2 id="gpp-license">Licencia, atribución y avisos</h2>
      <p>Distribución: <strong>{offer.licenciaDistribucion.estado === "PENDING" ? "Pendiente de decisión registrada" : "Decisión registrada"}</strong>. <SourceLink url={offer.licenciaDistribucion.url}>{offer.licenciaDistribucion.codigo}</SourceLink>{pending ? " es la licencia propuesta para esta oferta." : "."}</p>
      {decisions.length ? <WorkSourceLicenses work={{ licenciasFuentes: decisions, fuentes: offer.original.recursoId ? [{ codigo: offer.original.codigo, recursoId: offer.original.recursoId, nombre: "Municipalidad de General Pueyrredón" }] : [] }} compact /> : <p>Aún no hay decisiones públicas de licencia registradas en esta oferta.</p>}
      <p>Las imágenes, los anexos enlazados y los contenidos individuales sin derechos comprobados quedan excluidos.</p>
    </section>
    <section className="detail-section" aria-labelledby="gpp-transformations"><h2 id="gpp-transformations">Transformaciones y contenido ofrecido</h2>
      <ul>{offer.transformaciones.map((description, index) => <li key={index}>{description}</li>)}</ul>
      <p className="source-license-attribution">SHA-256 del contenido ofrecido: <code>{offer.contenidoSha256}</code>. Esta huella se distingue de la del CSV original.</p>
      <h3>Registros informados publicados</h3>
      {offer.registros.items.length ? <ul>{offer.registros.items.map(record => <li key={record.registroId}><a href={`/registros/${record.registroId}`}>{record.registro?.nombre ?? record.registroId}</a></li>)}</ul> : <p>{pending ? "La decisión pendiente mantiene vacía la colección pública." : "La colección aún no tiene registros publicados."}</p>}
    </section>
    <nav className="detail-actions" aria-label="Explorar General Pueyrredón"><a href="/registros?fuente=general-pueyrredon-registros">Consultar registros informados de la fuente</a></nav>
  </div>;
}
