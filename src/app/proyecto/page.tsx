/** @file Referencia pública de fuentes, roles, colores, alcance del piloto y créditos cartográficos. */
import { pageMetadata } from "../../lib/seo";
import { SourceLegend, SourceSymbol } from "../../components/source-origin";
import { MAP_ORIGINS, type MapOriginCategory } from "../../lib/map-origin";

/** Metadatos de referencia pública sobre fuentes, roles y créditos. */
export const metadata = pageMetadata("/proyecto", {
  title: "El proyecto y los colores del mapa",
  description: "Conocé Obras Transparentes, la referencia visual de sus fuentes de datos y los créditos del mapa.",
});

const flagReferences: { category: MapOriginCategory; description: string; href: string; reference: string }[] = [
  { category: "nation", description: "Celeste de la bandera argentina, oscurecido para que el marcador se distinga sobre el mapa.", href: "https://www.argentina.gob.ar/pais/simbolos/bandera", reference: "Bandera nacional" },
  { category: "caba", description: "Rojo de la cruz de la bandera de la Ciudad. Elegimos ese detalle para diferenciarla del celeste nacional.", href: "https://buenosaires.gob.ar/gcaba_historico/laciudad/simbolos-de-la-ciudad/bandera-de-la-ciudad", reference: "Bandera de la Ciudad" },
  { category: "province", description: "Verde de la mitad inferior de la bandera bonaerense, en un tono oscuro para mejorar el contraste.", href: "https://www.argentina.gob.ar/node/216040", reference: "Bandera bonaerense" },
];

/** Muestra cómo interpretar fuente, roles, colores y mapa sin atribuir autoridad o cobertura no acreditadas. */
export default function ProjectPage() {
  return <article className="container page-heading prose">
    <p className="eyebrow">El proyecto</p>
    <h1>Información pública que se puede entender.</h1>
    <p>Obras Transparentes reúne información publicada sobre obras públicas y facilita su consulta en el mapa, la lista y las fichas. Mostramos la procedencia de los datos y hacemos explícito lo que falta.</p>
    <p className="notice">Estamos en etapa piloto. El catálogo disponible no representa la totalidad de las obras y la cobertura depende de las fuentes publicadas.</p>

    <section id="cobertura">
      <h2>Qué cobertura tiene el catálogo</h2>
      <p>El explorador abre todas las obras publicadas, incluidas las de fuentes de CABA y de Buenos Aires. Los 135 partidos bonaerenses son opciones de búsqueda; el padrón completo no indica que cada partido ya tenga obras publicadas.</p>
      <p>Un original cargado o una propuesta pendiente de revisión todavía no aparece en el catálogo público. Algunas fuentes municipales están preparadas y esperan su carga y revisión. Una publicación sin ubicación aprobada permanece en la lista y la ficha, aunque no tenga un punto en el mapa.</p>
      <p>Los filtros de jurisdicción y partido usan el territorio informado o verificado que esté publicado. Algunas obras tienen ese dato incompleto: podés encontrarlas quitando el filtro territorial o eligiendo su fuente. «Datos de CABA» identifica la fuente y conserva su diferencia con una ubicación territorial verificada.</p>
      <p><a href="/mapa?vista=lista">Ver todas las obras publicadas</a> · <a href="/mapa?fuente=caba-actualizado&vista=lista">Ver publicaciones de la fuente CABA</a></p>
    </section>

    <section id="colores">
      <h2>Por qué usamos estos colores</h2>
      <p>Nación, Ciudad de Buenos Aires y Provincia de Buenos Aires usan tonos inspirados en sus banderas. Las fuentes municipales comparten un tono ocre como referencia de su nivel. Adaptamos los tonos para que se distingan sobre el mapa y el fondo blanco de la interfaz.</p>
      <SourceLegend />
      <ul className="project-color-list">{flagReferences.map(({ category, description, href, reference }) => <li key={category}>
        <strong><SourceSymbol category={category} /><span>{MAP_ORIGINS[category].label}</span></strong>
        <p>{description} <a href={href} rel="noreferrer">{reference}</a>.</p>
      </li>)}<li>
        <strong><SourceSymbol category="municipality" /><span>{MAP_ORIGINS.municipality.label}</span></strong>
        <p>El ocre y el rombo identifican las fuentes municipales en conjunto; no representan la bandera o el escudo de un municipio particular. La ficha conserva el nombre de cada fuente.</p>
      </li></ul>
      <p>Usamos también formas distintas para los puntos y trazos distintos para líneas y áreas. Los grupos con fuentes de distintos niveles se muestran en gris oscuro; la fuente no informada, en gris.</p>
    </section>

    <section id="responsabilidad">
      <h2>Quién publica y quién interviene en la obra</h2>
      <p>«Datos de» identifica la fuente que publica la información. La ubicación de una obra en un municipio no significa que sea una obra municipal. La fuente tampoco determina por sí sola quién la ejecuta o la financia.</p>
      <p>La ficha destaca el área responsable, el ejecutor y los financiadores cuando esos roles están informados. Si no hay un responsable publicado, lo indicamos. Los estados, avances y fechas también se muestran con su contexto.</p>
    </section>

    <section id="mapa">
      <h2>Créditos del mapa</h2>
      <p>El mapa base se sirve mediante <a href="https://openfreemap.org/" rel="noreferrer">OpenFreeMap</a>, con el estilo Liberty. Agradecemos su servicio y su trabajo abierto.</p>
      <ul>
        <li>Esquema cartográfico: <a href="https://openmaptiles.org/" rel="noreferrer">© OpenMapTiles</a>. <a href="https://github.com/openmaptiles/openmaptiles/blob/master/LICENSE.md" rel="noreferrer">Licencia de diseño CC BY 4.0 y licencia del código</a>.</li>
        <li>Datos del mapa: <a href="https://www.openstreetmap.org/copyright" rel="noreferrer">© OpenStreetMap y sus colaboradores</a>, disponibles bajo ODbL.</li>
      </ul>
      <p>Los créditos de OpenMapTiles y OpenStreetMap permanecen visibles junto al mapa. OpenFreeMap permite que su nombre se acredite aquí: su <a href="https://openfreemap.org/#attribution" rel="noreferrer">guía de atribución</a> indica que mostrarlo en el mapa es opcional.</p>
      <p>La cartografía base ayuda a orientarse y es independiente de las fuentes de las obras. Consultá cómo se usa tu ubicación y qué solicitudes recibe el proveedor en <a href="/privacidad">Ubicación y privacidad</a>.</p>
    </section>
    <a className="button" href="/mapa">Explorar obras</a>
  </article>;
}
