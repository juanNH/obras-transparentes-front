/** @file Respuesta de navegación para fichas o rutas públicas inexistentes. */

/** Ofrece recuperación textual sin JavaScript, incluso cuando la ficha o revisión solicitada no está publicada. */
export default function NotFound() {
  return <section className="container page-heading" aria-labelledby="not-found-title">
    <p className="eyebrow">Error 404 · Página no encontrada</p>
    <h1 id="not-found-title">No encontramos esta página o publicación.</h1>
    <p>Revisá que hayas copiado el enlace completo. La página puede no existir o la obra o revisión solicitada puede no estar publicada.</p>
    <p>Podés volver al catálogo para buscar la ficha actual de una obra.</p>
    <div className="hero-actions">
      <a className="button" href="/mapa">Explorar el catálogo</a>
      <a className="button secondary" href="/mapa?vista=lista">Consultar sólo la lista</a>
      <a className="text-link" href="/">Volver al inicio</a>
    </div>
  </section>;
}
