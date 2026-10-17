/** @file Lista HTML de registros informados, con paginación, advertencias y contadores separados del catálogo de obras. */
import { publicApi } from "../../lib/public-api";
import { pageMetadata } from "../../lib/seo";
import { searchParamsOf } from "../../lib/explorer-query";
import { PublicApiError } from "../../api/client";
import { parseReportedRecordQuery, REPORTED_RECORD_TYPES, reportedRecordsHref } from "../../api/reported-records";
import { ReportedRecordCard } from "../../components/reported-record";
import { ReportedRecordTerritoryFilters } from "../../components/reported-record-filters";
import { INSTITUTION_RECORD_SOURCE, INSTITUTION_RECORD_SOURCE_NAME } from "../../api/reported-institutions";

/** Lee cada página sin caché para preservar retiros y cambios de catálogo. */
export const dynamic = "force-dynamic";
/** Describe el catálogo documental sin presentarlo como un total de obras únicas. */
export const metadata = pageMetadata("/registros", {
  title: "Registros informados por las fuentes",
  description: "Consultá registros publicados con sus fuentes, datos, dudas y límites de interpretación.",
  index: false,
});

/** Entrega filtros GET y enlaces de página utilizables sin JavaScript; nunca mezcla versiones de registros. */
export default async function ReportedRecordsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  let query;
  try { query = parseReportedRecordQuery(searchParamsOf(await searchParams)); }
  catch { return <section className="container detail-page"><h1>Revisá los filtros de registros</h1><p>El enlace contiene un filtro inválido o repetido.</p><a href="/registros" className="button">Reiniciar consulta</a></section>; }
  const api = publicApi();
  const { cursor: _cursor, limit: _limit, ...filters } = query;
  const [records, counts, works, sources, provinces, parties, localities] = await Promise.allSettled([
    api.reportedRecords(query), api.reportedRecordCounts(filters), api.counts({}), api.sourceCoverage(),
    api.provinces(), api.parties(), query.provinciaCodigo ? api.localities([query.provinciaCodigo]) : Promise.resolve(null),
  ]);
  const list = records.status === "fulfilled" ? records.value : null;
  const totals = counts.status === "fulfilled" && list && counts.value.catalogoVersion === list.catalogoVersion ? counts.value : null;
  const sourceOptions = sources.status === "fulfilled" ? sources.value.fuentes.map(source => ({ codigo: source.codigo as string, nombre: source.nombre })) : [];
  sourceOptions.push({ codigo: INSTITUTION_RECORD_SOURCE, nombre: INSTITUTION_RECORD_SOURCE_NAME });
  for (const detail of list?.items ?? []) {
    const source = detail.registro?.fuente;
    if (source && !sourceOptions.some(option => option.codigo === source.codigo)) sourceOptions.push({ codigo: source.codigo, nombre: source.nombre });
  }
  for (const source of totals?.porFuente ?? []) {
    if (!sourceOptions.some(option => option.codigo === source.codigo)) sourceOptions.push({ codigo: source.codigo, nombre: source.codigo });
  }
  if (query.fuente && !sourceOptions.some(source => source.codigo === query.fuente)) sourceOptions.push({ codigo: query.fuente, nombre: query.fuente });
  const restart = reportedRecordsHref(query);
  const changed = records.status === "rejected" && records.reason instanceof PublicApiError && ["CATALOG_CHANGED", "INVALID_CURSOR"].includes(records.reason.code);
  const oversized = records.status === "rejected" && records.reason instanceof PublicApiError && records.reason.code === "RESPONSE_BUDGET";
  const institutional = query.fuente === INSTITUTION_RECORD_SOURCE || query.tipo === "EDUCATIONAL_ESTABLISHMENT_RECORD" || list?.items.some(detail => detail.registro?.version === "registro-informado@4") || totals?.instituciones !== undefined;
  return <div className="container detail-page reported-records">
    <header className="page-heading">
      <p className="eyebrow">Información de las fuentes</p>
      <h1>Registros informados</h1>
      <p>Consultá lo que informa cada fuente, también cuando la identidad o la interpretación siguen pendientes. Los registros pueden describir intervenciones, actos, apoyos u ofertas institucionales; sus unidades no se suman como obras.</p>
      <a href="/registros?provinciaCodigo=06" className="button">Consultar Buenos Aires</a>{" "}
      <a href="/mapa" className="button secondary">Explorar obras publicadas</a>
      <p><a href="/registros?fuente=pba-establecimientos&tipo=EDUCATIONAL_ESTABLISHMENT_RECORD">Consultar el padrón institucional de ofertas educativas</a></p>
    </header>
    <section className="detail-section" aria-label="Conteos de obras y registros">
      <h2>Dos cantidades diferentes</h2>
      <dl className="detail-grid">
        <div><dt>Registros informados con estos filtros</dt><dd>{totals ? totals.totalRegistros : "Cantidad desconocida"}</dd></div>
        <div><dt>Obras publicadas en todo el catálogo de obras</dt><dd>{works.status === "fulfilled" ? works.value.totalPublicadas : "Cantidad desconocida"}</dd></div>
        <div><dt>Partidos con registros informados con estos filtros</dt><dd>{totals ? totals.partidosConRegistros : "Cantidad desconocida"}</dd></div>
        <div><dt>Localidades con registros informados con estos filtros</dt><dd>{totals ? totals.localidadesConRegistros : "Cantidad desconocida"}</dd></div>
      </dl>
      <p>Los registros no se suman a las obras. Publicar un registro no acredita una intervención nueva ni resuelve posibles duplicados.</p>
      <p className="muted">{list ? "Versión del catálogo de registros: " + list.catalogoVersion + "." : "No se pudo leer el catálogo de registros."} {works.status === "fulfilled" ? "Versión del catálogo de obras: " + works.value.catalogoVersion + "." : ""}</p>
      {!totals && list && <p className="notice">Los conteos de registros no están disponibles en el mismo corte. La cantidad es desconocida; no equivale a cero.</p>}
    </section>
    {institutional && <section className="detail-section" aria-labelledby="institution-counts">
      <h2 id="institution-counts">Ofertas educativas y establecimientos informados</h2>
      <dl className="detail-grid"><div><dt>Filas de oferta educativa publicadas con estos filtros</dt><dd>{totals?.instituciones?.filasOfertaPublicadas ?? "Cantidad no disponible"}</dd></div>
        <div><dt>Identificadores distintos de establecimientos informados con estos filtros</dt><dd>{totals?.instituciones?.establecimientosDistintosInformados ?? "Cantidad no disponible"}</dd></div></dl>
      <p>Varias ofertas o períodos pueden compartir un identificador. Estos identificadores reportados no acreditan instituciones nuevas, identidad jurídica verificada, edificios intervenidos ni obras.</p>
      <p>Las filas institucionales ya están incluidas en el total de registros de estos filtros. No se suman de nuevo a registros, obras o edificios escolares finalizados.</p>
      {!totals?.instituciones && <p className="notice">El desglose institucional no fue informado en el mismo corte. La ausencia del desglose no se presenta como cero.</p>}
    </section>}
    <form className="filters" action="/registros" method="get" aria-label="Filtrar registros">
      <label>Fuente<select name="fuente" defaultValue={query.fuente ?? ""}>
        <option value="">Todas las fuentes</option>
        {sourceOptions.map(source => <option key={source.codigo} value={source.codigo}>{source.nombre}</option>)}
      </select></label>
      <label>Tipo de registro<select name="tipo" defaultValue={query.tipo ?? ""}>
        <option value="">Todos los tipos</option>
        {Object.entries(REPORTED_RECORD_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Registros por página<select name="limit" defaultValue={query.limit ?? 25}>
        {[...new Set([10, 25, 50, 100, query.limit ?? 25])].sort((a, b) => a - b).map(limit => <option key={limit} value={limit}>{limit}</option>)}
      </select></label>
      <ReportedRecordTerritoryFilters query={query}
        provinces={provinces.status === "fulfilled" ? provinces.value : null}
        parties={parties.status === "fulfilled" ? parties.value : null}
        localities={localities.status === "fulfilled" ? localities.value : null} />
      <button className="button" type="submit">Aplicar filtros</button>
      <a href="/registros">Quitar filtros</a>
    </form>
    <p className="muted">Los filtros territoriales usan lo informado por la fuente. No asignan ubicaciones ni prueban gestión municipal.</p>
    <section className="record-interpretation" aria-label="Cómo interpretar estos datos">
      <h2>Cómo interpretar estos datos</h2>
      <p><strong>Informado por la fuente.</strong> Se publica información atribuida a su origen. <strong>Identidad pendiente.</strong> Varios registros pueden describir la misma intervención o distintas ofertas de un establecimiento.</p>
      <p><strong>Interpretación pendiente.</strong> La publicación no acredita la revisión individual de cada valor. <strong>Sin ubicación en el mapa.</strong> Los nombres territoriales no permiten asignar un punto.</p>
      <p>Estos avisos generales explican el catálogo. Las dudas concretas y sus motivos acompañan cada registro.</p>
    </section>
    <section aria-labelledby="record-results-title">
      <h2 id="record-results-title">Registros de esta página</h2>
      {!list ? <div className="notice error" role="status"><p>{oversized ? "La página contiene textos completos que superan el límite de lectura. Consultá un registro por página o ajustá los filtros." : changed ? "El catálogo cambió o el cursor ya no es válido. Reiniciá la consulta." : "No se pudieron consultar los registros. Intentá nuevamente."}</p>
        {oversized ? <a href={reportedRecordsHref({ ...query, limit: 1 })}>Consultar un registro por página</a> : <a href={restart}>Reiniciar consulta conservando filtros</a>}</div>
        : list.items.length === 0 ? <p className="notice">No hay registros publicados con estos filtros. Esto no significa que no existan obras.</p>
          : <><p>{list.items.length} registros en esta página. Esta cantidad no es un total de obras.</p><ol className="results-list">{list.items.map(detail => <li key={detail.registroId}><ReportedRecordCard detail={detail} /></li>)}</ol></>}
      {list && <nav className="detail-actions" aria-label="Páginas de registros">
        {query.cursor && <a className="button secondary" href={restart}>Volver a la primera página</a>}
        {list.nextCursor && <a className="button" href={reportedRecordsHref(query, list.nextCursor)}>Página siguiente de registros</a>}
      </nav>}
    </section>
  </div>;
}
