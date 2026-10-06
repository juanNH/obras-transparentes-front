/** @file Política del sitio público basada en consultas, ubicación voluntaria y servicios efectivamente utilizados. */
import { pageMetadata } from "../../lib/seo";

/** Conserva el título y la descripción heredada; el canonical depende del origen público confirmado. */
export const metadata = pageMetadata("/privacidad", { title: "Ubicación y privacidad" });

/** Explica la consulta pública y la ubicación opcional; identifica la información de privacidad aún incompleta. */
export default function Privacy() {
  return <article className="container page-heading prose">
    <p className="eyebrow">Tu información al consultar</p>
    <h1>Ubicación y privacidad</h1>
    <p>Podés consultar Obras Transparentes sin crear una cuenta. Dar permiso para acceder a tu ubicación es opcional. Esta página explica qué información interviene en la consulta, cuándo se utiliza el mapa y qué información sobre privacidad aún falta confirmar.</p>
    <p className="muted">Última revisión: <time dateTime="2026-10-06">6 de octubre de 2026</time>.</p>

    <h2>Consultar obras y compartir enlaces</h2>
    <p>Los filtros, la lista y las fichas consultan el catálogo público a través del servidor del sitio. Los enlaces pueden incluir filtros, identificadores de obra y revisión, y un área de búsqueda elegida por vos. Esa información puede quedar en el historial de tu navegador y en los registros técnicos de los servicios que atienden la consulta.</p>
    <p>Revisá el contenido del enlace antes de compartirlo. El sitio público no permite publicar comentarios ni cargar archivos; los filtros sólo sirven para consultar información.</p>

    <h2>La lista funciona sin tu ubicación</h2>
    <p>El sitio no pide ubicación al entrar. El botón «Usar mi ubicación» solicita el permiso del navegador. Si lo rechazás, podés seguir explorando la lista o mover el mapa manualmente. Podés gestionar ese permiso desde la configuración de tu navegador.</p>
    <p>La posición se utiliza temporalmente en la página para centrar el mapa. El sitio no la guarda en cookies o almacenamiento local ni la incorpora automáticamente al enlace. Al presionar «Buscar en esta zona», el área seleccionada se envía al catálogo y queda en la URL. Esa área puede revelar una zona cercana a vos, aunque no contenga tu posición exacta.</p>

    <h2>El mapa base usa un servicio externo</h2>
    <p>El explorador abre mapa y resultados juntos. Al cargar el mapa base, el navegador solicita cartografía a OpenFreeMap. El proveedor recibe datos técnicos, como la dirección IP, y puede conocer la zona visualizada, incluso si no usás tu ubicación ni confirmás una búsqueda. Para consultar sin cargar ese servicio, podés entrar directamente a la <a href="/mapa?vista=lista">vista de lista</a>. Las fuentes tipográficas se sirven desde este mismo sitio.</p>
    <p>Según la <a href="https://openfreemap.org/privacy/" rel="noreferrer">política de privacidad de OpenFreeMap</a>, consultada el 6 de octubre de 2026, sus registros normales no incluyen direcciones IP. Los registros de errores pueden incluir IP y URL durante siete días; en incidentes de seguridad puede registrar IP hasta treinta días. También puede utilizar Cloudflare para distribuir la cartografía. Estos plazos corresponden al proveedor, no a los registros de Obras Transparentes.</p>
    <p>Podés consultar las <a href="https://openfreemap.org/tos/" rel="noreferrer">condiciones de OpenFreeMap</a> y los <a href="/proyecto#mapa">créditos del mapa</a>. La lista y las fichas siguen siendo alternativas de consulta si el mapa base no está disponible.</p>

    <h2>Cookies y medición de visitas</h2>
    <p>Esta versión del sitio público no incorpora analítica, publicidad ni cookies de seguimiento. No ofrece cuentas de usuario ni inicio de sesión para consultar obras.</p>

    <h2>Registros y conservación</h2>
    <p>Los servicios que reciben las consultas pueden generar registros técnicos de acceso y errores. Los proveedores de alojamiento, el contenido de esos registros, sus finalidades, quiénes podrán acceder y sus plazos de conservación todavía no están confirmados. No hay un plazo propio de conservación informado.</p>

    <h2>Responsable y consultas</h2>
    <p>La <a href="https://www.argentina.gob.ar/normativa/nacional/ley-25326-64790/actualizacion" rel="noreferrer">Ley 25.326 de protección de datos personales</a> reconoce derechos de acceso, rectificación, actualización y supresión de datos personales, según corresponda.</p>
    <p className="notice">La identificación legal del operador y responsable del tratamiento, su domicilio y un canal para consultas y solicitudes de privacidad aún no están informados. Esta información debe completarse antes del lanzamiento público.</p>
    <p>Consultá también los <a href="/terminos">términos de uso</a> para conocer el alcance del catálogo y sus fuentes.</p>
    <a className="button button-secondary" href="/mapa?vista=lista">Consultar la lista de obras</a>
  </article>;
}
