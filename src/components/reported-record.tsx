/** @file Ficha y tarjeta de registros informados con dudas visibles, datos desconocidos y evidencia pública congelada. */
import type { ReportedRecordDetail, ReportedRecordSnapshot } from "../api/reported-records";
import { REPORTED_RECORD_TYPES } from "../api/reported-records";
import { publicationDate, safeSourceUrl } from "../lib/presentation";
import { WorkSourceLicenses } from "./work-source-licenses";
import { ReportedRecordCitation } from "./reported-record-citation";
import { reportedRecordCitation } from "../lib/reported-record-export";

/** Avisos de interpretación actuales y advertencias históricas, derivados del contrato generado. */
type ReportedNotice = ReportedRecordSnapshot["advertencias"][number] | Extract<ReportedRecordSnapshot, { version: "registro-informado@2" }>["avisosGenerales"][number];
/** Etiquetas de advertencia; el motivo recibido conserva los límites específicos del registro. */
const warningLabels: Record<ReportedNotice["codigo"], string> = {
  SOURCE_REPORTED: "Informado por la fuente",
  IDENTITY_UNRESOLVED: "Identidad pendiente",
  SEMANTICS_UNREVIEWED: "Interpretación pendiente",
  LOCATION_NOT_PUBLISHED: "Sin ubicación en el mapa",
  POSSIBLE_DUPLICATE: "Posible duplicado",
  FIELD_CONFLICT: "Datos contradictorios",
  CATALOG_TITLE_STATE_DISCREPANCY: "Alcance del catálogo y estados informados",
  CATALOG_AUTHOR_ORGANIZATION_DIFFER: "Autor y organización del catálogo",
};

/** Separa los avisos comunes de interpretación de los problemas específicos, sin atribuir revisión inexistente. */
export function ReportedRecordWarnings({ record, includeGeneral = true }: { record: ReportedRecordSnapshot; includeGeneral?: boolean }) {
  const Heading = includeGeneral ? "h2" : "h3";
  const generalCodes = new Set(["SOURCE_REPORTED", "IDENTITY_UNRESOLVED", "SEMANTICS_UNREVIEWED", "LOCATION_NOT_PUBLISHED"]);
  const findingCodes = new Set(record.version === "registro-informado@2" ? record.hallazgos.map(finding => finding.codigo) : []);
  const specific = record.advertencias.filter(warning => !generalCodes.has(warning.codigo) && !findingCodes.has(warning.codigo));
  const general = record.version === "registro-informado@2" ? record.avisosGenerales : record.advertencias.filter(warning => generalCodes.has(warning.codigo));
  return <>
    {includeGeneral && general.length > 0 && <section className="record-interpretation" aria-label="Cómo interpretar estos datos"><Heading>Cómo interpretar estos datos</Heading>
      <ul>{general.map((warning, index) => <li key={warning.codigo + index}><strong>{warningLabels[warning.codigo]}.</strong> {warning.motivo}</li>)}</ul>
    </section>}
    {record.version === "registro-informado@2" && record.hallazgos.length > 0 && <section className="record-warnings" aria-label="Hallazgos y tratamientos del registro">
      <Heading>Qué se observó y cómo se publica</Heading>
      <ul>{record.hallazgos.map((finding, index) => <li key={finding.codigo + index}>
        <strong>{finding.campo ? "Campo «" + finding.campo + "»" : "Registro"}.</strong> {finding.motivo}
        <p>Tratamiento: {{ PUBLISHED_LITERAL: "Se publica el texto literal.", GENERATED_LABEL: "Se muestra una etiqueta generada, identificada como tal.", FIELD_WITHHELD: "Este campo no se muestra; los demás datos siguen disponibles.", CONTROL_REPLACED: "Se reemplazaron caracteres de control para permitir una lectura segura." }[finding.tratamiento]}</p>
        <p className="muted">Referencia: recurso {finding.recursoId}{finding.columna ? ", columna " + finding.columna : ""}. Código: {finding.codigo}. Política: {finding.politicaVersion}.</p>
      </li>)}</ul>
    </section>}
    {specific.length > 0 && <section className="record-warnings" aria-label="Dudas específicas del registro">
    <Heading>Dudas específicas del registro</Heading>
    <ul>{specific.map((warning, index) => <li key={warning.codigo + index}>
      <strong>{warningLabels[warning.codigo] ?? warning.codigo}.</strong> {warning.motivo}
    </li>)}</ul>
    </section>}
  </>;
}

/** Explica el territorio nominal declarado sin deducir una geometría, gestión o ubicación verificada. */
export function ReportedRecordTerritory({ record }: { record: ReportedRecordSnapshot }) {
  const territory = record.territorio;
  return <p>Territorio informado por la fuente: {territory
    ? [territory.provincia.nombre, territory.partido?.nombre, territory.localidad?.nombre].filter(Boolean).join(" · ")
    : "No informado"}. No acredita una ubicación en el mapa.</p>;
}

/** Distingue un original PDF o HTML y su localizador del JSON de transcripción preservado por el sistema. */
export function ReportedRecordDocument({ record }: { record: ReportedRecordSnapshot }) {
  if (record.version !== "registro-informado@2" || !("documento" in record) || !record.documento) return null;
  const document = record.documento;
  const originalUrl = safeSourceUrl(document.urlOriginal);
  return <section className="detail-section" aria-label="Documento original y sección">
    <h2>Documento original y sección</h2>
    <p>{originalUrl ? <a href={originalUrl} rel="noreferrer">{"formato" in document ? "Consultar página original de la fuente" : "Consultar PDF original de la fuente"}</a> : "Enlace del documento original no disponible."}</p>
    <dl>
      {"pagina" in document && <><dt>{document.paginaFin && document.paginaFin > document.pagina ? "Páginas del PDF original" : "Página del PDF original"}</dt><dd>{document.pagina}{document.paginaFin && document.paginaFin > document.pagina ? `–${document.paginaFin}` : ""}</dd></>}
      {"formato" in document && <><dt>Formato del documento original</dt><dd>HTML · página web</dd></>}
      <dt>Sección informada</dt><dd className="record-literal">{document.seccion}</dd>
      <dt>Huella SHA-256 del documento original</dt><dd className="record-literal">{document.sha256Original}</dd>
    </dl>
    {"formato" in document && <details><summary>Referencia del fragmento en el original</summary><p>Bytes {document.byteStart}–{document.byteEnd}, con final excluido.</p></details>}
    <p>El recurso y la huella de la transcripción identifican el JSON derivado conservado por el sistema. El documento original conserva su propia huella.</p>
  </section>;
}

/** Presenta clase, localizador y citas autorizadas de una unidad de apoyo, con su conteo documental y alcance espacial explícitos. */
export function ReportedRecordSupport({ record }: { record: ReportedRecordSnapshot }) {
  if (record.version !== "registro-informado@3") return null;
  const support = record.apoyo;
  const locator = support.localizador;
  const originalUrl = support.documento?.urlOriginal ? safeSourceUrl(support.documento.urlOriginal) : null;
  const classes: Record<typeof support.unidadFuente, string> = {
    DOCUMENT_FRAGMENT: "Fragmento documental",
    PROCUREMENT_ACT: "Acto de contratación",
    CERTIFICATE: "Certificado",
    AGGREGATE_BUDGET: "Presupuesto agregado",
    ASSET_LOCATION: "Localización de un activo",
    OPERATIONAL_ACTIVITY: "Actividad operativa",
    SERVICE_REQUEST: "Solicitud de servicio",
    VISUAL_ILLUSTRATION: "Ilustración",
    DOCUMENT_CONTEXT: "Contexto documental",
    DOCUMENTARY_ROW: "Fila documental",
    PROPERTY_ACQUISITION_REPORTED: "Adquisición de inmueble informada",
    FINANCIAL_SUMMARY_REFERENCE: "Referencia de resumen financiero",
    OPERATING_EXPENSE_REPORTED: "Gasto operativo informado",
    SPATIAL_WORK_COMPONENT_REPORTED: "Componente espacial informado",
    SPATIAL_LOCATION_RECORD: "Localización informada por la fuente",
  };
  return <section className="detail-section" aria-label="Unidad de apoyo y procedencia">
    <h2>Unidad de apoyo y procedencia</h2>
    <p>Clase documental registrada: <strong>{classes[support.unidadFuente]}</strong>. Este registro se cuenta como una unidad de la fuente. No se afirma una vinculación con una obra.</p>
    {record.tipo === "DOCUMENT_FRAGMENT_RECORD" && <p>El encabezado de contexto y el fragmento forman una sola unidad documental. Su alcance físico sigue pendiente de revisión.</p>}
    {record.tipo === "SPATIAL_SUPPORT_RECORD" && <p>El registro espacial conserva su procedencia para una revisión posterior. Este registro permanece sin punto en el mapa.</p>}
    <dl>
      <dt>Formato del original</dt><dd>{locator.formato}</dd>
      {locator.formato === "PDF" && <><dt>Página del original</dt><dd>{locator.pagina}</dd></>}
      {locator.formato === "CSV" && <><dt>Registro del CSV</dt><dd>{locator.registro}</dd></>}
      {(locator.formato === "XLS" || locator.formato === "XLSX") && <><dt>Fila del original</dt><dd>{locator.fila}</dd><dt>Identificador de hoja (SHA-256)</dt><dd className="record-literal">{locator.hojaSha256}</dd></>}
      {locator.formato === "DOCX" && <><dt>Parte del documento</dt><dd>{locator.parte}</dd><dt>Párrafos del original</dt><dd>{locator.parrafoInicio}–{locator.parrafoFin}</dd></>}
      {support.documento && <><dt>Huella SHA-256 del documento original</dt><dd className="record-literal">{support.documento.sha256Original}</dd></>}
    </dl>
    {originalUrl && <p><a href={originalUrl} rel="noreferrer">Consultar documento original de la fuente</a></p>}
    {support.extractos.map((excerpt, index) => <section key={excerpt.rol}>
      <h3>{excerpt.rol === "HEADING" ? "Encabezado de contexto" : "Fragmento literal"}</h3>
      <blockquote className="record-literal">{excerpt.texto}</blockquote>
      <details><summary>Referencia del extracto {index + 1}</summary><dl>
        <dt>SHA-256 del extracto</dt><dd className="record-literal">{excerpt.sha256}</dd>
        <dt>SHA-256 del texto padre</dt><dd className="record-literal">{excerpt.padreSha256}</dd>
        <dt>Intervalo en el texto padre</dt><dd>{excerpt.desde}–{excerpt.hasta}, con final excluido</dd>
      </dl></details>
    </section>)}
  </section>;
}

/** Explica la fila de oferta y su clave reportada sin presentar una equivalencia con obra, edificio o geometría. */
export function ReportedRecordInstitution({ record, compact = false }: { record: ReportedRecordSnapshot; compact?: boolean }) {
  if (record.version !== "registro-informado@4") return null;
  const Heading = compact ? "h3" : "h2";
  return <section className="detail-section" aria-label="Oferta institucional educativa">
    <Heading>Fila de oferta institucional educativa</Heading>
    <p className="notice">Etiqueta generada por el sistema para identificar esta fila. La denominación institucional informada por la fuente se conserva entre los datos permitidos.</p>
    <p>Una fila informa una oferta educativa en un período. Puede compartir el identificador del establecimiento con otras ofertas. No acredita una obra, edificio intervenido ni una institución nueva.</p>
    <dl className="detail-grid"><div><dt>Identificador de establecimiento informado</dt><dd>{record.institucion.codigo}</dd></div>
      <div><dt>Período de la oferta informado</dt><dd className="record-literal">{record.institucion.oferta.periodo ?? "No informado"}</dd></div>
      {!compact && <><div><dt>Namespace del identificador fuente</dt><dd>{record.institucion.namespace}</dd></div>
        <div><dt>Registro del CSV original</dt><dd>{record.institucion.localizador.registro}</dd></div></>}
    </dl>
    <p>No se afirma una vinculación con una obra. Sin geometría publicada: no aparece en el mapa.</p>
    {record.datos.filter(data => data.estado === "WITHHELD").map(data => <p className="notice" key={data.campo}><strong>{data.etiqueta}: campo no publicado.</strong> {data.motivoLimitacion}</p>)}
  </section>;
}

/** Resume el registro informado sin presentarlo como una obra única ni ofrecer una ubicación no publicada. */
export function ReportedRecordCard({ detail }: { detail: ReportedRecordDetail }) {
  const record = detail.registro;
  if (detail.estado !== "PUBLISHED" || !record) return null;
  return <article className="detail-section record-card">
    <p className="eyebrow">Registro informado · {REPORTED_RECORD_TYPES[record.tipo]}</p>
    <h2><a href={"/registros/" + detail.registroId}>{record.nombre.length > 240 ? Array.from(record.nombre).slice(0, 240).join("") + "…" : record.nombre}</a></h2>
    {record.nombre.length > 240 && <p className="muted">Título abreviado en esta lista. El texto completo está disponible en la ficha.</p>}
    {record.version === "registro-informado@2" && record.nombreGenerado && <p className="notice">Etiqueta elaborada para identificar el registro. Consultá el motivo y su procedencia.</p>}
    {record.version === "registro-informado@3" && <p className="notice">Etiqueta elaborada para identificar el tipo de unidad de la fuente.</p>}
    {record.version === "registro-informado@3" && <p>Unidad de apoyo con procedencia propia. No se afirma una vinculación con una obra.</p>}
    <ReportedRecordInstitution record={record} compact />
    <p>Datos de: <strong>{record.fuente.nombre}</strong></p>
    <ReportedRecordTerritory record={record} />
    <p>Captura de la fuente: {record.fuente.capturadaEn ? <time dateTime={record.fuente.capturadaEn}>{publicationDate(record.fuente.capturadaEn)}</time> : "Fecha no informada"}.</p>
    <ReportedRecordWarnings record={record} includeGeneral={false} />
    <a className="button secondary" href={"/registros/" + detail.registroId}>Consultar registro</a>
  </article>;
}

/** Muestra únicamente la instantánea pública; un retiro no revela datos previamente publicados. */
export function ReportedRecordContent({ detail }: { detail: ReportedRecordDetail }) {
  const record = detail.registro;
  if (detail.estado === "RETIRED" || !record) return <article>
    <h1>Registro retirado</h1>
    <p className="notice">Esta publicación fue retirada. Su contenido anterior no está disponible.</p>
    <p>Motivo del retiro: {detail.motivoRetiro ?? "No informado"}.</p>
  </article>;
  const sourceUrl = safeSourceUrl(record.fuente.urlCatalogo);
  return <article className="reported-record-detail">
    <header className="detail-heading">
      <p className="eyebrow">Registro informado · versión {detail.version}</p>
      <h1 className="record-literal">{record.nombre}</h1>
      {record.version === "registro-informado@2" && record.nombreGenerado && <p className="notice">Etiqueta elaborada para identificar el registro. Consultá el motivo y su procedencia.</p>}
      {record.version === "registro-informado@3" && <p className="notice">Etiqueta elaborada para identificar el tipo de unidad de la fuente.</p>}
      <p>{REPORTED_RECORD_TYPES[record.tipo]}. Datos de: <strong>{record.fuente.nombre}</strong>.</p>
      <p>Este registro reproduce información de la fuente. No acredita una obra única ni una verificación en territorio.</p>
      {record.tipo === "DOCUMENT_REPORT_SECTION" && <p>La sección puede agrupar calles o componentes. El período del informe y su estado literal no acreditan una fecha de ejecución.</p>}
      {record.tipo === "PROCUREMENT_ACT_RECORD" && <p>Este acto informa una etapa de contratación. No acredita inicio, finalización ni una obra independiente.</p>}
      {record.tipo === "SOURCE_CAPTURE_UNIT" && <p>Esta fila conserva un trabajo en vía pública o un trámite relacionado, como una devolución de garantía. Su clasificación y los valores informados requieren interpretación según la fuente.</p>}
      <ReportedRecordWarnings record={record} />
    </header>
    <ReportedRecordInstitution record={record} />
    {record.version !== "registro-informado@3" && <section className="detail-section">
      <h2>Datos informados por la fuente</h2>
      <dl className="detail-grid">{record.datos.map((data, index) => <div key={data.campo + index}>
        <dt>{data.etiqueta}</dt>
        <dd className="record-literal">{data.estado === "WITHHELD" ? record.version === "registro-informado@4" && "motivoLimitacion" in data ? `Campo no publicado. ${data.motivoLimitacion ?? "Motivo no disponible."}` : "Campo no publicado. Consultá el motivo y el tratamiento indicados en los hallazgos." : data.estado === "NOT_REPORTED" || data.valor === null ? "No informado" : data.valor}</dd>
      </div>)}</dl>
      <p>{record.version === "registro-informado@4" ? "Los valores desconocidos no equivalen a cero. El identificador, la oferta y el período son informados por la fuente; no acreditan una identidad jurídica verificada ni una obra." : "Los valores desconocidos no equivalen a cero. El estado o un porcentaje informado no resuelven la identidad de la intervención."}</p>
    </section>}
    <ReportedRecordDocument record={record} />
    <ReportedRecordSupport record={record} />
    <section className="detail-section">
      <h2>Fuente, recurso y fechas</h2>
      <p>{sourceUrl ? <a href={sourceUrl} rel="noreferrer">Consultar catálogo de {record.fuente.nombre}</a> : "Enlace de origen no disponible."}</p>
      <dl>
        <dt>Captura de la fuente</dt><dd>{record.fuente.capturadaEn ? <time dateTime={record.fuente.capturadaEn}>{publicationDate(record.fuente.capturadaEn)}</time> : "Fecha no informada"}</dd>
        <dt>Publicación del registro</dt><dd><time dateTime={detail.publicadoEn}>{publicationDate(detail.publicadoEn)}</time></dd>
        <dt>{"documento" in record && record.documento ? "Recurso de transcripción JSON derivada" : "Recurso fuente"}</dt><dd>{record.fuente.recursoId}</dd>
        <dt>{"documento" in record && record.documento ? "Huella SHA-256 de la transcripción JSON derivada" : "Huella SHA-256 del recurso"}</dt><dd>{record.fuente.sha256}</dd>
      </dl>
      <p>La captura y la publicación no acreditan la fecha de ejecución ni de actualización del dato.</p>
      {record.datos.length > 0 && <details><summary>Referencia de los campos</summary>
        <ul>{record.datos.map((data, index) => <li key={data.campo + index}>{data.etiqueta}: recurso {data.recursoId}, columna {data.columna}.</li>)}</ul>
      </details>}
    </section>
    <section className="detail-section">
      <h2>Ubicación</h2>
      <ReportedRecordTerritory record={record} />
      <p>Sin ubicación en el mapa. Este catálogo de registros no publica geometrías. La fuente o un lugar mencionado no permiten asignar un punto.</p>
      {record.territorio && <details><summary>Referencia del territorio informado</summary><ul>
        <li>Provincia: {record.territorio.provincia.codigo} · {record.territorio.provincia.nombre}.</li>
        {record.territorio.partido && <li>Partido: {record.territorio.partido.codigo} · {record.territorio.partido.nombre}.</li>}
        {record.territorio.localidad && <li>Localidad: {record.territorio.localidad.codigo} · {record.territorio.localidad.nombre}.</li>}
      </ul><p>Columnas de la fuente: {record.territorio.columnas.join(", ")}.</p></details>}
    </section>
    <WorkSourceLicenses work={{
      licenciasFuentes: record.licencias,
      fuentes: [{ codigo: record.fuente.codigo, nombre: record.fuente.nombre, recursoId: record.fuente.recursoId }],
    }} />
    <section className="detail-section" aria-label="Citar y descargar este registro">
      <h2>Citar y descargar este registro</h2>
      <ReportedRecordCitation citation={reportedRecordCitation(detail)} />
      <p><a className="button secondary" href={"/registros/" + detail.registroId + "/descargar?formato=json"}>Descargar JSON del registro</a>{" "}
        <a className="button secondary" href={"/registros/" + detail.registroId + "/descargar?formato=csv"}>Descargar CSV del registro</a></p>
      <p>Las descargas contienen la proyección pública con su referencia y licencias. El JSON conserva el texto literal; el CSV antepone un apóstrofo a valores que podrían interpretarse como fórmulas en una planilla.</p>
    </section>
    <p className="muted detail-revision">Identificador de registro: {detail.registroId}. Versión {detail.version}. Este identificador no es un identificador de obra.</p>
  </article>;
}
