import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: { absolute: "Obras Transparentes · La obra pública, a la vista" },
  alternates: { canonical: "/" },
};

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <span className="arrow" aria-hidden="true">{diagonal ? "↗" : "→"}</span>;
}

function TerritoryIllustration() {
  return (
    <div className="territory-illustration">
      <div className="illustration-topline"><span className="small-cross" aria-hidden="true">+</span> Una mirada sobre el territorio <span aria-hidden="true">↗</span></div>
      <svg className="territory-svg" viewBox="0 0 540 420" fill="none" aria-hidden="true" focusable="false">
        <defs>
          <pattern id="territory-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" stroke="var(--color-border)" strokeWidth="0.6" /></pattern>
          <clipPath id="territory-clip"><rect x="0" y="0" width="540" height="420" /></clipPath>
        </defs>
        <g clipPath="url(#territory-clip)">
          <rect width="540" height="420" fill="var(--color-surface-alt)" />
          <rect width="540" height="420" fill="url(#territory-grid)" />
          <path d="M380-30 357 36 387 77 366 123 402 169 383 227 418 265 414 324 478 453H573V-30Z" fill="var(--color-brand-celeste)" fillOpacity="0.45" />
          <path d="m365-10-36 82 28 43-28 58 31 57-9 63 65 140" stroke="var(--color-primary)" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="5 7" />
          <g fill="var(--color-primary-soft)" stroke="var(--color-border-control)" strokeWidth="1">
            <path d="m53 52 74-20 20 61-75 23Z" />
            <path d="m89 179 49-16 23 70-47 16Z" />
            <path d="m146 309 64-23 23 66-64 24Z" />
            <path d="m260 58 57 14-14 61-56-14Z" />
            <path d="m238 193 58-19 24 68-58 20Z" />
          </g>
          <g stroke="var(--color-surface)" strokeWidth="16">
            <path d="m-30 168 343-112M-22 324 383 192M80-30l155 480M237-26 163 418" />
          </g>
          <g stroke="var(--color-border)" strokeWidth="1.4">
            <path d="m-30 160 343-112M-30 176 343-112M-22 316 383 192M-22 332 383 208" />
            <path d="m72-30 155 480M88-30l155 480M229-26l-74 444M245-26l-74 444" />
          </g>
          <path d="m-30 378 390-124" stroke="var(--color-surface)" strokeWidth="7" />
          <path d="m6-30 137 452M316-30l-47 450" stroke="var(--color-surface)" strokeWidth="6" />
          <circle cx="218" cy="201" r="84" fill="var(--color-brand-celeste)" fillOpacity="0.2" stroke="var(--color-primary)" strokeDasharray="4 7" />
          <circle cx="218" cy="201" r="55" stroke="var(--color-primary)" strokeOpacity="0.35" />
          <path d="M218 144c-21 0-38 17-38 38 0 29 38 62 38 62s38-33 38-62c0-21-17-38-38-38Z" fill="var(--color-primary)" />
          <circle cx="218" cy="181" r="13" fill="var(--color-sun)" />
          <path d="M449 47v32M433 63h32" stroke="var(--color-primary)" strokeWidth="1.5" />
          <circle cx="449" cy="63" r="20" stroke="var(--color-primary)" strokeOpacity="0.3" />
          <path d="M45 365v12h76v-12M83 371v6" stroke="var(--color-primary)" strokeWidth="1.5" />
        </g>
      </svg>
      <div className="illustration-label"><span className="illustration-dot" aria-hidden="true" /><span>Del territorio a la información.</span><Arrow diagonal /></div>
      <p className="illustration-caption">Ilustración conceptual. No representa obras publicadas.</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <section className="container hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span className="pilot-dot" aria-hidden="true" /> Información pública, más cerca</p>
          <h1 id="hero-title">La obra pública,<br /><span>a la vista.</span></h1>
          <p className="hero-description">Entender qué se construye también es parte de habitar un lugar. Explorá las obras, conocé sus datos y consultá de dónde vienen.</p>
          <div className="hero-actions">
            <Link className="button" href="/mapa" prefetch={false}>Explorar obras <Arrow /></Link>
            <a className="text-link" href="#proyecto">Conocé el proyecto <Arrow diagonal /></a>
          </div>
          <p className="hero-footnote">Acceso público. Sin registrarte.</p>
        </div>
        <TerritoryIllustration />
      </section>

      <div className="principles-band">
        <div className="container principles-inner">
          <p>Una herramienta para mirar mejor.</p>
          <ul aria-label="Principios del proyecto"><li>Fuentes a la vista</li><li>Información con contexto</li><li>Faltantes explícitos</li></ul>
        </div>
      </div>

      <section className="container how-section" aria-labelledby="how-title">
        <div className="section-intro"><p className="eyebrow">De la pregunta al dato</p><h2 id="how-title">Un recorrido simple.<br />Una mirada más informada.</h2><p>Mapa y resultados comparten la consulta. Elegí una obra para conocer su ubicación o seguir leyendo su ficha.</p></div>
        <ol className="steps-grid">
          <li><span className="step-number" aria-hidden="true">01 /</span><h3>Explorá las obras</h3><p>Recorré el listado o ubicá en el mapa las obras que tienen información geográfica disponible.</p></li>
          <li><span className="step-number" aria-hidden="true">02 /</span><h3>Conocé los detalles</h3><p>Abrí una ficha para consultar el estado informado, la ubicación y los datos disponibles de cada obra.</p></li>
          <li><span className="step-number" aria-hidden="true">03 /</span><h3>Volvé a la fuente</h3><p>Revisá la procedencia y las fechas de los datos. Compartí el enlace de una ficha para seguir la conversación.</p></li>
        </ol>
      </section>

      <section className="project-section" id="proyecto" aria-labelledby="project-title">
        <div className="container project-grid">
          <div><p className="eyebrow">El proyecto</p><h2 id="project-title">La información pública<br />sirve cuando<br /><span>se puede entender.</span></h2></div>
          <div className="project-copy"><p>Obras Transparentes busca acercar la información sobre obras públicas a quienes habitan el territorio: reunir datos, hacer visible su procedencia y facilitar su consulta.</p><p>Una ficha no cuenta toda la historia. Por eso mostramos las fuentes y distinguimos lo que se conoce de lo que todavía falta.</p><div className="pilot-note"><span className="pilot-label">En etapa piloto</span><p>Estamos construyendo esta herramienta. La localidad piloto y su cobertura todavía están por definir. El catálogo disponible no representa la totalidad de las obras.</p></div></div>
        </div>
      </section>

      <section className="container sources-section" id="fuentes" aria-labelledby="sources-title">
        <div className="section-intro"><p className="eyebrow">Leer los datos también importa</p><h2 id="sources-title">Cada dato, con su contexto.</h2><p>Para consultar información pública hace falta conocer tanto su origen como sus límites.</p></div>
        <div className="source-notes">
          <article><span className="source-icon" aria-hidden="true">↗</span><h3>La fuente es el punto de partida</h3><p>La ficha identifica de dónde viene la información. Una fuente de datos no es necesariamente el organismo responsable de la obra.</p></article>
          <article><span className="source-icon" aria-hidden="true">—</span><h3>Un dato faltante no es un cero</h3><p>Si una fecha, un importe o una ubicación no se conocen, lo indicamos. La ausencia de información no permite inferir el avance de una obra.</p></article>
          <article><span className="source-icon" aria-hidden="true">◷</span><h3>Las fechas tienen significado</h3><p>Publicar una ficha no actualiza su fuente. Consultá las fechas disponibles para entender a qué momento corresponde cada dato.</p></article>
        </div>
        <div className="closing-cta"><div><p className="eyebrow">Empezá por lo que hay</p><h2>El territorio, desde otra perspectiva.</h2></div><Link className="button" href="/mapa" prefetch={false}>Explorar obras <Arrow /></Link></div>
      </section>
    </>
  );
}
