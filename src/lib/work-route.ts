/** @file Validación común de identidades de ficha para render y comprobación previa; no consulta API ni altera otros parámetros. */

/** Identidades UUID normalizadas de una ficha actual o de una revisión pública exacta. */
export type WorkRoute = { id: string; revisionId?: string };

const uuid = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;

/**
 * Valida obra y revisión con las reglas vigentes; una revisión repetida o inválida no se sustituye.
 * @param id Identidad de obra decodificada por el enrutador.
 * @param revisionId Valor único de revisión, ausente o arreglo de valores repetidos.
 * @returns UUID normalizados, o null sin consultas para un enlace inválido.
 */
export function parseWorkRoute(id: string, revisionId: unknown): WorkRoute | null {
  if (!uuid.test(id) || (revisionId !== undefined && (typeof revisionId !== "string" || !uuid.test(revisionId)))) return null;
  return { id: id.toLowerCase(), ...(typeof revisionId === "string" ? { revisionId: revisionId.toLowerCase() } : {}) };
}
