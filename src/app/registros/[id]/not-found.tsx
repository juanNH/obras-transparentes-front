/** @file Ausencia de un registro informado sin afirmar ausencia de una obra física. */

/** Ofrece recuperación cuando el identificador no corresponde a una publicación fuente. */
export default function ReportedRecordNotFound() {
  return <section className="container detail-page">
    <h1>Registro no encontrado</h1>
    <p>No encontramos una publicación de registro con este identificador. Esto no demuestra que la intervención no exista.</p>
    <a href="/registros" className="button">Consultar registros informados</a>
  </section>;
}
