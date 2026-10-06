/** @file Metadatos por página sin dominio supuesto; local y staging quedan fuera de indexación. */
import type { Metadata } from "next";
import { indexableSiteUrl } from "./config";

/** Descripción social vigente de las páginas que heredan la presentación general. */
export const SOCIAL_DESCRIPTION = "Información pública para entender las obras y el territorio.";

/** Contenido propio de una página; omitir descripción conserva la heredada del layout. */
type PageMetadataOptions = {
  title: Metadata["title"];
  description?: string;
  index?: boolean;
};

/** Obtiene texto del título de Next sin incorporar la plantilla de marca dos veces. */
function socialTitle(title: Metadata["title"]): string {
  if (typeof title === "string") return title;
  if (title && "absolute" in title && title.absolute) return title.absolute;
  if (title && "default" in title && title.default) return title.default;
  return "Obras Transparentes";
}

/**
 * Conserva títulos/descripciones y emite canonical sólo para una publicación habilitada.
 * @param path Ruta pública sin filtros, revisión ni parámetros de seguimiento.
 * @param options Título y descripción existentes; index=false excluye exploración e historia.
 * @returns Metadatos con noindex por defecto y canonical absoluto sólo para producción.
 */
export function pageMetadata(path: string, { title, description, index = true }: PageMetadataOptions): Metadata {
  const origin = indexableSiteUrl();
  return {
    title,
    ...(description !== undefined ? { description } : {}),
    robots: { index: origin !== null && index, follow: true },
    ...(origin ? {
      alternates: { canonical: new URL(path, origin).href },
      openGraph: {
        type: "website",
        locale: "es_AR",
        siteName: "Obras Transparentes",
        title: socialTitle(title),
        description: description ?? SOCIAL_DESCRIPTION,
        url: new URL(path, origin).href,
      },
    } : {}),
  };
}
