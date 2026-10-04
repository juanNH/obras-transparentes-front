import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { siteUrl } from "../lib/config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: "Obras Transparentes · La obra pública, a la vista", template: "%s | Obras Transparentes" },
  description: "Explorá información de obras públicas, consultá sus fuentes y conocé qué datos están disponibles. Un proyecto en etapa piloto.",
  robots: { index: process.env.SITE_INDEXABLE === "true", follow: true },
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "Obras Transparentes",
    title: "Obras Transparentes",
    description: "Información pública para entender las obras y el territorio.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es-AR">
      <body>
        <a className="skip-link" href="#contenido">Saltar al contenido</a>
        <SiteHeader />
        <main id="contenido" tabIndex={-1}>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
