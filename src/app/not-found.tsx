/** Explica una ruta/ficha inexistente y ofrece volver al catálogo público. */
/** @file Respuesta de navegación para fichas o rutas públicas inexistentes. */
export default function NotFound() { return <section className="container page-heading"><p className="eyebrow">Página no encontrada</p><h1>No encontramos esta publicación.</h1><p>El enlace puede ser incorrecto o la revisión puede no estar publicada.</p><a className="button" href="/mapa">Explorar el catálogo</a></section>; }
