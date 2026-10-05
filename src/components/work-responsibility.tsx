import type { WorkDetail } from "../api/client.js";

export function WorkResponsibility({ work, compact = false }: { work: WorkDetail; compact?: boolean }) {
  const Heading = compact ? "h3" : "h2";
  const area = work.municipal?.areaResponsableReportada?.trim();
  const executor = work.nacional?.participantes.ejecutor?.trim();
  const funders = work.nacional?.participantes.financiadores.map(value => value.trim()).filter(Boolean) ?? [];
  const hasReportedRoles = Boolean(area || executor || funders.length);

  return <section className="detail-section work-responsibility">
    <Heading>Responsabilidades informadas</Heading>
    {hasReportedRoles ? <dl className="detail-grid">
      {area && <div><dt>Área responsable reportada</dt><dd>{area}</dd></div>}
      {executor && <div><dt>Ejecutor reportado</dt><dd>{executor}</dd></div>}
      {funders.length > 0 && <div><dt>Financiadores reportados</dt><dd><ul>{funders.map((funder, index) => <li key={index}>{funder}</li>)}</ul></dd></div>}
    </dl> : <p>Responsable no informado por la fuente.</p>}
  </section>;
}
