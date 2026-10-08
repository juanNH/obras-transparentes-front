/** @file Conserva el helper anterior de navegación municipal como enlace limpio al listado de su fuente. */
import type { ListQuery } from "../api/client";
import { sourceListHref } from "../lib/explorer-query";

/** Abre la lista completa de una fuente municipal sin propagar filtros de otra consulta. */
export function municipalSourceHref(_query: ListQuery, fuente: "bahia-obras" | "pergamino-obras" | "olavarria-obras", _view: "lista" | "mapa", _showBoundaries = false): string {
  return sourceListHref(fuente);
}
