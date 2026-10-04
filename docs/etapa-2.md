# Etapa 2 · sitio público y exploración móvil

Implementación y adaptación Canvas autorizadas el 2026-10-04. La adaptación permanece en el mismo PR #2 para una sola integración a main. Rama `feature/etapa-2-sitio-publico`, creada desde `main`. Se preservan NestJS/PostgreSQL/PostGIS y el backoffice; no se modifica Drive ni se publican datos o el sitio.

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
| Lista inicial; mapa y resumen diferidos | Contenido consultable antes de descargar motor y fichas. El mapa tiene una espera al abrirlo por primera vez. |
| OpenLayers Canvas 2D como único motor | Mapa utilizable con WebGL deshabilitado. Conserva OpenFreeMap sin tarifa por solicitud. Procesar vectores/etiquetas sigue consumiendo CPU y memoria; requiere medir dispositivos reales. |
| Búsqueda explícita de área | «Buscar en esta zona» cambia bbox y reinicia consulta. Evita peticiones mientras se mueve el mapa o se centra ubicación. Requiere una acción adicional y distinguir vista de área consultada. |
| Panel modal nativo | Foco contenido, Escape y retorno al control. En móvil aparece desde abajo; Ampliar/Reducir reemplaza la necesidad de arrastre. Es un panel de lectura con scroll, sin gesto de arrastre propio. |
| Sin caché de datos del catálogo | Evita servir revisiones inconsistentes hasta acordar invalidación con backend. Aumenta lecturas. Assets con hash se cachean; sin prefetch masivo de teselas ni PWA offline. |
| UUID estable en ficha | No depende de nombres cambiantes. Menos legible que un slug, pero identifica obra/revisión inequívocamente. |
| Error visible por cambio de catálogo | Retira lista/mapa anteriores y ofrece reinicio con filtros. No hace reintentos infinitos ni mezcla versiones. |

React/Vite con SSR requeriría resolver servidor de rutas, metadatos, datos y generación de páginas. Next aprovecha esas convenciones conservando la API; no garantiza automáticamente SEO o velocidad. Referencias: [Server/Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components), [lazy loading](https://nextjs.org/docs/app/guides/lazy-loading), [límites del export estático](https://nextjs.org/docs/app/guides/static-exports).

## Datos, filtros y sincronización

Filtros visibles: fuente, estado informado, educación y presencia de ubicación. El valor vacío conserva obras con información faltante. El contrato no permite filtrar específicamente estado desconocido. Fuente no se etiqueta como organismo; no se agregan búsqueda textual, tipo de obra ni conteos/facets inexistentes.

Los filtros se abren con un control nativo «Filtrar obras» y muestran cuántos están activos. Esto evita empujar los resultados debajo de un formulario alto en la primera pantalla móvil; sigue funcionando sin JavaScript.

El par `territorioEsquema=pba.municipio` + `municipioCodigo` funciona en enlaces y se preserva en el formulario, pero no se inventa un selector de municipios sin catálogo de códigos/nombres. No se elige una localidad piloto por inferencia. La extensión inicial amplia del mapa es orientativa, no una declaración de cobertura nacional.

Lista sin bbox incluye obras sin ubicación. Con bbox muestra sólo obras con geometría aprobada que intersecta la zona, con enlaces para quitar el área. Se usan los mismos filtros para GeoJSON y lista, comparando `catalogoVersion` como string. Una obra puede aportar varias Features y MultiPoint varios puntos; los grupos no se rotulan como obras.

Cada selección abre `obraId` y `revisionId` exactos. La ficha actual se consulta sin revisión; los enlaces de revisión llevan `noindex` y canonical a la actual. UUID inválido/publicación inexistente da 404; backend caído es un fallo recuperable. No se deriva el estado de avance, null no se transforma en cero ni publicación en fecha de fuente.

## Presupuestos y fallas

- Lista: 20 obras por solicitud. «Cargar más» mantiene hasta 100 en el DOM; después ofrece página siguiente nativa para continuar todo el catálogo.
- GeoJSON: 100 Features por página, máximo 5 páginas/500 Features, 10.000 posiciones y 15 segundos por consulta. Se conserva o excluye una geometría completa; no se corta, simplifica o inventa.
- BFF: 8 segundos por lectura y 2 MiB de respuesta descomprimida; cancela lectura excesiva. Presupuesto del navegador para un recorrido espacial: 2 MiB; el último chunk puede superar ese valor antes de cancelarse. No es un presupuesto de teselas del proveedor.
- OpenLayers con Canvas 2D, pixel ratio limitado a 2, hasta 8 teselas simultáneas, sin precarga de otros niveles y limpieza de capas/listeners/fetch/observer al cambiar de vista; sólo puntos se agrupan. Líneas/polígonos conservan geometría. Límites y resultados parciales se indican; la lista sigue paginando.
- Fichas se descargan al abrirlas, con igual límite de respuesta. Incluyen geometría del contrato aunque el resumen no la dibuja: una proyección pública liviana requiere decisión posterior si la muestra real supera el presupuesto.
- Sitemap: hasta 10 páginas de 200 fichas, 15 segundos totales y versiones consistentes. Devuelve 503 antes que publicar resultado parcial; antes de superar 2.000 fichas, implementar índice/particiones o generación por publicación.
- Rutas de mismo origen limitadas a GET público; sin redirecciones, cookies o autorización hacia NestJS. No exponen rutas administrativas ni datos privados.

## Mapa, privacidad y proveedor

OpenLayers 10.10.0 + ol-mapbox-style 13.5.1 + Liberty de OpenFreeMap reemplazan MapLibre GL como único motor. El renderer Canvas dibuja vectores sin solicitar WebGL/WebGL2. Las capas de obras se inicializan independientemente del proveedor y del catálogo: un catálogo vacío no impide ver la cartografía y una falla del proveedor no impide seleccionar geometrías ya disponibles. `MAP_STYLE_URL` configura estilo; las obras son capas separadas. Se conserva WGS84 en API/URL y se transforma a Mercator exclusivamente dentro del mapa.

El adaptador conserva las huellas de edificios convirtiendo fill-extrusion en fill 2D. ol-mapbox-style usa fuentes web, no los glifos PBF de MapLibre: el build copia Noto Sans 5.3.0 Latin/Latin-ext regular, italic y bold, con licencia OFL, a `/map-fonts/5.3.0/`. Los metadatos del estilo se ajustan para usar ese origen propio; no se descargan fuentes desde Fontsource/jsDelivr. La ruta versionada admite caché inmutable. Cambiar proveedor exige revisar expresiones del estilo, fuentes, sprites, teselas, atribución y privacidad, no sólo una URL. Referencias: [integración oficial](https://openfreemap.org/quick_start/), [renderer Canvas](https://openlayers.org/en/latest/apidoc/module-ol_renderer_canvas_VectorTileLayer-CanvasVectorTileLayerRenderer.html), [fuentes y compatibilidad](https://openlayers.org/ol-mapbox-style/index.html).

Vista única hasta 999 px y mapa/lista contiguos desde 1000 px. Alturas dvh con fallback vh, orientación horizontal y áreas seguras en el panel. Controles por botones/teclado y dos dedos para arrastrar; rueda con Ctrl/⌘. Cambios de vista sin animaciones. La atribución del estilo permanece debajo del mapa y fuera del panel. La compatibilidad del motor no certifica todas las versiones de navegadores ni WCAG AA.

Fuentes consultadas el 2026-10-04: [guía de OpenFreeMap](https://openfreemap.org/quick_start/), [términos del 2026-09-09](https://openfreemap.org/tos/) y [privacidad del 2026-10-04](https://openfreemap.org/privacy/). El servicio se declara gratuito, sin garantía de disponibilidad y puede discontinuarse. No se instala fallback automático a tiles OSM: su [política](https://operations.osmfoundation.org/policies/tiles/) exige uso compatible, no suministro ilimitado. La atribución OpenFreeMap/OpenMapTiles/OpenStreetMap del estilo permanece visible. Autoalojamiento evita tarifa por solicitud pero exige infraestructura/operación; alternativa si el piloto requiere disponibilidad controlada.

Abrir mapa genera solicitudes a un tercero. OpenFreeMap declara ausencia de IP en registros normales de acceso; los logs de error pueden conservar IP y URL hasta 7 días, los de incidentes hasta 30 días, y Cloudflare puede procesar solicitudes. La UI enlaza esa política. No se incorpora analítica de terceros.

Geolocalización: sólo botón, sin precisión alta, timeout y alternativa manual. La posición centra en memoria. «Buscar en esta zona» incorpora el área a la URL y la envía al catálogo con aviso previo; copiar enlace es otra acción explícita. Las solicitudes del mapa base ya revelan la zona visualizada. Registros del alojamiento y contacto del operador deben definirse antes del lanzamiento. Referencia: [W3C Geolocation](https://www.w3.org/TR/geolocation/).

## Accesibilidad

HTML semántico, es-AR, skip link, foco visible, controles de al menos 44 px, labels y regiones de estado. Lista paginada/fichas no dependen de canvas ni JavaScript. El mapa tiene controles de dirección/zoom; todas las obras se seleccionan desde la lista. Panel con diálogo nativo, Escape, retorno de foco y botones de tamaño; movimiento reducido respetado. Referencia: [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

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
