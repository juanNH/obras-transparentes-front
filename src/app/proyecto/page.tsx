import type { Metadata } from "next";
import { SourceLegend, SourceSymbol } from "../../components/source-origin";
import { MAP_ORIGINS, type MapOriginCategory } from "../../lib/map-origin";

export const metadata: Metadata = {
  title: "El proyecto y los colores del mapa",
  description: "Conocé Obras Transparentes, la referencia de colores inspirada en las banderas y los créditos del mapa.",
  alternates: { canonical: "/proyecto" },
};

const flagReferences: { category: MapOriginCategory; description: string; href: string; reference: string }[] = [
  { category: "nation", description: "Celeste de la bandera argentina, oscurecido para que el marcador se distinga sobre el mapa.", href: "https://www.argentina.gob.ar/pais/simbolos/bandera", reference: "Bandera nacional" },
  { category: "caba", description: "Rojo de la cruz de la bandera de la Ciudad. Elegimos ese detalle para diferenciarla del celeste nacional.", href: "https://buenosaires.gob.ar/gcaba_historico/laciudad/simbolos-de-la-ciudad/bandera-de-la-ciudad", reference: "Bandera de la Ciudad" },
  { category: "province", description: "Verde de la mitad inferior de la bandera bonaerense, en un tono oscuro para mejorar el contraste.", href: "https://www.argentina.gob.ar/node/216040", reference: "Bandera bonaerense" },
  { category: "municipality", description: "Oro del sol del escudo que lleva la bandera de Vicente López, adaptado a un tono oscuro. Esta referencia corresponde a ese municipio; cada municipio tiene sus propios símbolos.", href: "https://legislacion.vicentelopez.gov.ar/digesto-digital/resultados/135", reference: "Bandera de Vicente López · Ordenanza 23450" },
];

export default function ProjectPage() {
  return <article className="container page-heading prose">
    <p className="eyebrow">El proyecto</p>
    <h1>Información pública que se puede entender.</h1>
    <p>Obras Transparentes reúne información publicada sobre obras públicas y facilita su consulta en el mapa, la lista y las fichas. Mostramos la procedencia de los datos y hacemos explícito lo que falta.</p>
    <p className="notice">Estamos en etapa piloto. El catálogo disponible no representa la totalidad de las obras y la cobertura depende de las fuentes publicadas.</p>

    <section id="colores">
      <h2>Por qué usamos estos colores</h2>
      <p>La referencia toma colores de las banderas de los organismos que publican los datos. Adaptamos los tonos para que se distingan sobre el mapa y el fondo blanco de la interfaz.</p>
      <SourceLegend />
      <ul className="project-color-list">{flagReferences.map(({ category, description, href, reference }) => <li key={category}>
        <strong><SourceSymbol category={category} /><span>{MAP_ORIGINS[category].label}</span></strong>
        <p>{description} <a href={href} rel="noreferrer">{reference}</a>.</p>
      </li>)}</ul>
      <p>El sol amarillo oro de Vicente López está descripto en la <a href="https://legislacion.vicentelopez.gov.ar/digesto-digital/resultados/39487" rel="noreferrer">Ordenanza 22820 sobre su escudo</a>.</p>
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
