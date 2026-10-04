import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div>
          <Link className="footer-brand" href="/">Obras Transparentes<span aria-hidden="true">.</span></Link>
          <p>Información pública para entender el territorio.</p>
        </div>
        <nav aria-label="Navegación del pie de página" className="footer-nav">
          <Link href="/mapa" prefetch={false}>Explorar obras</Link>
          <Link href="/#proyecto">El proyecto</Link>
          <Link href="/#fuentes">Sobre los datos</Link>
        </nav>
      </div>
      <div className="container footer-note">
        <span>Un proyecto en etapa piloto</span>
        <span>Datos con fuente. Faltantes a la vista.</span>
      </div>
    </footer>
  );
}
