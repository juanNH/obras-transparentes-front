/** @file Términos estáticos del catálogo informativo basados en su funcionamiento actual, con información del operador incompleta. */
import { pageMetadata } from "../../lib/seo";

/** Describe el alcance informativo de los términos sin habilitar indexación fuera de producción confirmada. */
export const metadata = pageMetadata("/terminos", {
  title: "Términos de uso",
  description: "Alcance informativo de Obras Transparentes, fuentes, límites de los datos y condiciones de uso del sitio.",
});

/** Presenta reglas del piloto sin atribuir una entidad, licencia general o jurisdicción desconocida. */
export default function TermsPage() {
  return <article className="container page-heading prose">
    <p className="eyebrow">Alcance del servicio</p>
    <h1>Términos de uso</h1>
    <p>Estas condiciones explican el alcance de Obras Transparentes, cómo consultar su información y qué límites tener en cuenta al utilizarla.</p>
    <p className="muted">Última revisión: <time dateTime="2026-10-06">6 de octubre de 2026</time>.</p>

    <h2>Un catálogo informativo</h2>
    <p>Obras Transparentes reúne información publicada sobre obras públicas para facilitar su consulta en una lista, un mapa y fichas. El acceso es gratuito y no requiere registro. Es un proyecto informativo en etapa piloto y no es un sitio oficial de los organismos que aportan las fuentes.</p>
    <p>Las fichas no sustituyen expedientes, documentos de contratación, certificaciones de avance ni comunicaciones del organismo competente. Para decisiones que requieran información oficial vigente, consultá la fuente identificada y sus documentos.</p>

    <h2>Fuentes, fechas y límites</h2>
    <p>La cobertura depende de las fuentes incorporadas y no representa todas las obras de una localidad o del país. La fuente que publica un dato puede ser distinta del organismo responsable, ejecutor o financiador de una obra.</p>
    <p>La fecha de publicación de una ficha no reemplaza la fecha del dato de origen ni acredita una actualización de la fuente. Un dato desconocido no equivale a cero, y el porcentaje informado no determina por sí solo el estado de la obra. Revisá la procedencia, las fechas y la precisión disponibles en cada ficha.</p>
    <p>Las obras publicadas sin ubicación aprobada siguen disponibles en la lista y en su ficha, aunque no aparezcan en el mapa. Los avisos de lectura parcial indican límites de la consulta cartográfica; no representan el total del catálogo. Una ubicación orientativa no certifica el sitio ni el alcance exactos de una intervención.</p>

    <h2>Reutilización y créditos</h2>
    <p>Antes de reutilizar datos o documentos, consultá las condiciones de su fuente y conservá la atribución y el contexto que correspondan. Que un contenido sea público no significa que tenga una licencia de redistribución. No se informa una licencia única para todo el catálogo.</p>
    <p>La cartografía base utiliza OpenFreeMap. Los datos de <a href="https://www.openstreetmap.org/copyright" rel="noreferrer">OpenStreetMap y sus colaboradores</a> se ofrecen bajo ODbL; el diseño del esquema OpenMapTiles utiliza <a href="https://github.com/openmaptiles/openmaptiles/blob/master/LICENSE.md" rel="noreferrer">CC BY 4.0</a>. Los <a href="/proyecto#mapa">créditos del mapa</a> distinguen estas licencias de las fuentes de obras.</p>

    <h2>Disponibilidad y uso del mapa</h2>
    <p>La consulta depende del sitio, del catálogo y del proveedor cartográfico. Puede haber interrupciones o respuestas incompletas, que la interfaz señala cuando puede detectarlas. OpenFreeMap no garantiza disponibilidad continua y puede discontinuar su servicio según sus <a href="https://openfreemap.org/tos/" rel="noreferrer">condiciones</a>. La <a href="/mapa?vista=lista">vista de lista</a> permite consultar sin cargar el mapa base.</p>
    <p>Usá los enlaces y filtros respetando la integridad y disponibilidad del servicio. La ubicación personal es opcional; revisá la <a href="/privacidad">política de privacidad</a> antes de buscar en tu zona o compartir un área.</p>

    <h2>Errores y correcciones de los datos</h2>
    <p>Si encontrás una diferencia o un dato desactualizado, contrastalo con la fuente identificada en la ficha. Una actualización en Obras Transparentes no modifica expedientes ni registros oficiales. El sitio público no ofrece un formulario para enviar o publicar correcciones.</p>

    <h2>Marco legal</h2>
    <p>El uso del servicio está sujeto a las normas argentinas que resulten aplicables, entre ellas la <a href="https://www.argentina.gob.ar/normativa/nacional/ley-25326-64790/actualizacion" rel="noreferrer">Ley 25.326 de protección de datos personales</a> y su <a href="https://www.argentina.gob.ar/normativa/nacional/70368/actualizacion" rel="noreferrer">Decreto reglamentario 1558/2001</a>, la <a href="https://www.argentina.gob.ar/normativa/nacional/ley-24240-638/actualizacion" rel="noreferrer">Ley 24.240 de defensa del consumidor</a> y el <a href="https://www.argentina.gob.ar/normativa/nacional/ley-26994-235975/actualizacion" rel="noreferrer">Código Civil y Comercial</a>. Estas condiciones no exigen renunciar a derechos reconocidos por la legislación aplicable.</p>
    <p>El contenido del sitio es informativo y no constituye asesoramiento legal ni una certificación de los datos publicados.</p>

    <h2>Información del operador</h2>
    <p className="notice">Todavía no están informados el nombre o razón social del operador, su domicilio, su identificación fiscal cuando corresponda ni un canal de consultas. Esta información y las condiciones definitivas requieren revisión jurídica antes del lanzamiento público.</p>
    <a className="button" href="/mapa">Explorar obras</a>
  </article>;
}
