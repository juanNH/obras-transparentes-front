/** @file Contenido compartido por ficha y resumen de una revisión pública, con datos faltantes y procedencia explícitos. */
import type { ReactNode } from "react";
import type { PartyCatalog, WorkDetail } from "../api/client.js";
import { fieldLabel, formatExactDecimal, publicationDate, qualityLabel, reportedDate, safeSourceUrl, sourceLabel, stateLabel } from "../lib/presentation.js";
import { LocationQuality } from "./location-quality";
import { WorkResponsibility } from "./work-responsibility";
import { SourceBadge } from "./source-origin";
import { MapAvailability } from "./map-availability";
import { WorkAssociations } from "./work-associations";
import { Evidence } from "./work-evidence";

/** Presenta sólo URLs HTTP(S) sin credenciales como enlace; una referencia inválida permanece como texto. */
function SourceLink({ url, children }: { url: string; children: ReactNode }) {
  const href = safeSourceUrl(url);
  return href ? <a href={href} rel="noreferrer">{children}</a> : <span>{children} (enlace no disponible)</span>;
}

/** Only structured, already-public factual fields enter here; geometry stays out. */
function ReportedFields({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <>No informado</>;
  if (typeof value !== "object") return <>{String(value)}</>;
  if (Array.isArray(value)) return value.length ? <ul>{value.map((item, index) => <li key={index}><ReportedFields value={item} /></li>)}</ul> : <>Sin datos informados</>;
  return <dl className="detail-grid">{Object.entries(value).map(([key, item]) => <div key={key}><dt>{fieldLabel(key)}</dt><dd><ReportedFields value={item} /></dd></div>)}</dl>;
}

/**
 * Renderiza datos públicos de una revisión para ficha y resumen con jerarquía de encabezados adaptada.
 * @param props - Revisión validada y modo compacto del resumen.
 * @returns Contenido con publicación, ausencia cartográfica, procedencia y desconocidos explícitos.
 */
export function WorkDetailContent({ work, compact = false, partyCatalog = null }: { work: WorkDetail; compact?: boolean; partyCatalog?: PartyCatalog | null }) {
  const Title = compact ? "h2" : "h1";
  const Heading = compact ? "h3" : "h2";
  const hasGeometry = work.ubicaciones.some(location => location.condicion === "ACCEPTED" && location.geometria !== null);
  return <article className={`work-detail${compact ? " work-detail-compact" : ""}`}>
    <header className="detail-heading">
      <p className="eyebrow">Ficha pública · revisión {work.numeroRevision}</p>
      <Title>{work.nombre}</Title>
      <p><span className="status-badge">{stateLabel(work.estado)}</span></p>
      <p><MapAvailability hasGeometry={hasGeometry} publishedCurrently={work.publicadaActualmente} /></p>
      {!hasGeometry && <p className="map-availability-note">{work.publicadaActualmente ? "La obra está publicada y su información se puede consultar aquí. No aparece en el mapa porque esta revisión no tiene una ubicación aprobada para dibujar." : "Esta revisión conserva su información, pero no tiene una ubicación aprobada para dibujar en el mapa."}</p>}
      <p><SourceBadge sources={work.fuentes} /> <a className="source-colors-link" href="/proyecto#colores">Qué significa el color</a></p>
      {!work.publicadaActualmente && <p className="notice">Esta es una revisión histórica. <a href={`/obras/${work.obraId}`}>Consultar la ficha actual</a>.</p>}
    </header>

    <WorkResponsibility work={work} compact={compact} />
    <WorkAssociations work={work} compact={compact} partyCatalog={partyCatalog} />

    <section className="detail-section">
      <Heading>Qué se conoce de esta obra</Heading>
      {work.nacional?.descripcion && <p>{work.nacional.descripcion}</p>}
      {work.nacional?.objetivo && <p><strong>Objetivo informado:</strong> {work.nacional.objetivo}</p>}
      <dl className="detail-grid">
        <div><dt>Avance físico informado</dt><dd>{formatExactDecimal(work.avanceFisico)}{work.avanceFisico !== null && " %"}</dd></div>
        <div><dt>Avance financiero informado</dt><dd>{formatExactDecimal(work.avanceFinanciero)}{work.avanceFinanciero != null && " %"}</dd></div>
        <div><dt>Clasificaciones informadas</dt><dd>{work.clasificaciones.length ? work.clasificaciones.map((item) => item.etiqueta).join(" · ") : "No informadas"}</dd></div>
        <div><dt>Programas informados</dt><dd>{work.programas.length ? work.programas.join(" · ") : "No informados"}</dd></div>
      </dl>
      <p className="muted">El avance y el estado son datos distintos. Un avance del 100 % no acredita por sí solo que la obra esté finalizada.</p>
    </section>

    <section className="detail-section">
      <Heading>Territorio y ubicaciones</Heading>
      {work.territorios.length ? <ul>{work.territorios.map((territory, index) => <li key={index}>{territory.nombre} <span className="muted">(territorio reportado · {territory.esquema}: {territory.codigo})</span></li>)}</ul> : <p>Territorio no informado.</p>}
      {work.ubicaciones.length ? <ol className="location-list">{work.ubicaciones.map((location, index) => <li key={location.clave + index}>
        <LocationQuality location={location} />
        <p>Dirección reportada: {[location.direccionReportada?.calle, location.direccionReportada?.numero].filter((item) => item !== null && item !== undefined && item !== "").join(" ") || "No informada"}.</p>
        <p>{location.condicion !== "ACCEPTED" || location.geometria === null ? "Sin geometría aprobada para mostrar en el mapa." : `Representación disponible: ${{ Point: "punto", MultiPoint: "varios puntos", LineString: "tramo", MultiLineString: "varios tramos", Polygon: "área", MultiPolygon: "varias áreas" }[location.geometria.type]}.`}</p>
        {location.controles.length > 0 && <details><summary>Controles de esta ubicación</summary><ul>{location.controles.map((control, controlIndex) => <li key={controlIndex}>{control}</li>)}</ul></details>}
      </li>)}</ol> : <p>No hay ubicaciones informadas para esta revisión.</p>}
    </section>

    <section className="detail-section">
      <Heading>Importes informados</Heading>
      {work.importes.length ? <ul className="amount-list">{work.importes.map((amount, index) => <li key={index}><strong>{formatExactDecimal(amount.valor)}</strong> · {amount.moneda === null ? "Moneda no informada" : amount.moneda}<p>{{ MONTO_REPORTADO: "Monto reportado", MONTO_DEFINITIVO_REPORTADO: "Monto definitivo reportado", TOTAL_OBRA_REPORTADO: "Total de obra reportado" }[amount.concepto]}. Base y alcance no informados.</p></li>)}</ul> : <p>No hay importes informados. Esto no significa que el costo sea cero.</p>}
    </section>

    <section className="detail-section">
      <Heading>Fechas y publicación</Heading>
      <dl className="detail-grid">
        <div><dt>Esta revisión se publicó en Obras Transparentes</dt><dd><time dateTime={work.metadata.publicadoEn}>{publicationDate(work.metadata.publicadoEn)}</time></dd></div>
        <div><dt>Actualización de la fuente</dt><dd>{work.metadata.fechaActualizacionFuente === null ? "Fecha no informada" : <time dateTime={work.metadata.fechaActualizacionFuente}>{publicationDate(work.metadata.fechaActualizacionFuente)}</time>}</dd></div>
      </dl>
      <p className="muted">La fecha de publicación de la ficha no es la fecha de actualización del dato.</p>
      {work.fechasInformadas.length ? <><ul>{work.fechasInformadas.map((date, index) => <li key={index}>{date.campo === "inicio" ? "Inicio informado" : "Fin informado"}: {reportedDate(date)}.</li>)}</ul><p className="muted">La fuente no determina si estas fechas son previstas o efectivas.</p></> : <p>Inicio y fin de la obra: sin fechas informadas.</p>}
    </section>

    <section className="detail-section">
      <Heading>Fuentes de información</Heading>
      <p>La fuente de datos no es necesariamente el organismo responsable de la obra.</p>
      <ul>{work.fuentes.map((source, index) => <li key={source.recursoId + index}><SourceLink url={source.urlCatalogo}>{sourceLabel(source.codigo)}</SourceLink><details><summary>Identificación del recurso fuente</summary><p>Recurso: <span className="technical-id">{source.recursoId}</span></p><p>Huella SHA-256: <span className="technical-id">{source.sha256}</span></p></details></li>)}</ul>
    </section>

    <details className="detail-section"><summary>Calidad y datos faltantes</summary>
      {Object.keys(work.calidadCampos).length ? <dl className="detail-grid">{Object.entries(work.calidadCampos).map(([field, quality]) => <div key={field}><dt>{fieldLabel(field)}</dt><dd>{qualityLabel(quality.estado)}{quality.motivo && <p>{quality.motivo}</p>}</dd></div>)}</dl> : <p>No se informaron evaluaciones de calidad por campo.</p>}
    </details>
    <details className="detail-section"><summary>Procedencia de los datos</summary>
      <p>Cada entrada vincula un campo con su evidencia de origen o una decisión de revisión.</p>
      {Object.entries(work.procedencia).map(([field, provenance]) => <details key={field}><summary>{fieldLabel(field)}</summary><p>Regla aplicada: {provenance.regla} · versión {provenance.version}.</p><ul>{provenance.evidencias.map((evidence, index) => <li key={index}><Evidence evidence={evidence} obraId={work.obraId} /></li>)}</ul></details>)}
      {Object.keys(work.procedencia).length === 0 && <p>No hay referencias de procedencia informadas.</p>}
    </details>
    {(work.educacion.establecimientos.length > 0 || work.nacional || work.municipal || work.participantes || work.contratacion || work.atributosFuente) && <details className="detail-section"><summary>Otros datos informados por las fuentes</summary>
      {work.educacion.establecimientos.length > 0 && <><Heading>Establecimientos educativos</Heading><ReportedFields value={work.educacion} /></>}
      {(["nacional", "municipal", "participantes", "contratacion", "atributosFuente"] as const).map((key) => work[key] && <section key={key}><Heading>{fieldLabel(key)}</Heading><ReportedFields value={work[key]} /></section>)}
    </details>}
    <p className="muted detail-revision">Identificador de obra: <span className="technical-id">{work.obraId}</span>. Revisión {work.numeroRevision}. Versión del catálogo: {work.catalogoVersion}.</p>
  </article>;
}
