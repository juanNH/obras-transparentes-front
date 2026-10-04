# Referencias de ObrasTransparentes

Fecha de consulta y decisión local: **2026-10-03**, zona horaria `America/Buenos_Aires`. Los enlaces externos son fuentes vivas: revisar su estado al tomar una nueva decisión. Este índice conserva procedencia y propósito, no replica documentos completos ni congela sus términos.

## Fuentes del proyecto

| Fuente canónica                                                                                                                        | Uso                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Plan de investigación y desarrollo actualizado](https://docs.google.com/document/d/10czc7316KUOGStEP17yI6iW8eSCgCnk-kOwyh0qu90k/edit) | Alcance, investigación, hipótesis y avances del proyecto. Modificación observada: 2026-10-03 a las 22:10, hora de Buenos Aires.                   |
| [Carpeta de documentación en Google Drive](https://drive.google.com/drive/folders/14Rezn4OgdRz-jX-JOWjBMZeuBMhnbbXM)                   | Ubicar los documentos originales, incluidos normalización y modelo de obras. Leer el documento pertinente antes de trasladar sus reglas a código. |
| [Normalización de datos](https://docs.google.com/document/d/134at08j8tXLs7iiLKL1UmdX-Jdieq-s4dPlGwH9GPjQ/edit)                         | Semántica de importes, fechas, estados y datos desconocidos; consultado en esta etapa.                                                            |
| [Modelo de obras](https://docs.google.com/document/d/1dnX32wzOSXM5769edSRt1MODNLdlyqS9qsiKtFOJ9v8/edit)                                | Estructura y relaciones de la información pública; consultado en esta etapa.                                                                      |
| [Plan local de la etapa 1](etapa-1.md)                                                                                                 | Decisiones y alcance de la base de integración; checklist de validación y pendientes.                                                             |

La instrucción vigente fija NestJS y PostgreSQL/PostGIS. Las referencias genéricas a alternativas de backend no autorizan una reescritura. React/Vite se conserva para backoffice; la [etapa 2](etapa-2.md), autorizada el 2026-10-04, adopta Next.js para el público y documenta verificación actual de OpenFreeMap y sus límites.

El plan registra 557 obras normalizadas de CABA y una ficha publicada de muestra. No se verificó con ello el número de obras publicadas en la API actual ni una cobertura nacional. Al comenzar la etapa 1, el repositorio frontend sólo tenía un `README.md`: no había benchmark móvil, bundle ni UI existente que evaluar.

Normalización y modelo distinguen corte, publicación y medición; las fechas de fuente pueden ser desconocidas. Los decimales se preservan como cadenas donde así lo define el contrato, la moneda desconocida no se completa por suposición y un avance del 100 % no determina por sí solo el estado completado. Consultar los originales para aplicar cada regla en su contexto.

## Contrato local y consumidor

Estos artefactos deben consultarse cuando estén generados en la rama de trabajo:

- `contracts/openapi.json`: contrato exportado por el backend; referencia de rutas, parámetros, entidades y respuestas públicas.
- `contracts/schemas.json`: JSON Schema draft 7 generado desde los mismos esquemas de dominio que OpenAPI, sin rutas ni ejemplos de Swagger. Conserva las tuplas de coordenadas que OpenAPI 3.0 no puede representar exactamente.
- `contracts/examples.json`: ejemplos sintéticos para validar el consumidor, sin valor como muestra de cobertura real.
- `src/api/generated.ts`: tipos generados; no editar manualmente para corregir una diferencia del contrato.
- `src/api/client.ts`: comportamiento del consumidor y validación en ejecución.
- `tools/sync-contract.mjs`: procedimiento de sincronización y generación.
- `tools/dev-proxy.mjs`: acceso local de mismo origen restringido a lectura pública.

Una instantánea OpenAPI sólo acredita el contrato de la revisión del backend de la que se exportó. No acredita el estado de un despliegue remoto ni de sus datos.

## Documentación técnica primaria

| Tema                        | Fuente                                                                                                                                              | Decisión que ayuda a resolver                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| SEO con JavaScript          | [Google Search Central: JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)               | HTML inicial, enlaces rastreables, canonical y respuestas HTTP en landing y fichas.                                    |
| Render y JavaScript cliente | [Next.js: Server y Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)                                     | Mantener el contenido público fuera de una frontera cliente demasiado amplia.                                          |
| Mapa diferido               | [Next.js: lazy loading](https://nextjs.org/docs/app/guides/lazy-loading)                                                                            | Distinguir separación de bundle de descarga sólo cuando se necesita el mapa.                                           |
| Publicación estática        | [Next.js: static exports](https://nextjs.org/docs/app/guides/static-exports)                                                                        | Límites del export estático, rutas generadas y ausencia de ISR en esa modalidad.                                       |
| Frescura de fichas          | [Next.js: revalidación](https://nextjs.org/docs/app/getting-started/revalidating) y [self-hosting](https://nextjs.org/docs/app/guides/self-hosting) | Actualizaciones/correcciones y complejidad de caché en el despliegue elegido.                                          |
| Alternativa con Vite        | [Vite: SSR](https://vite.dev/guide/ssr) y [React Router: render](https://reactrouter.com/start/framework/rendering)                                 | Comparar Next con SSR/prerender mantenido; no asumir que SSR artesanal sea gratuito de mantener.                       |
| Métricas móviles            | [Web Vitals](https://web.dev/articles/vitals)                                                                                                       | LCP, INP y CLS, y evaluación al percentil 75 por dispositivo; complementar con tiempos propios de exploración.         |
| Accesibilidad               | [W3C: WCAG 2.2](https://www.w3.org/TR/WCAG22/)                                                                                                      | Objetivo AA: teclado, foco, semántica, gestos alternativos, controles táctiles y alternativa textual completa al mapa. |
| Geolocalización             | [W3C: Geolocation](https://www.w3.org/TR/geolocation/)                                                                                              | Permiso, tratamiento de errores y privacidad; la decisión de producto exige inicio explícito y alternativa manual.     |
| Motor de mapa               | [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)                                                                                         | Instalación, fuentes, controles, comportamiento cliente y preparación de un prototipo móvil.                           |
| Servicio de mapa propuesto  | [OpenFreeMap](https://openfreemap.org/) y [guía de integración](https://openfreemap.org/quick_start/)                                               | Instancia pública sin cargo por vistas o solicitudes; atribución y opciones de alojamiento.                            |
| Condiciones del servicio    | [OpenFreeMap: términos](https://openfreemap.org/tos/) y [privacidad](https://openfreemap.org/privacy/)                                              | Verificar vigencia, disponibilidad, tratamiento de solicitudes y limitaciones antes del piloto.                        |
| Alternativas de tiles       | [OSMF: política de tiles](https://operations.osmfoundation.org/policies/tiles/)                                                                     | No confundir licencia de los datos OSM con autorización para consumo irrestricto de su servidor público de tiles.      |
| Tipos del consumidor        | [openapi-typescript](https://openapi-ts.dev/introduction)                                                                                           | Generación de tipos desde el contrato; no sustituye la validación en ejecución.                                        |
| Validación en ejecución     | [Ajv: getting started](https://ajv.js.org/guide/getting-started.html)                                                                               | Validar respuestas y ejemplos contra esquemas, separando tipos de comprobación de datos.                               |

## Criterios para reutilizar estas referencias

Separar requisito, hipótesis y evidencia. La exploración accesible, geolocalización opcional y URLs compartibles son requisitos. Las decisiones de Next.js, lista inicial, panel y MapLibre + OpenFreeMap están en etapa 2; no reemplazan validación con datos/dispositivos reales.

La gratuidad por uso de OpenFreeMap no constituye garantía de disponibilidad ni elimina posibles costos de alojamiento propio. Su documentación indica que la instancia pública no ofrece SLA. Conservar la atribución aplicable y diseñar un cambio de proveedor que contemple estilo, fuentes, tiles, sprites y glifos; no asumir que cambiar una única URL siempre alcance.

Consultar las fuentes externas según la tarea. Un cambio del cliente API suele requerir el contrato actual; una decisión de mapa requiere revisar las condiciones actuales del proveedor; una decisión de arquitectura pública requiere la frecuencia real de publicación y mediciones del prototipo. No convertir este índice en una autorización para editar Drive o ampliar la etapa.
