/** @file Estructura común del sitio, metadatos e idioma argentino con tipografías locales y navegación accesible. */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { indexableSiteUrl } from "../lib/config";
import { SOCIAL_DESCRIPTION } from "../lib/seo";
import { MAP_FONT_STYLESHEET } from "../lib/map-style";
import "./globals.css";

const origin = indexableSiteUrl();

/** Metadatos existentes; URLs y Open Graph requieren origen y aprobación de producción. */
export const metadata: Metadata = {
  ...(origin ? { metadataBase: origin } : {}),
  title: { default: "Obras Transparentes · La obra pública, a la vista", template: "%s | Obras Transparentes" },
  description: "Explorá información de obras públicas, consultá sus fuentes y conocé qué datos están disponibles. Un proyecto en etapa piloto.",
  robots: { index: origin !== null, follow: true },
  ...(origin ? { openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "Obras Transparentes",
    title: "Obras Transparentes",
    description: SOCIAL_DESCRIPTION,
    url: origin.href,
  } } : {}),
};

/** Aplica idioma, enlaces de salto, cabecera/pie y tipografías locales a todas las rutas. */
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es-AR">
      <head>
        <link rel="preload" href="/map-fonts/5.3.0/files/noto-sans-latin-400-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/map-fonts/5.3.0/files/noto-sans-latin-700-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="stylesheet" href={MAP_FONT_STYLESHEET} />
      </head>
      <body>
        <a className="skip-link" href="#contenido">Saltar al contenido</a>
        <SiteHeader />
        <main id="contenido" tabIndex={-1}>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
