# Etapa 2 · sitio público y exploración móvil

La implementación inicial y la adaptación Canvas fueron autorizadas el 2026-10-04 y correspondieron al PR #2, en `feature/etapa-2-sitio-publico` desde `main`. El recorrido de consulta se actualiza el 2026-10-05 con mapa y lista iniciales, continuidad entre vistas y localización de una obra desde sus resultados. Las decisiones vigentes se describen aquí; los registros de validación anteriores conservan su alcance histórico. Se preservan NestJS/PostgreSQL/PostGIS y el backoffice. En aquella entrega inicial no se modificó Drive ni se publicaron datos o el sitio.

**Corte operativo vigente · 2026-10-07:** E7 sirve catálogo `24`: Bahía Blanca tiene una publicación con ubicación aceptada, Pergamino dos publicaciones sin geometría y Olavarría ninguna publicación. El registro de [visibilidad municipal](#visibilidad-de-las-tres-fuentes-municipales-piloto--2026-10-07) detalla la comprobación real. Los cortes vacíos y los resultados anteriores documentados debajo son históricos.

**Integración anterior comprobada el 2026-10-05:** el PR #5 se fusionó mediante `8848de5` y su CI final pasó; el [cierre de ese PR](#integración-y-corte-operativo-del-pr-5) conserva ese registro. La [entrega de JSDoc y avisos cartográficos](#jsdoc-y-publicaciones-sin-ubicación-en-el-mapa--2026-10-05) documenta las modificaciones y verificaciones locales posteriores. Los builds, ramas y capturas anteriores corresponden a sus respectivas ejecuciones, sin identificar automáticamente el proceso activo o el head actual.

## Requisitos acordados

- Landing explicativa y fichas con HTML inicial, URLs estables, canonical y metadatos sociales.
- Lista textual completa mediante paginación, mapa y filtros sincronizados; sin exigir mapa, WebGL o ubicación personal para consultar obras.
- Mobile-first, control Lista/Mapa y panel de resumen con alternativa a arrastrar. WCAG 2.2 AA como objetivo de verificación.
- Permiso de geolocalización tras acción explícita, rechazo recuperable y control sobre el área compartida.
- Mapa sin cobro por solicitud para el piloto, con degradación visible ante caída del servicio público.
- Respetar desconocidos, fechas, precisión, procedencia, importes exactos y revisiones; ningún dato sintético en el sitio normal.

## Decisiones implementadas y tradeoffs

| Decisión | Beneficio y costo |
| --- | --- |
| Next.js App Router, Node y Webpack | Landing prerenderizada; listas/fichas renderizadas en servidor y rutas de lectura de mismo origen. Agrega un proceso Node separado del backend. Webpack permite `extensionAlias` para conservar el cliente NodeNext existente. |
| Ajv y contrato en servidor | Conserva validación real sin enviar los esquemas al celular. Las rutas públicas agregan un salto HTTP y necesitan límites operativos. |
| Mapa y lista al entrar; lista en HTML del servidor | El territorio y los resultados se leen juntos. El mapa se inicializa con JavaScript y agrega descargas al ingreso; la lista, los filtros y las fichas siguen disponibles sin JavaScript. `vista=lista` permite entrar sólo con resultados y cargar el mapa al elegirlo. |
| OpenLayers Canvas 2D como único motor | Mapa utilizable con WebGL deshabilitado. Conserva OpenFreeMap sin tarifa por solicitud. Procesar vectores/etiquetas sigue consumiendo CPU y memoria; requiere medir dispositivos reales. |
| Búsqueda explícita de área | Sólo «Buscar en esta zona» incorpora el bbox visible y reinicia consulta. Abrir el mapa, moverlo o encuadrar una obra conserva filtros y resultados. Requiere distinguir encuadre visual de área consultada. |
| Vistas mediante estado local e historial nativo | Alternar Lista/Mapa conserva páginas cargadas, selección exacta y cámara en memoria, sin remontar el explorador ni repetir el listado. La primera apertura carga el motor y el GeoJSON; las lecturas completadas se reutilizan dentro de la misma consulta. Cambiar filtros o confirmar área crea otra consulta. |
| Selección cartográfica y resumen separados | Elegir una geometría o «Ver en mapa» destaca la obra sin abrir un modal. La franja de selección muestra nombre y condición de ubicación; «Ver resumen» abre el diálogo nativo. Escape/Cerrar devuelve foco y conserva selección; «Quitar selección» la retira explícitamente. |
| Mesa territorial compacta | Mapa principal y resultados contiguos desde 1000 px, aproximadamente 60/40; en móvil se apilan y ambos permanecen disponibles. Cabecera de consulta, ordinales de lista y señales de selección mantienen el contexto. La lista usa scroll de página y paginación. |
| Sin caché HTTP de datos del catálogo | Evita servir revisiones inconsistentes hasta acordar invalidación con backend. Aumenta lecturas. El estado ya cargado se conserva en memoria durante la consulta; assets con hash se cachean, sin prefetch masivo de teselas ni PWA offline. |
| UUID estable en ficha | No depende de nombres cambiantes. Menos legible que un slug, pero identifica obra/revisión inequívocamente. |
| Error visible por cambio de catálogo | Retira lista/mapa anteriores y ofrece reinicio con filtros. No hace reintentos infinitos ni mezcla versiones. |

React/Vite con SSR requeriría resolver servidor de rutas, metadatos, datos y generación de páginas. Next aprovecha esas convenciones conservando la API; no garantiza automáticamente SEO o velocidad. Referencias: [Server/Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components), [lazy loading](https://nextjs.org/docs/app/guides/lazy-loading), [límites del export estático](https://nextjs.org/docs/app/guides/static-exports).

## Datos, filtros y sincronización

La entrega local del 2026-10-06 agrega asociaciones espaciales y roles institucionales publicados con evidencia, filtros aditivos y un catálogo institucional de lectura independiente. La semántica exacta, los presupuestos y los resultados de verificación están en [asociaciones-obras.md](asociaciones-obras.md). `partidoId` conserva el territorio reportado y los límites `DISPLAY_ONLY` mantienen exclusivamente su uso visual.

Filtros visibles: fuente, estado informado, educación y presencia de ubicación. El valor vacío conserva obras con información faltante. El contrato no permite filtrar específicamente estado desconocido. Fuente no se etiqueta como organismo; no se agregan búsqueda textual, tipo de obra ni conteos/facets inexistentes.

Los filtros se abren con un control nativo «Filtrar obras» y muestran cuántos están activos. Esto evita empujar los resultados debajo de un formulario alto en la primera pantalla móvil; sigue funcionando sin JavaScript.

El par `territorioEsquema=pba.municipio` + `municipioCodigo` funciona en enlaces y se preserva en el formulario, pero no se inventa un selector de municipios sin catálogo de códigos/nombres. No se elige una localidad piloto por inferencia. Sin bbox explícito, el mapa encuadra una vez las primeras geometrías reales cargadas; si el visitante ya movió la cámara, se respeta su navegación. Con catálogo vacío conserva un encuadre argentino orientativo y cartografía visible. Ninguno de esos encuadres declara cobertura territorial.

Lista sin bbox incluye obras sin ubicación. Abrir el mapa conserva esa consulta y no agrega un bbox al enlace. Para leer GeoJSON sin un área confirmada se usa la extensión mundial representable `[-180, -85.051129, 180, 85.051129]`, separada de la cámara y limitada por los presupuestos de páginas, Features, posiciones, bytes y tiempo. Evita excluir silenciosamente las ubicaciones fuera del encuadre argentino; una lectura parcial se informa y no acredita cobertura completa.

Con bbox explícito, listado y GeoJSON consultan sólo obras con geometría aprobada que intersecta esa zona, con enlaces para quitar el área. Ambos usan los mismos filtros y comparan `catalogoVersion` como string. El filtro de obras sin ubicación mantiene su lista, deja la cartografía sin puntos inventados y explica por qué esas obras no se dibujan.

Las tarjetas, fichas y resúmenes identifican la ausencia de ubicación aprobada con «Publicada · Sin ubicación en el mapa», un pin tachado decorativo y una explicación textual. La lista ofrece un aviso con la cantidad cargada y una acción para consultar únicamente publicaciones sin ubicación. Esa acción conserva fuente, estado, sector y municipio, quita bbox/cursor y abre vista lista; una consulta por área explica por qué no puede incluir obras cuya ubicación se desconoce. Las revisiones históricas muestran «Revisión sin ubicación en el mapa». El aviso es informativo y no cambia publicación, calidad ni estado reportado. La etiqueta «Con ubicación en el mapa» expresa disponibilidad de geometría aprobada, sin garantizar que esté dentro de la cámara actual o ya cargada cuando el mapa es parcial.

Cada selección conserva `obraId` y `revisionId` exactos en el enlace, al alternar vistas y al cerrar el resumen. «Ver en mapa» está disponible cuando el listado informa geometría: consulta esa revisión de la ficha, comprueba identidad/versión, toma sólo ubicaciones `ACCEPTED` con geometría y dibuja una capa de selección sujeta al mismo presupuesto. Ajusta la cámara a esa geometría, incluso si queda fuera de la vista o lectura cartográfica actual, sin cambiar filtros, bbox o páginas de resultados. Si la ficha no aporta geometría aprobada o se limita por presupuesto, lo informa sin fabricar ubicaciones. La selección del mapa sigue el mismo recorrido y el resumen se abre por otra acción.

Una ubicación individual agrega `ubicacionId` junto a obra/revisión. El selector conserva foco al recorrer opciones con teclado y no repite la ficha si sólo cambia la ubicación. Atrás/Adelante, recarga, alternancia y resumen de la misma obra preservan ese destino; una ubicación ajena o no aceptada no se sustituye por otra. La condición y precisión quedan visibles junto al nombre; la explicación completa está debajo del canvas, abierta para una ubicación y plegable para varias. La ayuda al pasar el puntero también queda debajo del canvas para no interceptar marcadores; admite recorrer su texto y Escape desde cualquier foco. Se conserva la diferencia entre referencia reportada y supuesto WGS84 aprobado, sin afirmar que un punto orientativo acredita sitio o alcance exactos.

Los indicadores distinguen obras cargadas en lista, obras únicas representadas por los `obraId` del GeoJSON cargado y geometrías recibidas. Las obras cargadas sin ubicación se cuentan desde el listado. Son cantidades de la lectura actual, no totales del catálogo ni cobertura nacional. Una obra puede aportar varias Features y MultiPoint varios puntos; los grupos cuentan puntos. Los ordinales `01`, `02`, etc. son una ayuda visual de la lista cargada, no identificadores oficiales ni números compartidos con marcadores.

El historial nativo modifica sólo la presentación/selección al alternar vistas; Atrás/Adelante restaura esos estados. La cámara y las páginas acumuladas se conservan en memoria durante esa consulta; recargar reconstruye los parámetros y la revisión seleccionada del enlace. La ficha actual se consulta sin revisión; los enlaces de revisión llevan `noindex` y canonical a la actual. UUID inválido/publicación inexistente da 404; backend caído es un fallo recuperable. No se deriva el estado de avance, null no se transforma en cero ni publicación en fecha de fuente.

## Presupuestos y fallas

- Lista: 20 obras por solicitud. «Cargar más» mantiene hasta 100 en el DOM; después ofrece página siguiente nativa para continuar todo el catálogo.
- GeoJSON: 100 Features por página, máximo 5 páginas/500 Features, 10.000 posiciones y 15 segundos por consulta. Catálogo y selección comparten el límite de representación de 500 Features/10.000 posiciones, priorizando la selección y deduplicando la misma obra/revisión/ubicación; si desplaza geometrías del catálogo, se informa mapa parcial. Se conserva o excluye una geometría completa; no se corta, simplifica o inventa.
- BFF: 8 segundos por lectura y 2 MiB de respuesta descomprimida; cancela lectura excesiva. Presupuesto del navegador para un recorrido espacial: 2 MiB; el último chunk puede superar ese valor antes de cancelarse. No es un presupuesto de teselas del proveedor.
- OpenLayers con Canvas 2D, pixel ratio limitado a 2, hasta 8 teselas simultáneas, sin precarga de otros niveles y limpieza de capas/listeners/fetch/observer al cambiar de vista; sólo puntos se agrupan. Líneas/polígonos conservan geometría. Límites y resultados parciales se indican; la lista sigue paginando.
- Fichas se descargan al seleccionar o abrir una revisión, con igual límite de respuesta. Sus geometrías aprobadas alimentan la selección cartográfica; el resumen mantiene la lectura de sus datos. Una proyección pública liviana requiere decisión posterior si la muestra real supera el presupuesto.
- Sitemap: hasta 10 páginas de 200 fichas, 15 segundos totales y versiones consistentes. Devuelve 503 antes que publicar resultado parcial; antes de superar 2.000 fichas, implementar índice/particiones o generación por publicación.
- Rutas de mismo origen limitadas a GET público; sin redirecciones, cookies o autorización hacia NestJS. No exponen rutas administrativas ni datos privados.

## Mapa, privacidad y proveedor

OpenLayers 10.10.0 + ol-mapbox-style 13.5.1 + Liberty de OpenFreeMap reemplazan MapLibre GL como único motor. El renderer Canvas dibuja vectores sin solicitar WebGL/WebGL2. Las capas de obras se inicializan independientemente del proveedor y del catálogo: un catálogo vacío no impide ver la cartografía y una falla del proveedor no impide seleccionar geometrías ya disponibles. `MAP_STYLE_URL` configura estilo; las obras son capas separadas. Se conserva WGS84 en API/URL y se transforma a Mercator exclusivamente dentro del mapa.

El adaptador conserva las huellas de edificios convirtiendo fill-extrusion en fill 2D. ol-mapbox-style usa fuentes web, no los glifos PBF de MapLibre: el build copia Noto Sans 5.3.0 Latin/Latin-ext regular, italic y bold, con licencia OFL, a `/map-fonts/5.3.0/`. Los metadatos del estilo se ajustan para usar ese origen propio; no se descargan fuentes desde Fontsource/jsDelivr. La ruta versionada admite caché inmutable. Cambiar proveedor exige revisar expresiones del estilo, fuentes, sprites, teselas, atribución y privacidad, no sólo una URL. Referencias: [integración oficial](https://openfreemap.org/quick_start/), [renderer Canvas](https://openlayers.org/en/latest/apidoc/module-ol_renderer_canvas_VectorTileLayer-CanvasVectorTileLayerRenderer.html), [fuentes y compatibilidad](https://openlayers.org/ol-mapbox-style/index.html).

Mapa y lista contiguos desde 1000 px; en móvil, mapa seguido de resultados, con un enlace ancla para ir a ellos sin modificar consulta. La vista Lista concentra los resultados y permite volver al mapa conservando contexto. El autoencuadre inicial y la localización de una obra cambian cámara, no filtros. Alturas dvh con fallback vh, orientación horizontal y áreas seguras en el resumen. Controles por botones/teclado y dos dedos para arrastrar; rueda con Ctrl/⌘. Cambios de vista sin animaciones. La atribución del estilo permanece debajo del mapa y fuera del resumen. La compatibilidad del motor no certifica todas las versiones de navegadores ni WCAG AA.

Fuentes consultadas el 2026-10-04: [guía de OpenFreeMap](https://openfreemap.org/quick_start/), [términos del 2026-09-09](https://openfreemap.org/tos/) y [privacidad del 2026-10-04](https://openfreemap.org/privacy/). El servicio se declara gratuito, sin garantía de disponibilidad y puede discontinuarse. No se instala fallback automático a tiles OSM: su [política](https://operations.osmfoundation.org/policies/tiles/) exige uso compatible, no suministro ilimitado. La atribución OpenFreeMap/OpenMapTiles/OpenStreetMap del estilo permanece visible. Autoalojamiento evita tarifa por solicitud pero exige infraestructura/operación; alternativa si el piloto requiere disponibilidad controlada.

Entrar al explorador con su vista inicial de mapa genera solicitudes de cartografía a un tercero al inicializar JavaScript. El enlace `vista=lista` permite consultar resultados antes de abrir el mapa. Las solicitudes transmiten datos técnicos y la zona visualizada, aunque no se pida geolocalización ni se confirme un bbox de consulta. OpenFreeMap declara ausencia de IP en registros normales de acceso; los logs de error pueden conservar IP y URL hasta 7 días, los de incidentes hasta 30 días, y Cloudflare puede procesar solicitudes. La UI enlaza esa política. No se incorpora analítica de terceros.

Geolocalización: sólo botón, sin precisión alta, timeout y alternativa manual. La posición centra en memoria. «Buscar en esta zona» incorpora el área a la URL y la envía al catálogo con aviso previo; copiar enlace es otra acción explícita. Las solicitudes del mapa base ya revelan la zona visualizada. Registros del alojamiento y contacto del operador deben definirse antes del lanzamiento. Referencia: [W3C Geolocation](https://www.w3.org/TR/geolocation/).

## Accesibilidad

HTML semántico, es-AR, skip link, foco visible, controles de al menos 44 px, labels y regiones de estado. Lista paginada/fichas no dependen de canvas ni JavaScript y permanecen junto al mapa en móvil. El mapa tiene controles de dirección/zoom; las obras con ubicación se localizan desde la lista por teclado. «Ver en mapa» lleva foco/contexto a la región cartográfica; la selección se identifica con borde, indicador y texto. «Ver resumen» abre un diálogo nativo con Escape, retorno de foco y botones de tamaño; cerrarlo conserva la obra seleccionada. Movimiento reducido respetado. Referencia: [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

Axe y pruebas de teclado detectan regresiones concretas, no acreditan por sí solas AA. Pendientes NVDA/VoiceOver/TalkBack, zoom/texto ampliado y usuarios con necesidades de acceso en dispositivos reales.

## Estado de otros repositorios y datos

- API `main` y remoto en `85ccfe0`, merge PR #9; contrato público disponible. La adaptación no modifica su código ni publica datos.
- Backoffice limpio en `feature/auth-access-management`, `be8f772`; remoto `main` en `15afba7`. Autenticación todavía no fusionada al verificar; no bloquea lectura pública.
- La instancia inicial en 3000 estaba iniciada con `.env.acceptance.e7`: versión `"0"`, sin publicaciones. Se identificó la diferencia con el entorno habitual `.env` mediante comando del proceso y consultas agregadas `READ ONLY`: desarrollo contiene versión `"2"`, tres obras publicadas y una ubicación Point. Esa ubicación no intersecta el área suministrada para la aceptación. La API vacía no significaba que la base habitual careciera de fichas; verificar instancia y cobertura son comprobaciones distintas. No se carga información ficticia para llenar la zona.

## Registro inicial de validación (anterior a Canvas)

Verificaciones iniciales del 2026-10-04 (Node 24.21.0, npm 11.19.0). Este registro conserva la evidencia histórica con MapLibre; la validación de la adaptación Canvas se encuentra al final.

| Verificación | Resultado |
| --- | --- |
| `npm run build`, `npm run typecheck` | Pasan. Landing/privacidad prerenderizadas; catálogo y fichas renderizados en servidor. |
| `npm test` | 90 pruebas: contrato/aceptación, consultas, presentación exacta, mapas, presupuestos, streaming del navegador y BFF/sitemap. |
| `npm run test:proxy` | 5 pruebas pasan del proxy de diagnóstico existente. |
| `npm run contract:check` | Pasa. Se corrigió comparación LF/CRLF en Windows, sin cambios semánticos del contrato ni edición de snapshots. |
| `npm run test:e2e` | 24/24 pasan en Chromium móvil y escritorio, sin reintentos: datos sintéticos, axe, teclado/foco, mapa funcional, filtros, HTML sin JavaScript, errores, enlaces/historial y geolocalización concedida/denegada. |
| Smoke real OpenFreeMap | Estilo, sprites, teselas, fuentes, worker y módulo compartido responden 200; atribución completa visible; sin errores de página. Catálogo real vacío. |
| Inspección visual | Landing, lista vacía y 404 en 1440/390/360/320 px: 12 capturas sin overflow horizontal. Filtros móviles legibles y colapsados de inicio. |
| `npm audit --omit=dev --audit-level=moderate` | Sin vulnerabilidades conocidas reportadas por npm al verificar. |
| API activa | `api:check` incompleto: versión0 y ausencia de obras/fichas reales. No es un pase de aceptación de datos. |

Casos poblados usan fixtures EJEMPLO SINTÉTICO en servidor separado; no representan cobertura real. Las primeras pruebas detectaron y permitieron corregir streaming/loading que ocultaba la lista sin JavaScript, `maxBounds` mundial de 360° que fallaba con MapLibre 6.12 y clics antes de la hidratación. En aquel motor se usó `renderWorldCopies:false`; Canvas conserva límites de vista y validación de bbox; los botones que dependen de JavaScript se habilitan cuando sus handlers están listos. Formularios y enlaces siguen siendo nativos. No se presenta la ejecución inicial fallida como un pase ni se agregaron sleeps/reintentos para ocultarla.

### Ensayo móvil reproducible

Build `bGObEIT6AlgMrsPfMEpVi`, producción local contra API real vacía. Chromium con viewport390×844, CPU ×4, descarga1,6Mbps/subida750kbps, latencia configurada150ms y caché desactivada. Una muestra fría por ruta:

| Observación | Landing | Lista vacía |
| --- | ---: | ---: |
| LCP | 828 ms | 712 ms |
| CLS | 0 | 0 |
| JavaScript transferido (cabeceras incluidas) | 138.318 B | 145.337 B |
| JavaScript comprimido, cuerpo | 136.218 B | 142.937 B |
| JavaScript decodificado | 456.852 B | 476.414 B |

Cero solicitudes externas/MapLibre/OpenFreeMap/GeoJSON en ambas entradas y cero errores de página. La acción «Copiar enlace» funcionó a los 2,065s desde iniciar otra navegación de laboratorio: cota superior de una acción hidratada, no métrica estándar de interactividad. El runner espera que el botón esté habilitado y reemplaza el portapapeles en ese contexto de prueba.

Reproducir con `node tools/measure-mobile.mjs` sobre `npm start`; JSON y capturas en `artifacts/local-validation/` (salidas locales ignoradas por Git). El backend responde en loopback: este ensayo no modela la latencia de producción, datos poblados, memoria/GPU de teléfonos, INP ni p75. Pendientes medir apertura del mapa y ficha con datos reales representativos, memoria tras alternar vistas y rendimiento en dispositivos modestos.

Pendientes de producto: localidad/fuentes del piloto, responsable/contacto de reportes, estados comparables y política publicación/caché. Técnicos: hosting/dominio HTTPS, retención de logs, muestra real con todas las geometrías/faltantes, redes/dispositivos reales y revisión manual de accesibilidad. Indexación desactivada por defecto.

Objetivos de campo: LCP ≤2,5 s, INP ≤200 ms, CLS ≤0,1 al p75 móvil; además tiempo de abrir mapa/ficha, bytes, consultas y memoria tras alternar. Chromium con CPU/red simulada es laboratorio y no acredita percentiles. Referencia: [Web Vitals](https://web.dev/articles/vitals).

## Aceptación de la adaptación Canvas · 2026-10-04

Se conserva el contrato público de API `85ccfe0`: `contract:sync` y `contract:check` pasan sin cambios semánticos en snapshots/tipos. Las rutas del navegador `/api/public/…` pertenecen a Next; las de Nest son `/api/v1/obras`, `/api/v1/obras/{obraId}` y `/api/v1/obras/geojson`.

### Instancia y datos de desarrollo

Se preservó la instancia E7 en 3000 y se inició desarrollo en 3003, sin worker, migraciones ni publicación de datos. El `.env` local ignorado del frontend apunta a esa API mediante `PUBLIC_API_URL` y `API_ORIGIN`; `README.md` explica cómo reproducirlo. La configuración de identidad comparte la base habitual: no es otro catálogo de obras.

La auditoría acotada hizo 22 GET: catálogo `"2"`, tres obras publicadas, paginación completa de tres páginas con `limit=1`, sin duplicados. Las tres fichas pasan contrato; identidad, revisión y metadatos coinciden con el listado tanto en lectura actual como por revisión. Hay una ubicación `ACCEPTED` Point y dos `OMITTED`; las tres fechas de actualización de fuente son desconocidas, no se reemplazan por fecha de publicación.

El área solicitada devuelve lista y GeoJSON completos vacíos: aceptación espacial **incompleta por ausencia de muestra**, no error del motor ni de sincronización. La consulta amplia acotada termina en una página, con una obra/un Point y coincidencia de IDs/revisiones entre mapa y lista; esa auditoría pasa. Estos datos verifican integración con el entorno de desarrollo, no cobertura representativa del piloto ni autenticidad de las fuentes. El informe agregado está en `artifacts/local-validation/api-dev3003-acceptance.json`, ignorado; no se publican registros, coordenadas o credenciales.

Después de reiniciar Next con esa configuración, otros 11 GET verificaron el BFF de producción local en 3002: listado de tres obras, tres fichas por revisión, lista/GeoJSON del área vacíos, todas respuestas 200 conformes al contrato y coincidentes con la API de 3003. `catalogoVersion="2"` consistente y `Cache-Control: no-store` en lista/GeoJSON. Informe agregado `artifacts/local-validation/api-bff-dev3003-acceptance.json`, ignorado.

### Alcance de la verificación

| Verificación final | Resultado |
| --- | --- |
| Typecheck y build de producción | Pasan; build `EdDwPlBc8hlIRZMoXpvAV`, Node 24.21.0/npm 11.19.0. |
| Unitarias y proxy | 96/96 y 5/5, respectivamente. |
| Contrato | Sync/check pasan; snapshots y tipos sin diferencias semánticas. |
| E2E Chromium escritorio/celular/tablet + WebKit móvil en Windows | 54/54 sobre el build definitivo. |
| E2E Firefox en Linux aislado | 8/8 sobre el mismo build. Firefox de Playwright en Windows no pudo iniciar por un ensamblado del sistema; no se ocultó omitiendo sus pruebas. Imagen oficial Playwright 1.63.0, Node 24.20.0/npm 11.19.0: esa diferencia de patch se registra, no se confunde con el entorno Windows/CI. |
| Smoke Edge / OpenFreeMap | Pasa con WebGL/WebGL2 deshabilitados: tres obras en lista, resumen público y cartografía visible con área sin geometrías. |
| Auditoría de dependencias runtime | `npm audit --omit=dev --audit-level=moderate`: cero vulnerabilidades reportadas al verificar. |
| Integración API/BFF | Tres fichas y revisiones consistentes; muestra espacial amplia pasa, área suministrada sin muestra. |
| Skill y diff | Skill local válida; `git diff --check` sin errores. |

El workflow `Frontend` ejecuta typecheck, unitarias, proxy, build y los 62 E2E en Linux con Node 24.21.0/npm 11.19.0 en cada PR a main. La comprobación contra el exportador del repositorio privado de la API se realiza localmente. Las salidas de los ensayos permanecen en `artifacts/local-validation/`, fuera de Git.

Las pruebas usan mapa/API sintéticos aislados para no depender de disponibilidad externa ni cargar datos en la API activa. Cubren catálogo vacío, puntos/líneas/polígonos, selección/revisión, búsqueda por área, cambios de catálogo, recuperación del proveedor, controles, orientación y alternancia de vistas. WebGL está bloqueado explícitamente; no se emplea SwiftShader para simular compatibilidad. El proveedor real se comprueba por separado con una navegación manual acotada, sin descargar regiones ni teselas masivamente.

El smoke en Edge 154 con WebGL/WebGL2 deshabilitados mostró cartografía y etiquetas de OpenFreeMap, un Canvas, atribución completa y fuentes del mismo origen, sin errores de página ni overflow a 390×844. Las solicitudes externas observadas fueron únicamente a `tiles.openfreemap.org`. Esto acredita ese navegador/configuración y esa muestra de servicio, no todas las versiones de Opera/Edge ni dispositivos físicos.

La medición inicial detectó retención de mapas al alternar vistas: una caché del adaptador guardaba una función creada dentro del efecto React, conservando su contexto; las capas de obras también necesitaban disposición explícita. Una primera fábrica de callback no bastó porque la minificación volvía a unir los contextos. El callback final es un método de prototipo ligado a una instancia pequeña, cuya señal se libera al disponer; además se dispone cada capa/fuente y la colección del mapa. Los snapshots de heap confirmaron ambas cadenas antes de corregirlas. No se modifican internals de la dependencia; se mantiene seguimiento de su caché de estilos al actualizarla. Esta comprobación debe hacerse sobre el build de producción, no sólo en modo dev.

### Laboratorio del build definitivo

Build `EdDwPlBc8hlIRZMoXpvAV`, Chromium 153, 390×844/DPR1, CPU ×4, descarga 1,6 Mbps/subida 750 kbps, latencia 150 ms, caché desactivada y WebGL bloqueado. Una muestra fría por escenario, cartografía sintética y API aislada:

| Escenario | Mapa sintético dibujado desde pulsar Mapa | Mapa y datos listos |
| --- | ---: | ---: |
| Sin geometrías | 1.601 ms | 1.613 ms |
| 18 geometrías | 1.752 ms | 1.765 ms |
| 500 MultiPoint / 10.000 posiciones | 2.075 ms | 2.111 ms |

El mapa agregó 169.596 B de JavaScript comprimido (573.460 B decodificado). El escenario de presupuesto recorrió cinco páginas GeoJSON, 708.148 B. Sus 500 geometrías sintéticas pasan el esquema del contrato y reutilizan identidades de la muestra de 24 obras: es una carga de render, no evidencia de 500 obras ni prueba de rendimiento PostGIS. La intercepción de respuesta no representa el throughput real de esa API.

Diez ciclos mapa/lista con el presupuesto máximo: heap JavaScript tras GC pasó de 6,91 MB a 8,42 MB; luego de 16 segundos de reposo quedó en 8,33 MB. Desde el cuarto ciclo se mantuvo alrededor de 8,0–8,4 MB; diferencia final 1,36 MiB, bajo el límite de regresión de 4 MiB. Cero Canvas en el DOM en todas las muestras de Lista. El arreglo inicial fallido alcanzaba 149,8 MB: no se presenta como una validación exitosa. Este ensayo no mide memoria nativa/Canvas ni acredita ausencia de toda fuga.

Seis layouts pasan: 320×740, 768×1024, 820×1180, 1024×768, 1440×900 y 844×390. Mapa/panel dentro del viewport, sin overflow horizontal, botones de al menos 44 px y lista contigua sólo desde 1000 px; capturas revisadas en móvil, tablet y orientación horizontal. Sin errores de página. La cartografía sintética no incluye el costo de teselas, sprites o fuentes reales; el smoke del proveedor es una comprobación funcional separada, no una medición móvil representativa.

Reproducir con `node tools/measure-map.mjs` después del build; `--memory-only` acota a presupuesto y alternancia. El runner comprueba puertos libres, inicia y cierra únicamente sus procesos, bloquea servicios externos y falla si supera la guarda de memoria. Reporte y capturas: `artifacts/local-validation/map-lab/`, ignorados. Las mediciones no equivalen a LCP/INP/p75 de campo. Persisten las pruebas en equipos modestos, Safari/Chrome móviles físicos y lectores de pantalla antes del lanzamiento.

## Guía de identidad visual · 2026-10-05

Rama `refactor/guia-visual`, creada desde `main` en `7f1ffaa`, coincidente con `origin/main` después de fetch. Se conserva el trabajo local previo en `AGENTS.md` y `next-env.d.ts`.

La [guía visual](guia-visual.md) establece una base clara con blanco y celeste, elegida por el usuario, azul profundo para interacción y dorado puntual. Adapta el Markdown de referencia de Mapbox al uso ciudadano de lista/mapa, filtros, fichas y procedencia. Define tokens semánticos, tipografía, patrones, accesibilidad y puntos de migración del CSS/SVG/Canvas actuales. README y CONTRIBUTING la enlazan para próximos cambios.

Esta entrega es documental: los estilos de la aplicación todavía conservan su paleta anterior. La adopción de los tokens/fuentes y la validación de la UI quedan para su implementación; no se modifican contrato, API, datos ni proveedor cartográfico.

Validación de la guía: 13 pares de contraste sRGB calculados y coherentes con los valores publicados; texto de al menos 4,5:1 y bordes/foco esenciales de al menos 3:1 en los fondos indicados. El texto sobre dorado se ajustó a `#6B4B09` para alcanzar 4,75:1. Los contrastes sobre cartografía/transparencias requieren verificar la composición real al implementar. Comprobación de lectura con Node: 9 enlaces locales existentes, 21 tokens de color coincidentes entre paleta y snippet, variables CSS definidas y bloques Markdown cerrados. `git diff --check` pasa; sin cambios adicionales en los archivos ajenos.

No se vuelven a ejecutar typecheck, tests, build, contrato ni E2E para este cambio de documentación. Los resultados históricos anteriores no acreditan esta futura identidad; al cambiar la UI se aplicará el checklist de la guía y se registrará evidencia nueva, incluida la revisión manual pendiente de accesibilidad.

## Aplicación de la guía visual · 2026-10-05

El usuario autorizó aplicar el tema al frontend en la misma rama `refactor/guia-visual`. La UI ahora usa blanco/celeste, acciones azules y dorado puntual; se conserva la estructura pública, contenido, rutas, filtros y semántica de los datos.

- `globals.css` centraliza los tokens, tipografía, foco con halo, controles, avisos, tarjetas y fichas. Los textos secundarios son de al menos 14 px de referencia, las fichas agrupan campos en superficies claras y los controles mantienen al menos 44 px.
- El layout registra Noto Sans 400/700 y precarga Latin desde los assets existentes del mismo origen. Se conserva Latin-ext, fallback, `font-display: swap` y licencia; sin nuevas dependencias ni fuentes externas.
- La ilustración conceptual utiliza tokens, sin presentar cobertura o publicaciones. La landing reemplaza el bloque oscuro por una sección celeste clara y mantiene las advertencias del piloto.
- `explorer.css` queda legible y acotado al explorador para evitar contaminar otras rutas. Selector adaptable, filtros blancos, acciones claras y panel con áreas seguras, scroll, Escape y retorno de foco.
- Las capas propias de OpenLayers usan una paleta Canvas nombrada: azul, halo blanco y selección más grande/gruesa. No cambia el proveedor, geometrías, presupuestos ni ciclo de vida. El halo añade una pasada de trazo en líneas/polígonos; esta entrega no constituye una nueva medición de rendimiento en dispositivos.

### Verificación del resultado

Build definitivo `soG3nncEfUkGOFCBEm2fD`, Windows, Node 24.21.0/npm 11.19.0.

| Verificación | Resultado |
| --- | --- |
| `npm run typecheck`, `npm run build` | Pasan sobre los cambios completos. |
| `npm test`, `npm run test:proxy` | 96/96 y 5/5 pasan. |
| `npm run contract:check` | Pasa; sin cambios en snapshots ni tipos generados. |
| E2E Chromium escritorio/móvil/tablet y WebKit móvil en Windows | 58/58 pasan sobre el build definitivo, sin reintentos. |
| E2E Firefox en Linux aislado | 8/8 pasan sobre el mismo build, con fixtures propios. Firefox en Windows falla al iniciar (`spawn UNKNOWN`); no se presenta como un pase ni se elimina su proyecto. Imagen Playwright 1.63.0, Node 24.20.0/npm 11.19.0: el patch de Node difiere y npm advierte el requisito de engines. |
| Texto ampliado, foco y alto contraste | Landing/filtros/ficha a 320 px y raíz al 200 %, selección por teclado, colores forzados y movimiento reducido pasan en los E2E Chromium. También axe con el diálogo abierto y carga/origen de Noto Sans. |
| Capturas y layout | Runner aislado verifica landing/lista/ficha a 320, 390 y 1440 px sin overflow; también 320 px con texto ampliado. Genera panel y mapa en esos anchos. Se inspeccionaron landing, lista, panel y selección en alto contraste. |
| OpenFreeMap real, API sintética | Chromium con WebGL deshabilitado: tesela PBF 200, cartografía/etiquetas y capas propias visibles, atribución completa, sin errores de página. Único host externo observado: `tiles.openfreemap.org`. Es un smoke acotado, no aceptación de datos reales. |
| Diff y archivos previos | `git diff --check` pasa. Se preservan `AGENTS.md` y el estado previo de `next-env.d.ts`, que Next regeneró durante los checks; `tsc --noEmit` también pasa después de preservarlo. |

La primera ejecución E2E detectó overflow del selector con texto ampliado en escritorio: se corrigió con límite al contenedor y envoltura, sin ocultar contenido. La revisión visual de colores forzados detectó un backplate blanco del navegador que tapaba «Mapa»: sólo el botón seleccionado usa `forced-color-adjust: none`, manteniendo colores del sistema Highlight/HighlightText. La nueva prueba de Canvas también necesitó un bbox dentro de su cartografía sintética; se corrigió el área del fixture y se conservó el chequeo de píxel pintado. La ejecución definitiva pasa; las fallas iniciales no se contabilizan como pases.

Capturas, script de preview y reporte agregado quedan en `artifacts/local-validation/theme/` y `artifacts/local-validation/theme-preview.mjs`, ignorados por Git. El runner sólo usa API sintética separada y cierra su servidor Next; no carga datos ni modifica la API activa. Se cierra también la API sintética al finalizar la comprobación.

Pendientes: zoom nativo/espaciado personalizado, NVDA/VoiceOver/TalkBack, dispositivos físicos, rendimiento con teselas/datos representativos y contraste de todas las combinaciones cartográficas. Las verificaciones de laboratorio y axe no certifican WCAG AA por sí solas. Sin commit, push ni publicación del sitio en esta entrega.

## Validación del nuevo recorrido territorial · 2026-10-05

Build integrado `-tzjReUwJCt9O9j5NI_Cg`, rama `refactor/guia-visual` desde main, Node 24.21.0/npm 11.19.0 en Windows. La modificación agrega mapa y resultados iniciales sin filtro espacial implícito, autoencuadre de geometrías reales y selección cartográfica separada del resumen. La cabecera se compacta; el mapa precede a las acciones de búsqueda y ayuda en móvil, y la selección muestra nombre/condición/precisión antes de su geometría. La explicación completa queda debajo del canvas. Se integraron y preservaron los cambios de CRS y calidad del chat «Revisar circuito de aprobación», coordinados con autorización del usuario. La guía visual v2 recoge estos patrones para componentes futuros.

| Verificación | Resultado |
| --- | --- |
| Typecheck, build y TypeScript después de preservar archivos previos | Pasan. |
| Unitarias y proxy | 120/120 y 5/5 pasan; consultas sin bbox implícito, seis tipos de geometría aprobada/revisión exacta, calidad de ubicación y presupuesto compartido con omisiones completas. |
| Contrato | `contract:check` pasa; snapshots y tipos generados sin cambios. |
| E2E en Windows | 80/80: Chromium escritorio/móvil/tablet y WebKit móvil, fixtures aislados y WebGL deshabilitado, sin reintentos. |
| Firefox en Linux aislado | 8/8 sobre el mismo build. Se conserva el proyecto Firefox; la limitación de inicio en Windows está documentada en el registro anterior. Imagen Playwright 1.63.0, Node 24.20.0/npm 11.19.0; npm advierte el patch de Node distinto del requerido. |
| Continuidad territorial | 20 resultados iniciales con faltantes; 24 después de paginar permanecen al alternar. Vista, cursor, obra y revisión compartibles; un mapa vacío no oculta la lista. «Ver en mapa» usa la ficha exacta aunque no esté en las geometrías cargadas y vuelve a encuadrarla sin nueva consulta de área. |
| Cámara y foco | Centro y escala equivalentes al alternar después de seleccionar, acercar y desplazar. «Quitar selección» lleva foco al mapa antes de desmontar la franja; resumen con Escape/retorno de foco y selección persistente. |
| Ubicación exacta y ayuda | Selector por teclado conserva foco entre opciones. Obra/revisión/ubicación y filtros persisten con historial, recarga, alternancia y resumen de tarjeta. Click desde consulta sin selección identifica el punto; una ubicación ajena no obtiene geometría sustituta. Ayuda recorrible con puntero y Escape desde otro control. |
| Accesibilidad y alternativa textual | Axe en páginas/diálogo/mapa, teclado, 320 px con texto al 200 %, colores forzados y movimiento reducido pasan. Lista/fichas/paginación continúan sin JavaScript, con estado de mapa pendiente veraz. |
| Inspección visual | Explorador y selección en 320/390/1440 px, sin overflow ni errores de página. Ayuda colapsable y acciones debajo de la cartografía evitan empujar las ubicaciones fuera de la entrada móvil. |
| Proveedor real y API sintética | PBF 200, cartografía y capas propias visibles, atribución, carga de base completada sin aviso de fallo y sin errores de página. Único host externo observado: `tiles.openfreemap.org`. |
| Alternancia/memoria | `measure-map --memory-only`: 500 MultiPoint/10.000 posiciones, diez ciclos, cero Canvas en cada muestra de Lista. Heap JS tras GC de 7.852.316 a 9.194.908 B después de 16 s de reposo: crecimiento 1,28 MiB, bajo guarda de 4 MiB. Sin errores de página. |

La primera ejecución detectó un `aria-label` sin rol válido en el contenedor de atribución cuando falla el proveedor; se agregó `role="group"` y los checks pasan. La revisión detectó que reencuadrar la selección al remontar perdía la cámara: la restauración conserva centro/zoom sin padding ni el máximo de zoom usado para ubicar una obra. Se agregaron pruebas de cámara y foco sin relajar verificaciones. Los fallos iniciales no se contabilizan como pases.

La integración de ubicaciones detectó pérdida de foco del selector y pérdida de `ubicacionId` al abrir el resumen de la misma tarjeta; se corrigieron ambos recorridos y se verifican con teclado e historial. Firefox expuso una ayuda flotante que interceptaba el marcador: se trasladó debajo del canvas, conservando lectura con puntero y Escape global. Los tests nuevos también requerían leer sólo la calidad mostrada, sin incluir las opciones no seleccionadas del combobox, y usar hover del locator que desplaza el canvas a pantalla después de insertar la franja. La ejecución definitiva de 88 casos pasa sin reintentos. Las corridas anteriores fallidas o interrumpidas por builds paralelos no se presentan como pases.

Reportes y capturas locales: `artifacts/local-validation/orientation/`, runner `orientation-preview.mjs`, y `map-lab/report.json`, ignorados por Git. Los runners usan API sintética, comprueban/cierran sus propios procesos y no publican datos ni modifican la API activa. Se preservan los cambios previos de `AGENTS.md`/`next-env.d.ts`. No se hizo commit, push ni publicación del sitio.

Estos 88 E2E y el laboratorio no certifican WCAG AA, memoria nativa/Canvas, ausencia de toda fuga ni percentiles de campo. La entrada con mapa agrega su descarga/proveedor automáticamente; `vista=lista` conserva la alternativa diferida. Siguen pendientes lectores de pantalla y dispositivos físicos, rendimiento con cartografía/datos representativos y aceptación de cobertura/datos reales con los límites ya documentados.

## Ubicaciones derivadas de un domicilio · 2026-10-05

Rama `feature/ampliar-datasets` desde `origin/main` en `df3aadc`. Se sincronizó el contrato público mediante `contract:sync`, sin editar tipos o esquemas generados a mano ni acceder a la base de datos. El contrato admite `origenGeometria: ADDRESS_GEOCODE` en la ubicación de la ficha y en la calidad de la Feature, junto con CRS de fundamento `OFFICIAL_SERVICE` y condición `SERVICE_REFERENCE`. El informe administrativo `geocodificacionDireccion` y la corroboración privada de CRS quedan fuera de la respuesta pública.

La presentación compartida de ficha, tooltip y selección muestra «Domicilio geocodificado · ubicación orientativa». Explica que la fuente no informó coordenadas, Georef obtuvo el punto desde la dirección y su precisión no está verificada; no acredita el sitio exacto ni el alcance de la obra. EPSG:4326 representa la salida del servicio, no una declaración de CRS del dataset original. El consumidor conserva el enum de precisión sin usarlo para llamar «coordenada reportada» al dato derivado. `detailMapFeatures` lleva el origen a la calidad cartográfica y la partición conserva obra, revisión y ubicación junto a otras ubicaciones reportadas. Las ubicaciones anteriores sin este campo opcional conservan su presentación.

Se mantiene el presupuesto de **500 geometrías completas, cinco páginas, 10.000 posiciones, 2 MiB y 15 segundos**. Explorer reutiliza la constante existente de límite de geometrías. No se modifican el ciclo de vida de OpenLayers, sus capas, proveedor, estilos o tratamiento de la cámara. La ampliación a otro presupuesto requiere validación propia antes de incorporar más geometrías; esta entrega no aumenta el límite ni recorta partes de una geometría para hacerla caber.

### Verificación de este cambio

Build de producción `ZXyvSF89z0rImwE7aic8R`, Windows, Node 24.21.0/npm 11.19.0.

| Verificación | Resultado |
| --- | --- |
| `npm run typecheck`, `npm run build` | Pasan. |
| `npm run contract:sync`, `npm run contract:check` | Pasan; exportación oficial sin BD y tipos/esquemas sincronizados con el backend. |
| `npm test`, `npm run test:proxy` | 128/128 y 5/5 pasan. Incluyen origen opcional, precisión conservada, múltiples ubicaciones, selección exacta, ficha SSR y rechazo de informes administrativos por el esquema público. |
| E2E de calidad Chromium escritorio y móvil | 12/12 pasan sin reintentos, con API/cartografía sintéticas aisladas y WebGL deshabilitado. Verifican teclado/foco, toque, tooltip, resumen, HTML de ficha, BFF, historial y ausencia de overflow horizontal. |
| Capturas | Se revisaron selección derivada en escritorio y móvil: etiqueta completa visible fuera del select, explicación y referencia legibles, controles utilizables y geometría conservada. |
| Diff | `git diff --check` pasa. |

La Obra 05 del servidor de pruebas representa un domicilio geocodificado **sintético**, para verificar la ficha SSR y el BFF desde el mismo contrato; no se agrega una publicación a la API activa. Los fixtures de interacción comprueban además varias ubicaciones de la misma revisión con calidades diferentes. Capturas y salidas: `artifacts/local-validation/address-geocode-e2e/`, ignoradas por Git. Los servidores del runner se cierran al finalizar.

Estas pruebas acotadas no sustituyen la conciliación de datos reales, la revisión manual de lectores de pantalla ni la aceptación en dispositivos físicos. La medición de memoria anterior se conserva como antecedente de su build: no se repite ni se atribuye como medición del cambio de textos y contrato, que mantiene el ciclo de vida del mapa. Sin commit, push o despliegue externo en esta entrega.

### Aceptación de las cuatro sucesoras reales · catálogo 20

Sobre el mismo build `ZXyvSF89z0rImwE7aic8R`, se verificaron por lectura anónima las cuatro obras CABA efectivamente publicadas con domicilio derivado: Ramsay 2250, Camargo 725, 2 de Abril de 1982 6950 y Curapaligüe 1150. Las fichas API/BFF coinciden en obra, revisión y ubicación vigentes; los cuatro puntos aparecen en el GeoJSON con el mismo origen `ADDRESS_GEOCODE`, geometría, referencia de servicio y precisión conservada. Las respuestas pasan el contrato oficial y excluyen `candidata`, `geocodificacionDireccion` y `corroboracionCrs` administrativos.

El GeoJSON API/BFF coincide página por página: **cinco páginas completas, 483 geometrías y 481 obras representadas**, catálogo 20 y sin cursor pendiente. La reconciliación del entorno registra 709 obras públicas y 228 sin geometría; siguen disponibles en lista y ficha. El presupuesto de 500 geometrías/cinco páginas conserva capacidad para este corte y no se amplió.

Ocho recorridos en Chrome local —las cuatro obras a 1440×1000 y 390×844 con toque emulado— pasaron sin mocks de API ni cartografía: marcador y mapa base real cargados, tag orientativo, explicación/referencia, ficha textual, selección exacta por obra/revisión/ubicación, ausencia de lectura parcial, errores de página y overflow horizontal. Se revisaron las capturas representativas de escritorio y móvil. La espera final comprueba que «Cargando mapa base…» desaparezca antes de capturar; una primera captura tomada durante la carga no se utiliza como prueba de cartografía completa.

La primera consulta del harness enviaba `limit=500` al BFF; éste lo rechaza porque controla el tamaño de página. Se corrigió el harness para recorrer la paginación normal API/BFF, conservando las restricciones de la aplicación. La corrida final pasa y ese rechazo inicial no se presenta como defecto ni como pase.

Reporte, runner reproducible y ocho capturas reales: `artifacts/local-validation/address-geocode-live/`, ignorados por Git. Estas comprobaciones no mutan publicaciones ni reinician servidores, no solicitan geolocalización y no equivalen a dispositivos físicos, lectores de pantalla, mediciones de campo o precisión topográfica. Las cinco consultas adicionales de domicilios sólo en títulos CABA/descripción Nación resultaron ambiguas y no agregaron puntos; esa revisión de fuentes se registra en la API y documentación central. Sin commit, push ni despliegue externo.

## Identificación de fuente en el mapa · 2026-10-05

Rama `fix/colores-fuente-obras` creada desde `main`. Las geometrías aprobadas usan el código de `fuentes` que entrega el GeoJSON; el nivel no se deduce del territorio de la obra. Por pedido del usuario, la paleta se inspira en las banderas: Nación (`nacion-obras`) celeste oscuro/círculo `#0077A8`; CABA (`caba-actualizado`) rojo de su cruz/cuadrado `#B42332`; Provincia de Buenos Aires (`pba-edificios`) verde/triángulo `#287A3A`; Municipio · Vicente López (`vl-obras`) oro de su sol/rombo `#946800`. Los tonos son decisiones de diseño para contraste, no valores oficiales. Las fuentes conocidas de más de un nivel usan gris azulado/hexágono; una fuente vacía, gris/círculo. Líneas y polígonos conservan el color y diferencian contornos con guiones. Los grupos homogéneos comparten color; los de varias categorías usan el símbolo mixto. Seleccionar aumenta tamaño y grosor con un doble halo azul, manteniendo visible el color interior.

La leyenda se ubica arriba de la consulta en ambas vistas; las tarjetas, la franja de selección, el tooltip y la ficha muestran una marca común de color/forma con «Datos de». El color identifica quién publica los datos. La ficha destaca `municipal.areaResponsableReportada`, `nacional.participantes.ejecutor` y `nacional.participantes.financiadores` si existen; el responsable faltante se explicita. No se infiere rol desde territorio, jurisdicción o razón social. La lista y el GeoJSON no informan responsables. Actualmente el catálogo municipal corresponde a Vicente López; cualquier nueva fuente requiere incorporarse al mapeo explícito. Los colores sólidos de los marcadores y la leyenda, medidos contra blanco, tienen contraste de 4,95:1 a 10,35:1; los rellenos translúcidos y las teselas no están cubiertos por ese cálculo.

`/proyecto`, accesible desde navegación y footer, explica banderas, roles, cobertura piloto y créditos cartográficos. Fuentes primarias consultadas el 2026-10-05: [bandera nacional](https://www.argentina.gob.ar/pais/simbolos/bandera), [bandera CABA](https://buenosaires.gob.ar/gcaba_historico/laciudad/simbolos-de-la-ciudad/bandera-de-la-ciudad), [bandera bonaerense](https://www.argentina.gob.ar/node/216040), [Ordenanza 23450 de Vicente López](https://legislacion.vicentelopez.gov.ar/api/pdf/135) y [Ordenanza 22820 sobre su escudo](https://legislacion.vicentelopez.gov.ar/api/pdf/39487).

Se omite únicamente el enlace opcional OpenFreeMap en el crédito resuelto desde TileJSON; los demás créditos y su dinámica por encuadre se conservan. La [guía oficial de OpenFreeMap](https://openfreemap.org/#attribution) permite omitir esa marca. [OpenMapTiles](https://github.com/openmaptiles/openmaptiles/blob/master/LICENSE.md) exige crédito visible/enlace y [OSMF](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines) indica atribución del dato y licencia: ambos siguen visibles junto al mapa. OpenFreeMap queda acreditado en `/proyecto#mapa`, sin cambiar proveedor ni solicitudes externas. Esta decisión actualiza la atribución completa registrada en la verificación inicial del 2026-10-04.

La discrepancia local provenía de dos servidores en 3002: producción antigua en `127.0.0.1` y desarrollo en IPv6/`localhost`. Se detuvo sólo el proceso antiguo; ambas direcciones ahora sirven el frontend de desarrollo actualizado. La API no se reinicia ni se modifica.

### Verificación

| Verificación | Resultado |
| --- | --- |
| `npm run typecheck`, `npm test`, `npm run build` | Pasan; 144 pruebas unitarias. |
| `npm run contract:check` | Pasa; no se modifica el contrato ni sus archivos generados. |
| E2E con fixtures aislados y WebGL deshabilitado | 100/100 pasan en Chromium escritorio, Chromium móvil, Chromium tablet y WebKit móvil. Incluyen leyenda en ambas vistas, categoría dibujada en el píxel de Canvas, selección, marcas en tarjetas, roles/faltantes en resumen, atribución preservada, página de proyecto, reflow a 320 px con texto al 200 % y axe. |
| Capturas e inspección visual | Leyenda y página del proyecto revisadas en `artifacts/local-validation/flag-source-colors/`, ignorado por Git. Smoke del sitio local real en 1440×1000 y 390×844: mapa base cargado, marcas visibles de CABA/Nación/Vicente López, créditos OpenMapTiles/OSM, sin errores de página ni overflow horizontal. El reporte no mide cobertura de datos ni precisión geográfica. Las capturas de la primera propuesta sintética en `map-source-colors/` no representan la paleta final. |
| `git diff --check` | Pasa. |

Playwright Firefox no pudo iniciar en este Windows (`spawn UNKNOWN`); no se contabiliza como pase. La revisión de laboratorio no representa cobertura de datos reales ni certifica WCAG AA sobre cada estilo de cartografía. Sin publicación del sitio.

### Revisión y correcciones del PR #5 · 2026-10-05

La revisión del commit `c00c679` encontró tres defectos concretos:

- La selección reemplazaba por azul el trazo de fuente de líneas y bordes de polígonos. Se conserva ahora el trazo interior de categoría de 4 px y se dibuja el contorno azul de 8 px debajo, con halo blanco exterior de 12 px. Los puntos conservan su núcleo y forma. Las regresiones verifican píxeles de fuente y foco en punto, línea y polígono seleccionados, más un MultiLineString CABA rojo sintético.
- Un financiador informado hacía desaparecer el aviso de responsable desconocido aunque no hubiera área responsable ni ejecutor. Se separan ambos criterios: los financiadores siguen visibles y el faltante se muestra mientras falten área y ejecutor, incluidos valores compuestos sólo por espacios.
- El callback de atribución de OpenLayers TileJSON puede devolver `null` fuera de sus límites, aunque sus tipos no lo reflejen. El adaptador normaliza `null` y `undefined` a una lista vacía; dentro del área sigue conservando OpenMapTiles/OSM y omitiendo sólo OpenFreeMap. La regresión usa la clase TileJSON real con metadatos y límites sintéticos, sin solicitudes remotas.

Antes de las correcciones se reprodujeron dos fallas de color de selección en E2E (línea y polígono; el punto pasaba) y dos excepciones unitarias por callbacks `null`/`undefined`. Esos fallos previos no se contabilizan como pases.

Verificación final: `npm run typecheck`, `npm run build`, `npm run contract:check` y `git diff --check` pasan; 146 pruebas unitarias pasan y la regresión de atribución completa pasa 17/17 tras adaptar el fixture al tipo Config instalado. Los 106 E2E aislados pasan en Chromium escritorio/móvil/tablet y WebKit móvil, con WebGL deshabilitado. Firefox conserva la limitación local de inicialización registrada arriba. El ciclo de vida del mapa y los archivos generados del contrato permanecen sin cambios.

El check `verify` del primer commit fue cancelado por GitHub porque no pudo obtener un runner hosted, antes de ejecutar verificaciones. El escaneo GitGuardian pasó. La cancelación de infraestructura no se presenta como resultado de la aplicación; el push de correcciones dispara una nueva corrida de CI.

### Correcciones encontradas en CI del PR #5

La corrida [37378600241](https://github.com/juanNH/obras-transparentes-front/actions/runs/37378600241), sobre `83cf84e`, completó 114 de 116 E2E y falló en dos casos de Chromium escritorio. Las diez pruebas de Firefox pasaron en Linux; la limitación de inicialización en Windows no se extiende a ese entorno. Typecheck, unitarias, proxy y build pasaron antes de los E2E.

- Al confirmar un área del mapa, la navegación podía hacer que Chromium descartara el cuerpo de respuesta antes de que la prueba leyera `response.json()`. El E2E captura ahora el JSON de la respuesta real mediante `route.fetch()` antes de entregarla al navegador. Conserva las comprobaciones de ausencia de consultas durante movimiento/zoom, bbox y estado compartidos, cantidad de obras únicas en lista y persistencia tras recarga. El caso corregido pasó cinco repeticiones locales consecutivas.
- Los nombres de las banderas eran elementos flex anónimos que no podían reducir su ancho. A 320 px y texto al 200 %, algunos encabezados medían 221 px dentro de tarjetas con 190 px de contenido. Se envuelve el texto en un span flexible y se permite su reflow, sin ocultar contenido ni overflow. La regresión espera la carga de fuentes y comprueba tanto el ancho interno de cada tarjeta como el del documento. La inspección local posterior registra 190 px en los cuatro encabezados y 320 px en el documento.

Estas fallas se conservan como antecedente y no se contabilizan como pases de la corrección.

Verificación local del cambio: typecheck, build de producción, 146 unitarias, contrato y `git diff --check` pasan. La suite completa soportada en Windows pasa 106/106 E2E en Chromium escritorio/móvil/tablet y WebKit móvil, con API/cartografía sintéticas aisladas y WebGL deshabilitado. Incluye las dos regresiones de CI sin reintentos; las cinco repeticiones enfocadas son adicionales a ese total. El nuevo push permite verificar Firefox y el reflow también en el runner Linux.

### Integración y corte operativo del PR #5

El [workflow 37380466432](https://github.com/juanNH/obras-transparentes-front/actions/runs/37380466432), sobre `76590ca`, terminó correctamente. El PR registra typecheck, unitarias, proxy, build y **116/116 E2E en Linux**, incluidas las diez pruebas de Firefox; GitGuardian también pasó. El primer check cancelado y la corrida de 114/116 son antecedentes anteriores a estas correcciones. El [PR #5](https://github.com/juanNH/obras-transparentes-front/pull/5) se fusionó el 5 de octubre a las 19:17, hora de Buenos Aires, mediante `8848de5`; `main` local y `origin/main` coincidían en ese merge al verificar este corte.

La revisión de las 19:40 comprobó HTTP 200 en `localhost:3002`, Next en desarrollo con HMR y los archivos vigentes del checkout. Vite sirve el backoffice en `127.0.0.1:5173`, con el mismo árbol que su merge `699c8f5`. La API E7 de `127.0.0.1:3000` responde `live`/`ready` 200 y publica OpenAPI 0.6.0; sus 89 JavaScript del build coinciden con la fuente integrada en `016c102`. La API arrancó después de ese build. El worker activo es anterior al build vigente y no se reinició ni se acreditó su versión cargada en esta revisión.

La conciliación actual de solo lectura verificó las 709 fichas y la paginación completa de listado/GeoJSON contra la base: catálogo **20**, **709 obras públicas**, **481 obras representadas**, **483 geometrías** y **228 obras sin geometría**, sin IDs duplicados ni recorte. CABA aporta 489 obras/395 en mapa; Nación 206/84 con 86 geometrías; Vicente López 12/0; PBA 2/2. La fecha de actualización de fuente es desconocida en todas las fichas. Este corte acredita publicaciones locales; la cobertura territorial y la precisión requieren evidencia propia.

Las 489 obras de fuente CABA y las 12 municipales de Vicente López publican `territorios: []`. Las 395 ubicaciones CABA tienen corroboración espacial compatible con CABA, pero esa evidencia no completa el territorio normalizado. «Territorio no informado» conserva ese faltante y no contradice la presencia de una geometría aprobada.

El listado público del BFF responde con `Cache-Control: no-store`. Assets versionados y mapa base conservan sus políticas actuales. `robots.txt` responde `Disallow: /` y sitemap con origen `http://localhost:3002`. Hosting, dominio HTTPS y operación remota son tareas de producción; la consulta local puede continuar con esta configuración. No se comprobó un destino remoto de producción ni se ejecutó un despliegue. Las pruebas CI no sustituyen dispositivos físicos, lectores de pantalla ni exactitud geográfica de los datos.

## JSDoc y publicaciones sin ubicación en el mapa · 2026-10-05

La rama `fix/documentacion-y-catalogo` incorpora la documentación del código propio y la distinción visible de publicaciones sin ubicación aprobada. Este registro corresponde al cambio y su verificación local, antes de registrar su integración remota; los resultados del PR #5 se conservan como antecedentes de esa entrega.

La [guía de documentación del código](documentacion-codigo.md) establece `@file` por módulo y JSDoc descriptivo para declaraciones propias, incluidos componentes, funciones, clases, métodos, constructores, tipos y constantes exportadas. Los comentarios explican contratos, errores, efectos de red/cancelación, semántica de datos y presupuestos, sin duplicar los tipos de TypeScript. Las pruebas documentan propósito y aislamiento por módulo. Los artefactos generados mantienen su procedimiento de exportación y no se comentan a mano.

`npm run docs:check` analiza archivos mantenidos con TypeScript y falla con archivo/línea cuando falta documentación. `prebuild` ejecuta la comprobación antes de preparar tipografías y compilar. La plantilla de PR y las instrucciones de colaboración exigen mantener los comentarios con cada cambio futuro. La comprobación evalúa presencia/descripción; su precisión semántica requiere revisión del código.

`MapAvailability` comparte la etiqueta entre tarjeta, ficha y resumen. «Publicada · Sin ubicación en el mapa» combina un pin tachado decorativo y texto visible, con superficie neutra y colores forzados compatibles; no usa una alerta de error. La ficha determina disponibilidad a partir de ubicaciones `ACCEPTED` con geometría. Una revisión histórica sin ubicación conserva ese carácter en su etiqueta y explicación.

El aviso de lista cuenta sólo las publicaciones cargadas que carecen de geometría y actualiza el número al paginar. La acción para consultar esas publicaciones conserva los demás filtros, elimina bbox/cursor y abre vista lista. El aviso de una consulta por área explica que se desconoce si las publicaciones sin ubicación están dentro de esa zona. Fichas y resúmenes permanecen disponibles sin ofrecer «Ver en mapa» para una obra sin geometría.

### Verificación local de esta entrega

Windows, Node 24.21.0/npm 11.19.0. E2E utiliza la API sintética de sólo lectura en 4100 y Next de producción en 3102, con cartografía sintética y WebGL deshabilitado; no carga datos en la API activa.

| Comprobación | Resultado y alcance |
| --- | --- |
| `npm run docs:check` | 63 módulos y 212 declaraciones documentadas; sin faltantes. |
| `npm run typecheck`, `npm run build` | Pasan; el build ejecuta la comprobación JSDoc. |
| `npm test`, `npm run test:proxy` | 147 unitarias y 5 pruebas del proxy pasan. La prueba de URL verifica quitar área/cursor conservando fuente y municipio. |
| Chromium escritorio y móvil | 96 E2E distintos pasan tras actualizar dos assertions del texto anterior del aviso. Incluyen 10 casos nuevos de ausencia cartográfica, paginación, ficha/resumen, filtros de área, HTML sin JavaScript, reflow a 320 px/texto 200 %, colores forzados y revisión histórica. |
| Chromium tablet y WebKit móvil | 20/20 E2E de compatibilidad pasan. |
| Total E2E local | 116 casos distintos verificados. La primera ejecución fue 92/94; las dos assertions antiguas y dos casos históricos nuevos pasan en una repetición enfocada 4/4. Los fallos iniciales no se cuentan como pases. |
| Firefox de esta entrega | Diez casos pendientes de CI Linux. Se conserva el proyecto; el antecedente de inicialización fallida en Windows y el pase histórico del PR #5 no acreditan esta nueva entrega. |
| Comparación AST y diff | 55 archivos modificados sólo en comentarios, sin cambios de comportamiento inesperados; `git diff --check` pasa. |
| Observación real de sólo lectura | Catálogo municipal de Vicente López en `localhost:3002`: 12 tarjetas y 12 etiquetas en escritorio 1280 px y móvil 390 px; ficha móvil conserva aviso. HTTP 200, sin errores JS ni desbordamiento. |

Las capturas reales `publicadas-sin-mapa-1280.png`, `publicadas-sin-mapa-390.png` y `ficha-publicada-sin-mapa-390.png` se inspeccionaron visualmente. Son evidencia local de la presentación con datos publicados; los casos E2E permanecen aislados y sintéticos. Axe, emulación y estos recorridos no sustituyen teléfonos físicos, lectores de pantalla ni la evaluación completa de WCAG AA.

## Preparación del sitio público para producción · 2026-10-05

Trabajo en `feature/preparacion-sitio-publico`, desde `main` limpio, limitado al frontend. Referencia: [Salida a producción — ProgresoUrbano](https://docs.google.com/document/d/1Rc6Wp70stMVFRJEYpmQSrJYhK2ZH9SkFKPzP_CKQ8W4/edit). No se eligió hosting/dominio ni se desplegó o publicaron datos.

### Cambios y límites

- `/privacidad` conserva título y metadescripción heredada; incorpora `obrastransparentesapp@gmail.com`, consultas/URL, geolocalización voluntaria, mapa externo, correo y ausencia de cuentas públicas/analítica. Separa los plazos declarados por OpenFreeMap de la retención propia no confirmada. Operador, domicilio, alojamiento, registros y atención de derechos siguen visibles como pendientes.
- `/terminos` es HTML estático y un borrador explícito para revisión jurídica argentina. Describe propósito informativo/no oficial, fechas/faltantes, publicaciones sin geometría, fuentes y licencias por verificar, disponibilidad y correcciones. No inventa operador, CUIT, retención, licencia general ni tribunal, y no incluye renuncias amplias de derechos. Enlaza textos oficiales de [Ley 25.326](https://www.argentina.gob.ar/normativa/nacional/ley-25326-64790/actualizacion), [Decreto 1558/2001](https://www.argentina.gob.ar/normativa/nacional/70368/actualizacion), [Ley 24.240](https://www.argentina.gob.ar/normativa/nacional/ley-24240-638/actualizacion) y [Código Civil y Comercial](https://www.argentina.gob.ar/normativa/nacional/ley-26994-235975/actualizacion); la aplicabilidad concreta requiere asesoría, no se presume por gratuidad.
- El pie enlaza ambas páginas. La 404 explica páginas/publicaciones ausentes y permite recuperar catálogo, lista o inicio. Conserva validaciones de UUID/revisión/filtros y los errores recuperables. Para documentos HTML de fichas, `src/proxy.ts` comprueba la ausencia antes del render: UUID/revisión inválidos no consultan la API; sólo un 404 con sobre público válido abre la recuperación estática. La comprobación tiene 2 segundos y un máximo de 16 KiB para el error; otros estados o fallas siguen al manejo vigente. Esto resuelve la recuperación sin JavaScript de la versión instalada de Next, a cambio de dos GET upstream al abrir directamente una ficha válida (estado y contenido). RSC/precargas y las consultas del mapa no agregan esa lectura. El costo y la posible API de existencia liviana se documentan en la auditoría.
- El favicon SVG usa las mismas trazas y colores del símbolo del header. Se mantienen SVG decorativos ocultos a tecnología asistiva y la ilustración conceptual con explicación visible; no hay fotografías propias para recomprimir. Imágenes informativas futuras deben tener alternativa descriptiva, decorativas `alt=""`.
- Se preservan las metadescripciones existentes. Cada página tiene título; las fichas añaden sólo territorio informado. Canonical absoluto y OG de texto requieren URL pública HTTPS, `SITE_ENVIRONMENT=production` y `SITE_INDEXABLE=true`; revisiones y explorador siguen `noindex`. Local/staging no emiten canonical/OG; robots bloquea todo y `/sitemap.xml` responde 404 sin leer catálogo. Las variables deben coincidir en build/arranque: cambiar origen/entorno requiere recompilar páginas estáticas. Imagen social y preview final pendientes.
- No se agrega banner de cookies, CAPTCHA ni otra paginación. La [auditoría y medición de solicitudes](volumen-mapa.md) separa catálogo/GeoJSON, montaje del proveedor, cancelaciones, bytes sintéticos y pendientes de campo.
- `contract:sync` regenera el contrato local vigente 0.7.0, incluidos 429, `Retry-After` y `RateLimitedError`; no se editan los artefactos a mano ni cambian los ejemplos. La herramienta compila/exporta en un temporal dentro del frontend, sin iniciar la API ni escribir en el checkout de su fuente. El BFF conserva el estado 429; la propagación de `Retry-After` y la calibración de cuota compartida siguen pendientes.

### Verificación de la entrega

Fixtures API/Next aislados, sin escrituras en la API activa. Capturas de privacidad/términos/404 en 390 px y términos en 320 px inspeccionadas en `artifacts/local-validation/preparacion-sitio-publico/` (archivos locales ignorados). Las pruebas de reflow también amplían texto al 200 %; axe/emulación no certifican WCAG AA o dispositivos físicos.

| Comprobación | Resultado y alcance |
| --- | --- |
| `npm run docs:check` | 73 módulos y 231 declaraciones documentadas; sin faltantes. |
| `npm run typecheck`, `npm run build` | Pasan; privacidad, términos y favicon se prerenderizan. El build incluye JSDoc. |
| `npm test`, `npm run test:proxy` | 221 unitarias en 14 archivos y 5 pruebas del proxy local pasan. Incluyen metadatos, cierre de indexación, sitemap y comprobación de fichas con errores/timeout/cancelación. |
| `npm run contract:sync`, `npm run contract:check` | Pasan con compilación/exportación temporal dentro del frontend. Contrato 0.7.0 generado; ejemplos conservados. |
| Recuperación 404 enfocada | 8/8 casos en Chromium escritorio/móvil: status, CTA, teclado/reflow y lista/ficha sin JavaScript. La captura móvil de ficha ausente sin JS entrega HTTP 404, contenido visible y ancho de documento 390 px. |
| Integrada tras corregir 404 | 143/144 pasan en Chromium escritorio/móvil/tablet y WebKit móvil. El caso restante fue una carrera del nuevo E2E de volumen, no un fallo de la aplicación; se corrigió la sincronización y se verificó aparte. |
| Medición final | 10/10 repeticiones del recorrido (cinco por proyecto) y 12/12 casos de volumen/fichas pasan. Conservan los conteos exactos. Después se agregó la assertion explícita de ocho entradas totales al registro y pasó en 2/2 recorridos adicionales; los doce informes previos ya medían ocho lecturas. Los informes están archivados; no se suman las repeticiones al número de casos distintos. |
| Cobertura local final | 144 casos E2E distintos verificados entre la integrada y las regresiones posteriores. No se presenta la corrida integrada de 143/144 como un pase completo. |
| Firefox | Diez casos pendientes de CI Linux: la inicialización local falla con `browserType.launch: spawn UNKNOWN`. No se cuenta como pase ni como defecto probado de la aplicación. |
| `git diff --check` | Pasa. Sin commit, push ni despliegue. |

La primera corrida completa, antes de corregir las fichas ausentes, tuvo 136/148 pases, dos fallas reales de 404 sin HTML visible y diez bloqueos de inicialización de Firefox. La reparación previa al render resuelve esos casos sin sustituir errores de contrato/servicio por una ausencia. Las repeticiones de la medición detectaron lecturas del registro antes de terminar las acciones, un selector de estado ambiguo, una URL todavía pendiente y una promesa `response.finished()` de Playwright bloqueada pese a GeoJSON 200 y datos visibles. El E2E espera ahora URL/estado y conteos exactos del registro sintético mediante `expect.poll`; el código del mapa no cambió. Las trazas y resultados previos se conservan como diagnóstico y no se contabilizan como pases.

Antes del lanzamiento siguen pendientes operador/revisión jurídica y proceso de correcciones/derechos, proveedores/registros/retención, URL pública e imagen social, robots/sitemap/canonical del hostname definitivo, compresión del JSON BFF y medición real de rendimiento, cuota compartida detrás del BFF (incluida la lectura adicional de fichas), propagación de `Retry-After`, concurrencia y accesibilidad manual. Un chequeo de existencia liviano requiere contrato con API; no se asumió soporte HEAD ni se agregó caché que pueda mezclar revisiones.

### Textos legales públicos y retirada de correo · 2026-10-06

La indicación posterior del usuario reemplaza el contacto de la preparación anterior: privacidad y términos se presentan con lo conocido hoy, sin correo publicado. Se conserva el resto del trabajo de la rama; no se modifica el contrato, la API ni la configuración privada existente.

Las páginas usan una introducción para el público, fecha de revisión y apartados de lectura. Los términos describen el catálogo actual, sus fuentes, fechas, faltantes, licencias por fuente y disponibilidad; dejan de abrir con un aviso de borrador y de mostrar instrucciones internas al equipo. La privacidad conserva geolocalización voluntaria, consulta por área en URL, acceso externo a cartografía y ausencia de analítica/publicidad. Los plazos declarados por OpenFreeMap siguen atribuidos al proveedor y se comprobaron nuevamente en sus páginas oficiales el 6 de octubre.

Se retiran enlaces `mailto`, instrucciones de envío, tratamiento de mensajes y la metadescripción que prometía contacto en términos. También se elimina el correo predeterminado del sitio: el CTA opcional de ficha aparece sólo con `REPORT_EMAIL` explícito y válido. La configuración local no tiene ese valor habilitado; no se altera `.env`. Privacidad ofrece acceso directo a lista, sin cargar cartografía; términos conserva el acceso al explorador. No se agregan formularios, cookies, CAPTCHA ni mecanismos de contacto ficticios.

Los pendientes materiales siguen visibles en las páginas: identidad y domicilio del operador/responsable, canal para consultas y derechos, alojamiento y conservación propios aún no confirmados, más revisión jurídica de las condiciones definitivas. La redacción preparada no acredita que esas obligaciones estén resueltas ni sustituye asesoramiento profesional.

Revisión interna antes de lanzar:

- Identificar operador/responsable, domicilio e identificación fiscal cuando corresponda; publicar un canal real y definir recepción de consultas/correcciones y solicitudes de derechos, responsables y verificación de identidad necesaria.
- Confirmar alojamiento, registros de acceso/error, finalidades, accesos, conservación y proveedores/transferencias efectivas, incluyendo cartografía y cualquier futura comunicación. No adoptar como propios los plazos de OpenFreeMap.
- Revisar el inventario de licencias de cada fuente/documento y los derechos del contenido del proyecto; disponibilidad pública no implica licencia común.
- Revisar profesionalmente obligaciones y condiciones según Ley 25.326, Decreto 1558/2001, Ley 24.240 y Código Civil y Comercial, sin presumir exclusión por gratuidad ni fijar una jurisdicción o renuncia no aprobadas.
- Si se incorpora analítica, publicidad u otra cookie no esencial, revisar proveedores, finalidades, conservación y controles de consentimiento antes de incorporarla, y actualizar la política. La administración separada requiere su propia información de sesiones/proveedores.

Verificación del ajuste: `npm run typecheck`, `npm test` (221/221 en 14 archivos) y `npm run build` pasan. El build ejecuta `docs:check`, con 73 módulos y 230 declaraciones documentadas. Los 12 E2E enfocados pasan en Chromium escritorio/móvil: ocho casos de legales y cuatro de landing/lista/ficha y reflow existentes. Verifican HTTP 200, HTML sin correo ni `mailto`, datos del operador/canal no informados, SEO staging, axe, teclado y enlaces cruzados, 390/320 px con texto al 200 %, navegación sin JavaScript y paginación de 20 a 4 fichas con API/cartografía aisladas. No se consulta la API activa ni se repite la suite completa o la sincronización de contrato para este cambio de textos/configuración de contacto; los resultados anteriores no se presentan como una corrida nueva. Las capturas de escritorio/móvil se guardan en `artifacts/local-validation/legales-2026-10-06/`, ignorado por Git.

Se inspeccionaron las cuatro capturas actuales (1280 y 390 px de ambas páginas): HTTP 200, fuentes cargadas, sin desbordamiento horizontal y con avisos/CTA legibles. El helper y `summary.json` permiten reproducirlas con procesos fixture/Next propios en 4114/3114, sin solicitudes externas; esos procesos se cerraron al terminar. `git diff --check` pasa. Se mantienen los límites de axe/emulación frente a dispositivos y lectores de pantalla reales.

## Visibilidad de las tres fuentes municipales piloto · 2026-10-07

El explorador incorpora un panel HTML de Bahía Blanca, Olavarría y Pergamino, alimentado por `GET /api/v1/obras/cobertura-municipal`: publicaciones actuales, obras con geometría aceptada y obras sin ubicación aprobada. Sus totales son globales por fuente, independientes del área, partido, estado y paginación de la consulta. La fuente no acredita gestión municipal; no se combinan ni suman fuentes para deducir un total único. Las cifras corresponden al corte de catálogo al abrir la consulta. Un corte distinto del listado inicial oculta las cifras y ofrece actualizar; una caída tampoco convierte el desconocido en cero ni interrumpe lista, ficha o mapa.

El acceso «Ver publicaciones de esta fuente» abre explícitamente la lista por fuente y descarta filtros anteriores que podrían excluir obras sin ubicación o sin partido canónico. La explicación distingue fuente sin publicaciones de publicaciones disponibles sin marcador. El mapa conserva únicamente geometrías aceptadas de la revisión exacta; no utiliza centroides, nombres de municipio ni candidatos para completar puntos.

El cliente toma `PublicMunicipalCoverage` del contrato generado y valida su transporte, los tres códigos distintos y la suma consistente de obras con/sin geometría. El BFF `/api/public/obras/cobertura-municipal` expone una lectura GET sin filtros, no propaga credenciales y devuelve `Cache-Control: no-store`. La lectura tiene presupuesto independiente de 5 segundos/32 KiB. El panel añade una solicitud SSR por consulta, sin una solicitud adicional desde el navegador ni durante alternancias de vista; el ensayo de tráfico contabiliza esa lectura por separado. El proxy de diagnóstico admite la nueva ruta pública conservando su alcance de lectura.

Verificación: `contract:sync`, `contract:check`, typecheck y build pasan; 352 unitarias, cinco pruebas del proxy y JSDoc de 103 módulos/282 declaraciones pasan. Se ejecutaron 46 E2E de regresión existentes de orientación, disponibilidad cartográfica, paginación/tráfico y filtros municipales en Chromium escritorio/móvil. Los ocho casos nuevos de cobertura pasan en su ejecución final: cero publicaciones, dos publicaciones con omisión, una geometría aceptada dibujada en Canvas con identidad/revisión/ubicación coincidentes entre ficha y GeoJSON, fallo independiente, cambio de catálogo, HTML sin JavaScript, axe y reflow a 320 px con texto al 200 % y colores forzados. La primera ejecución detectó dos selectores demasiado exactos del nombre accesible de un enlace sin JavaScript; se corrigieron por la tarjeta de fuente y los dos casos pasaron, antes de repetir satisfactoriamente los ocho nuevos casos. No se informa esa primera corrida como un pase completo.

El build de QA usa `NEXT_DIST_DIR=.next-coverage-qa`, separado de la instancia local activa, y Playwright usa procesos de API/Next propios en 4100/3102. Las capturas de escritorio/móvil se conservaron en `artifacts/local-validation/municipal-coverage-front/`, ignorado por Git; se inspeccionaron panel apilado, tarjetas, avisos y marcador seleccionado. Esas pruebas usan fixtures sintéticos aislados y no acreditan obras reales ni completan revisión territorial o licencias. La comprobación operativa posterior de E7 se registra a continuación. No se alteraron datos, licencias ni publicaciones desde las pruebas del frontend.

### Corte operativo E7 · 7 octubre 2026, 16:11 UTC

La API y el BFF activos sirven catálogo `24` y el corte público de las tres fuentes coincide:

| Fuente piloto | Obras publicadas | Con ubicación aceptada | Sin ubicación en el mapa |
| --- | ---: | ---: | ---: |
| Bahía Blanca | 1 | 1 | 0 |
| Olavarría | 0 | 0 | 0 |
| Pergamino | 2 | 0 | 2 |

La primera publicación cartográfica de Bahía es `CONSTRUCCION CENTRO SALUD DELEGACION NORTE ( 416R-174/17)`, WS `36`, ordinal original `28`, propuesta aprobada en versión `6` después de cinco decisiones auditadas. Obra `d26c0356-1c68-4e06-b019-095ca4af92c5`, revisión `f8628d82-68a7-4944-a626-9d361a1f1d12`: GET anónimo `404` mientras la revisión era privada y `200` después de publicar. Se comprobó marcador real visible, apertura de su resumen y coincidencia de obra/revisión/ubicación entre ficha, lista y GeoJSON. La lectura cartográfica mostró 482 obras representadas y 484 ubicaciones; son conteos del recorrido del mapa, separados de los totales globales por fuente y de las páginas cargadas de lista. `catalogoVersion="24"` no significa 24 obras.

La política editorial `bahia-oficial-wgs84@1` conserva exactamente las coordenadas del WS congelado. Selecciona sólo el único `Polygon`/`MultiPolygon` con `properties.name` exactamente igual a la delegación informada por ese registro. Aquí corresponde `Norte`, índice de feature `6` de `comunas.geojson`: PostGIS validó esa geometría y la contención del punto. La capa es heterogénea; sus otros elementos no se reparan ni sirven para inferir cobertura adicional. WGS84 sigue siendo un supuesto revisado, con precisión desconocida y sin acreditar el sitio físico exacto. La asociación canónica de ubicación con Bahía Blanca fue una decisión separada; no reemplaza la delegación reportada ni acredita gestión municipal.

La publicación conserva licencia Bahía versión `1`, `ALLOWED`, `CC-BY-4.0`, sobre el recurso WS original, con atribución y contenidos externos excluidos. Pergamino conserva su licencia registrada sobre el CSV original; los perfiles de Pergamino y Olavarría mantienen restricciones de revisión privada por defecto y cada publicación requiere una política efectiva que cubra todos sus originales. Olavarría permanece pendiente de licencia habilitante y evidencia espacial. Una licencia no habilita aprobación masiva ni concede derechos de imágenes, documentos, scripts o cartografía no verificados.

Quedan 1117 propuestas de Bahía pendientes, las 75 de Olavarría pendientes y 217 pendientes más una postergada en Pergamino, además de sus dos aprobadas. Pergamino tiene cero duplicados exactos pendientes; el bacheo del ordinal `82` continúa postergado hasta obtener respaldo contractual de `D-209/2021` y `D-208/2021` y resolver sus relaciones con `77`/`81`. La cohorte inicial PBA de 315 sigue siendo un control separado del histórico de 317 propuestas PBA, tres aprobadas y 314 pendientes. Mostrar la nómina de 135 partidos no acredita revisión ni cobertura cartográfica para todos ellos.

Las auditorías `audit-e7-readonly.json` y `audit-bahia-final.json`, conservadas en `obras-transparentes/artifacts/local-validation/visibilidad-municipal/`, registran 45 controles de cierre sin fallas, ocho originales con SHA-256 íntegros, cinco verificaciones referenciales en cero y los 135 partidos únicos del padrón `pba-partidos@1`. Las 15 migraciones existentes permanecen aplicadas; esta entrega no agregó migraciones. La aceptación real descrita acredita la primera obra de Bahía, no una revisión completa de los tres municipios ni de las 315 propuestas PBA.

La verificación final del frontend comprende 352 unitarias, cinco pruebas del proxy y 54 escenarios distintos de navegador relacionados; estos últimos corresponden a las 46 regresiones y los ocho casos nuevos documentados arriba. `contract:check` se repitió contra la API final y confirmó igualdad de contrato y tipos, sin repetir build/E2E ante cambios privados de Bahía que no alteraron el DTO público.

## Navegación municipal y conteos completos de consulta · 2026-10-07

La rama `feature/cierre-localidades`, basada en `main`, implementa la navegación explícita entre fuentes de Bahía Blanca, Pergamino y Olavarría y el desglose público de obras con/sin ubicación. Elegir una fuente municipal conserva filtros y vista y descarta el cursor/selección de la fuente anterior. Si se conserva un bbox, los conteos muestran qué publicaciones tienen ubicación fuera del área; el panel global mantiene «Ver publicaciones de esta fuente» para abrir todas sus obras quitando filtros previos. Procedencia, partido reportado, ubicación territorial verificada y gestión municipal siguen siendo relaciones distintas.

`GET /api/v1/obras/conteos` devuelve una versión de catálogo y totales de obras únicas con los filtros públicos, independientes de cursor/página y del bbox contextual. El frontend omite también `tieneGeometria` para presentar siempre el desglose completo con los demás filtros. `totalPublicadas = totalConGeometria + totalSinGeometria`; con área, `totalConGeometria = area.obrasEnMapa + area.obrasFueraDelArea`. Una obra con varias ubicaciones se cuenta una vez. «Dentro del área consultada» significa que alguna ubicación aprobada intersecta esa área; no garantiza que un mapa con lectura/representación limitada ya haya dibujado esa obra. El encuadre candidato de cámara no modifica estos conteos: hace falta pulsar «Buscar en esta zona».

El panel «Cuántas obras podés consultar» está disponible en HTML inicial, incluso en vista lista y con JavaScript deshabilitado. El enlace permanente a publicaciones sin ubicación quita bbox/cursor, abre la primera página textual y conserva los demás filtros. Las obras sin geometría se presentan como no asignables al área; no se incluyen como obras dentro ni fuera del bbox. El recuento de tarjetas cargadas permanece separado de los totales del servidor y de ubicaciones/obras representadas.

La lectura SSR de conteos usa `Promise.allSettled` junto con lista y catálogos. Cada panel sólo publica cifras cuando su respuesta corresponde a la misma versión que la lista inicial. Fallas o incompatibilidades dejan los totales afectados desconocidos, con acceso textual recuperable. Si una página/GeoJSON descubre `CATALOG_CHANGED` después de la lectura inicial, se retiran lista, mapa, conteos y las cifras de las tres fuentes dentro del mismo explorador. No permanece un panel antiguo presentado como vigente.

El cliente usa `PublicWorkCounts` generado desde el backend, valida la partición y la coincidencia exacta del área solicitada. El BFF `/api/public/obras/conteos` admite sólo filtros públicos sin cursor/limit, conserva la cancelación y no propaga cookies ni autorización. Conteos tiene presupuesto de 5 segundos/32 KiB y `no-store`, independiente de los 2 MiB cartográficos. Añade una lectura SSR por nueva consulta; paginar, alternar vista o mover cámara no solicita de nuevo conteos. Su variante `tieneGeometria=false` con bbox es válida como contexto de conteos, aunque listado/mapa requieren quitar bbox para consultar publicaciones sin ubicación.

Los componentes reutilizan paneles/tokens de la guía visual y vínculos con área táctil de 44 px, borde de control y `aria-current` en la fuente elegida. No se agregan proveedores, dependencias, coordenadas inferidas ni políticas de datos reales. Estos cambios habilitan consulta pública; no acreditan el cierre editorial ni incorporan por sí solos obras nuevas.

Verificación local final: 358/358 pruebas unitarias en 27 archivos, cinco pruebas del proxy, typecheck, build de producción, `docs:check` (107 módulos/288 declaraciones), `contract:sync`, `contract:check` y `git diff --check` pasan. Los 32 E2E relacionados pasan en Chromium escritorio/móvil: 12 casos de navegación/conteos, ocho de cobertura municipal y 12 de tráfico/paginación/fichas. Incluyen retiro coherente de ambos paneles tras cambio de catálogo, totales independientes de páginas/cámara, área vacía con acceso a dos publicaciones sin ubicación, procedencia conservando filtros/vista, partición dentro/fuera, transporte anónimo, errores, HTML sin JavaScript, axe y 320 px/texto 200 %. El registro de solicitudes pasa de 20 a 23 en el recorrido de tres consultas por las tres lecturas SSR nuevas de conteos; mover/alternar/paginar no añade esas lecturas.

La primera corrida fue 26/30: cuatro fallas de las pruebas nuevas, dos por suponer un píxel cartográfico en el centro al encuadrar fixtures distantes y dos por `addStyleTag` esperando scripts de carga en un contexto con JavaScript deshabilitado. Se corrigieron los helpers del escenario: se comprueba un píxel real del marcador municipal y se inserta el estilo de reflow mediante el canal de evaluación de pruebas. Después, 10/10 casos nuevos y la corrida final 32/32 pasan; la primera corrida no se considera un pase completo. Capturas revisadas en `artifacts/local-validation/cierre-localidades-front/`, ignorado por Git. Las verificaciones usan API/cartografía sintéticas aisladas en 4100/3102; no consultan ni escriben E7. No sustituyen dispositivos físicos, lectores de pantalla, CI completo ni el cierre/licencias de las propuestas reales.

## Cobertura de todas las fuentes públicas · 2026-10-08

El panel de cobertura presenta las siete fuentes declaradas por el contrato público: Provincia de Buenos Aires (`pba-edificios`), Nación (`nacion-obras`), CABA, Vicente López, Bahía Blanca, Olavarría y Pergamino. Provincia y Nación aparecen primero. Cada fuente enlaza a su primera página de lista con sólo `fuente` y `vista=lista`; estos enlaces, la navegación principal y el selector de fuente abren una consulta limpia, sin área, cursor, selección ni filtros anteriores. El selector es un formulario independiente y funciona sin JavaScript. La fuente se conserva como filtro oculto al aplicar otros filtros de la consulta vigente.

La cobertura municipal reutiliza `GET /api/v1/obras/cobertura-municipal`; Provincia, Nación, CABA y Vicente López usan el `GET /api/v1/obras/conteos?fuente=...` existente. Ambos formatos incluyen `catalogoVersion`. El servidor compara cada resultado con la lista inicial antes de mostrar cifras, conserva por fila los estados de error y desconocido y descarta números de cortes diferentes. Los conteos visibles corresponden al mismo corte que listado y fichas; las lecturas posteriores de páginas y fichas mantienen la comprobación de versión del explorador. No se requiere una ruta, esquema ni regeneración nueva del contrato backend. La cobertura agrega cuatro lecturas SSR por consulta, una por cada fuente no municipal; el conteo de filtros activo y la lectura municipal existente se conservan.

Las tarjetas separan fuente sin publicaciones de publicaciones sin ubicación aprobada. Las últimas permanecen accesibles en lista y ficha y no reciben geometría inferida. Los errores no se convierten en cero; una diferencia de versión o la ausencia de una versión del listado se presenta como desconocida. La fuente identifica procedencia del dato y no atribuye gestión o financiamiento.

Verificación local final: `npm test` pasa 358/358 pruebas en 27 archivos; `npm run test:proxy` pasa 5/5; `npm run typecheck`, `npm run docs:check` (109 módulos/295 declaraciones), build de producción y `git diff --check` pasan. Los 50 E2E relevantes pasan en Chromium de escritorio y móvil. Cubren las siete listas directas, cambio de fuente sin filtros previos, estados de cobertura, publicaciones sin ubicación, cambio/error de catálogo, navegación principal, accesibilidad automatizada, reflow móvil y presupuesto de solicitudes. Las primeras corridas detectaron expectativas de los datos sintéticos/textos ya desactualizadas y una comprobación Canvas limitada al píxel central; se corrigieron y la repetición completa pasó 50/50.

`npm run contract:check` no termina porque compila el backend hermano y falla con TS2345 en `C:\github\obras-transparentes\src\modules\obras\application\public-works.service.ts:145`. El árbol del backend tiene cambios locales ajenos a esta rama; no se modificó. El frontend usa los contratos existentes de `GET /api/v1/obras/conteos?fuente=...` y `GET /api/v1/obras/cobertura-municipal`, ambos con `catalogoVersion`; no requiere una ruta, esquema ni regeneración nueva. Capturas y reporte locales: `artifacts/local-validation/cobertura-fuentes-front/`, ignorado por Git. Las verificaciones usan fixtures sintéticos aislados y no consultan ni modifican la API activa.
