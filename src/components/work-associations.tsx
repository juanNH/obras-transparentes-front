/** @file Asociaciones territoriales y roles institucionales publicados con evidencia de revisión; no infiere relaciones desde territorio o fuente. */
import type { PartyCatalog, WorkDetail, WorkSummary } from "../api/client";
import { INSTITUTIONAL_ROLES, explorerHref } from "../lib/explorer-query";
import { civilDate } from "../lib/presentation";
import { Evidence } from "./work-evidence";

/** Traducciones de niveles institucionales; el nivel no acredita por sí solo gestión municipal de una obra. */
const LEVELS = { MUNICIPAL: "Municipal", PROVINCIAL: "Provincial", NACIONAL: "Nacional", OTRO: "Otro nivel" } as const;

/** Conserva la precisión original del período del rol; una fecha ausente no expresa una vigencia sin límite. */
function roleDate(value: WorkDetail["rolesInstitucionales"][number]["vigencia"]["inicio"]): string {
  if (!value) return "No informada";
  return value.precision === "YEAR" ? `${value.valor} (solo se conoce el año)` : civilDate(value.valor);
}

/** Obtiene únicamente el nombre confirmado en la nómina; una identidad desconocida conserva un texto explícito. */
function partyName(catalog: PartyCatalog | null, partidoId: string): string {
  return catalog?.items.find(party => party.partidoId === partidoId)?.nombre ?? "Partido del padrón no disponible";
}

/** Resume relaciones verificadas de la revisión publicada para tarjetas HTML sin sustituir el territorio reportado. */
export function WorkAssociationSummary({ work, partyCatalog }: { work: WorkSummary; partyCatalog: PartyCatalog | null }) {
  const parties = [...new Set(work.asociacionesEspaciales.map(association => association.partidoId))];
  const municipal = work.rolesInstitucionales.filter(role => role.organizacion.nivel === "MUNICIPAL" && role.organizacion.partidoId && role.rol !== "CONTRATISTA");
  return <div className="work-association-summary">
    <p><strong>Ubicación territorial verificada:</strong> {parties.length ? parties.map(id => partyName(partyCatalog, id)).join(" · ") : "Sin asociaciones publicadas para esta revisión."}</p>
    <p><strong>Gestión municipal verificada:</strong> {municipal.length ? municipal.map(role => `${role.organizacion.nombre} (${INSTITUTIONAL_ROLES[role.rol]})`).join(" · ") : "Sin roles municipales publicados para esta revisión."}</p>
    {work.rolesInstitucionales.length > 0 && <p><strong>{work.rolesInstitucionales.length} {work.rolesInstitucionales.length === 1 ? "rol institucional verificado" : "roles institucionales verificados"}:</strong> {work.rolesInstitucionales.map(role => `${role.organizacion.nombre} (${INSTITUTIONAL_ROLES[role.rol]})`).join(" · ")}. Consultá su evidencia en la ficha.</p>}
  </div>;
}

/** Presenta asociaciones y roles de esta revisión con vigencia/evidencia pública y acceso a sus filtros correspondientes. */
export function WorkAssociations({ work, compact = false, partyCatalog = null }: { work: WorkDetail; compact?: boolean; partyCatalog?: PartyCatalog | null }) {
  const Heading = compact ? "h3" : "h2";
  return <>
    <section className="detail-section work-associations">
      <Heading>Ubicación territorial verificada</Heading>
      <p>Estas asociaciones fueron revisadas y publicadas para esta revisión. El territorio informado por la fuente y los límites visuales del mapa se consultan por separado.</p>
      {work.asociacionesEspaciales.length ? <ul>{work.asociacionesEspaciales.map((association, index) => <li key={`${association.ubicacionClave}:${association.partidoId}:${index}`}>
        <p><strong>{partyName(partyCatalog, association.partidoId)}</strong> · {association.relacion === "INTERIOR" ? "Interior del partido" : "Cruza el límite del partido"}. <a href={explorerHref({ partidoVerificadoId: association.partidoId }, "lista")}>Consultar obras con ubicación verificada en este partido</a>.</p>
        <details><summary>Evidencia de la asociación espacial</summary><dl className="detail-grid">
          <div><dt>Ubicación revisada</dt><dd>{association.ubicacionClave}</dd></div>
          <div><dt>Método</dt><dd>Intersección en PostGIS · {association.evidencia.metodoVersion}</dd></div>
          <div><dt>Límites usados para verificar</dt><dd>{association.evidencia.limitesVersion}</dd></div>
          <div><dt>Decisión publicada</dt><dd className="technical-id">{association.evidencia.decisionId}</dd></div>
          <div><dt>Huella SHA-256 de geometría</dt><dd className="technical-id">{association.evidencia.geometriaSha256}</dd></div>
          <div><dt>Huella SHA-256 de límites</dt><dd className="technical-id">{association.evidencia.limitesSha256}</dd></div>
        </dl></details>
      </li>)}</ul> : <p>No hay asociaciones espaciales verificadas publicadas para esta revisión. Esto no significa que la obra esté fuera de un partido.</p>}
    </section>
    <section className="detail-section institutional-roles">
      <Heading>Roles institucionales verificados</Heading>
      <p>La revisión publica el rol y su evidencia. La fuente que informa una obra, su ubicación y una razón social sin rol no acreditan responsabilidades institucionales.</p>
      {work.rolesInstitucionales.length ? <ul>{work.rolesInstitucionales.map((role, index) => <li key={`${role.organizacion.id}:${role.rol}:${index}`}>
        <p><strong>{role.organizacion.nombre}</strong> · {INSTITUTIONAL_ROLES[role.rol]} verificado · {LEVELS[role.organizacion.nivel]}.</p>
        {role.organizacion.nivel === "MUNICIPAL" && role.organizacion.partidoId && <p>Partido de la organización: {partyName(partyCatalog, role.organizacion.partidoId)}. {role.rol !== "CONTRATISTA" && <a href={explorerHref({ gestionMunicipalId: role.organizacion.partidoId, organizacionId: role.organizacion.id, rolInstitucional: role.rol }, "lista")}>Consultar obras con este rol de gestión municipal</a>}</p>}
        <dl className="detail-grid"><div><dt>Inicio de vigencia del rol</dt><dd>{roleDate(role.vigencia.inicio)}</dd></div><div><dt>Fin de vigencia del rol</dt><dd>{roleDate(role.vigencia.fin)}</dd></div></dl>
        <details><summary>Evidencia del rol verificado</summary><p>Decisión publicada: <span className="technical-id">{role.decisionId}</span>.</p><ul>{role.evidencias.map((evidence, evidenceIndex) => <li key={evidenceIndex}><Evidence evidence={evidence} obraId={work.obraId} /></li>)}</ul></details>
        <p><a href={explorerHref({ organizacionId: role.organizacion.id, rolInstitucional: role.rol }, "lista")}>Consultar obras con esta organización y rol</a></p>
      </li>)}</ul> : <p>No hay roles institucionales verificados publicados para esta revisión. Los roles reportados, si existen, conservan su descripción.</p>}
      <p className="muted">La vigencia corresponde al rol institucional, no al inicio o fin de la obra. Una fecha faltante no acredita una vigencia ilimitada.</p>
    </section>
  </>;
}
