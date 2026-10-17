/** @file Presenta una cobertura compacta por provincia y procedencia, con estados explícitos y enlaces públicos sin área. */
import { SourceCoverageBrowser } from "./source-coverage-browser";
import { REPORTED_RECORD_TYPES, type ReportedRecordCounts } from "../api/reported-records";
import type {
  PublicSourceCode,
  PublicSourceCoverage,
} from "../lib/source-coverage";

/** Agrupa el alcance de las fuentes; sólo muestra cifras verificadas contra el corte actual del listado. */
export function SourceCoveragePanel({
  coverage,
  catalogoVersion,
  stale = false,
  activeSource,
  reportedRecordCounts = null,
}: {
  coverage: readonly PublicSourceCoverage[];
  catalogoVersion: string | null;
  stale?: boolean;
  activeSource?: PublicSourceCode | undefined;
  reportedRecordCounts?: ReportedRecordCounts | null;
}) {
  return (
    <section
      className="source-coverage"
      aria-labelledby="source-coverage-title"
    >
      {stale && (
        <p className="source-coverage-notice" role="status">
          El catálogo cambió durante la consulta. Actualizá para volver a
          comparar las fuentes con el listado.
        </p>
      )}
      <details
        className="source-coverage-overview"
        open={activeSource ? true : undefined}
      >
        <summary>
          <h2 id="source-coverage-title">
            Publicaciones por provincia y fuente
          </h2>
          <span>{coverage.length} fuentes · Consultar cobertura</span>
        </summary>
        <p className="results-footnote">
          Fuentes nacionales, de varias provincias y de cada provincia, incluidos sus
          municipios. Esta agrupación indica el alcance de la fuente; no
          acredita dónde están sus obras ni quién las ejecuta o financia.
        </p>
        <p className="results-footnote">
          Conteos globales de obras; no cambian con filtros, área o
          paginación.{" "}
          {catalogoVersion && !stale ? (
            <>
              Las cifras visibles comparten corte con el listado y las fichas:
              versión <strong>{catalogoVersion}</strong>.
            </>
          ) : (
            "La versión común con el listado no está confirmada; las cifras quedan como desconocidas."
          )}
        </p>
        <p className="results-footnote">
          Una obra puede estar vinculada a varias fuentes: sus cantidades no se
          suman para obtener obras únicas.
        </p>
        <aside className="notice" aria-label="Catálogo separado de registros">
          {reportedRecordCounts ? (
            <>
              <p><strong>{reportedRecordCounts.totalRegistros} registros informados publicados</strong> · catálogo de registros {reportedRecordCounts.catalogoVersion}.</p>
              <p>Estas unidades se cuentan por separado de las obras. Cada catálogo tiene su propia versión.</p>
              <ul>{reportedRecordCounts.porTipo.map((item) => (
                <li key={item.tipo}>{REPORTED_RECORD_TYPES[item.tipo]}: {item.cantidad}</li>
              ))}</ul>
            </>
          ) : <p>No se pudo consultar el conteo de registros informados.</p>}
          <a href="/registros">Consultar el catálogo de registros</a>
        </aside>
        <SourceCoverageBrowser
          coverage={coverage}
          stale={stale}
          activeSource={activeSource}
          reportedRecordCounts={reportedRecordCounts}
        />
        {(stale ||
          coverage.some((source) => source.estado !== "AVAILABLE")) && (
          <a className="button secondary source-coverage-retry" href="">
            Actualizar consulta
          </a>
        )}
      </details>
    </section>
  );
}
