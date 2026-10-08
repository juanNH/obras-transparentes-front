/** @file Identidad del proyecto y navegación principal del sitio público. */
import Link from "next/link";
import { sourceListHref } from "../lib/explorer-query";

/** Presenta la identidad del proyecto y los accesos principales con navegación semántica. */
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand" href="/" aria-label="Obras Transparentes, inicio">
          <span className="brand-symbol" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M5 26V11l11-6 11 6v15H5Z" stroke="currentColor" strokeWidth="2" />
              <path d="M10 26V14l6-3 6 3v12M16 11v15M5 18h22" stroke="currentColor" strokeWidth="2" />
            </svg>
          </span>
          <span>Obras<span className="brand-second">Transparentes</span></span>
        </Link>
        <nav aria-label="Navegación principal" className="main-nav">
          <Link href="/proyecto" className="nav-project">El proyecto</Link>
          <Link href={sourceListHref("pba-edificios")} prefetch={false}>Provincia</Link>
          <Link href={sourceListHref("nacion-obras")} prefetch={false}>Nación</Link>
          <Link href="/mapa" prefetch={false} className="nav-explore">Explorar obras <span aria-hidden="true">↗</span></Link>
        </nav>
      </div>
    </header>
  );
}
