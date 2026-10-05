/** @file Recuperación de errores de ruta en el navegador sin exponer diagnósticos internos del servidor. */
"use client";
/** Ofrece reintentar el segmento de ruta con reset sin mostrar el mensaje interno de la excepción. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <section className="container page-heading"><h1>No pudimos cargar esta página</h1><p>La información puede estar temporalmente fuera de servicio. Intentá nuevamente.</p><button className="button" onClick={reset}>Reintentar</button> <a href="/mapa">Volver al catálogo</a></section>; }
