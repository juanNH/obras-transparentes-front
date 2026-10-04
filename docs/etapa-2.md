# Etapa 2 · sitio público y exploración móvil

Implementación autorizada el 2026-10-04. Rama `feature/etapa-2-sitio-publico`, creada desde `main`. Se preservan NestJS/PostgreSQL/PostGIS y el backoffice; no se modifica Drive ni se publican datos o el sitio.

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
| Lista inicial; mapa y resumen diferidos | Contenido consultable antes de descargar motor, worker y fichas. El mapa tiene una espera al abrirlo por primera vez. |
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
- Motor con un worker y limpieza al cambiar de vista; sólo puntos se agrupan. Líneas/polígonos conservan geometría. Límites y resultados parciales se indican; la lista sigue paginando.
- Fichas se descargan al abrirlas, con igual límite de respuesta. Incluyen geometría del contrato aunque el resumen no la dibuja: una proyección pública liviana requiere decisión posterior si la muestra real supera el presupuesto.
- Sitemap: hasta 10 páginas de 200 fichas, 15 segundos totales y versiones consistentes. Devuelve 503 antes que publicar resultado parcial; antes de superar 2.000 fichas, implementar índice/particiones o generación por publicación.
- Rutas de mismo origen limitadas a GET público; sin redirecciones, cookies o autorización hacia NestJS. No exponen rutas administrativas ni datos privados.

## Mapa, privacidad y proveedor

MapLibre GL JS 6.12.0 + Liberty de OpenFreeMap. El build copia worker ESM, módulo compartido y licencia desde la dependencia fijada. `MAP_STYLE_URL` configura estilo; las obras son una capa separada. Migrar exige verificar sprites, glifos, teselas, atribución y privacidad del nuevo proveedor.

Fuentes consultadas el 2026-10-04: [guía de OpenFreeMap](https://openfreemap.org/quick_start/), [términos del 2026-09-09](https://openfreemap.org/tos/) y [privacidad del 2025-02-26](https://openfreemap.org/privacy/). El servicio se declara gratuito, sin garantía de disponibilidad y puede discontinuarse. No se instala fallback automático a tiles OSM: su [política](https://operations.osmfoundation.org/policies/tiles/) exige uso compatible, no suministro ilimitado. La atribución OpenFreeMap/OpenMapTiles/OpenStreetMap del estilo permanece visible. Autoalojamiento evita tarifa por solicitud pero exige infraestructura/operación; alternativa si el piloto requiere disponibilidad controlada.

Abrir mapa genera solicitudes a un tercero. OpenFreeMap declara ausencia de IP en registros habituales, registro temporal por incidentes de hasta 30 días y posible procesamiento de Cloudflare. La UI enlaza esa política. No se incorpora analítica de terceros.

Geolocalización: sólo botón, sin precisión alta, timeout y alternativa manual. La posición centra en memoria. «Buscar en esta zona» incorpora el área a la URL y la envía al catálogo con aviso previo; copiar enlace es otra acción explícita. Las solicitudes del mapa base ya revelan la zona visualizada. Registros del alojamiento y contacto del operador deben definirse antes del lanzamiento. Referencia: [W3C Geolocation](https://www.w3.org/TR/geolocation/).

## Accesibilidad

HTML semántico, es-AR, skip link, foco visible, controles de al menos 44 px, labels y regiones de estado. Lista paginada/fichas no dependen de canvas ni JavaScript. El mapa tiene controles de dirección/zoom; todas las obras se seleccionan desde la lista. Panel con diálogo nativo, Escape, retorno de foco y botones de tamaño; movimiento reducido respetado. Referencia: [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

Axe y pruebas de teclado detectan regresiones concretas, no acreditan por sí solas AA. Pendientes NVDA/VoiceOver/TalkBack, zoom/texto ampliado y usuarios con necesidades de acceso en dispositivos reales.

## Estado de otros repositorios y datos

- API `main` y remoto en `85ccfe0`, merge PR #9; contrato público disponible y servicios saludables. No se cambiaron código, procesos ni datos.
- Backoffice limpio en `feature/auth-access-management`, `be8f772`; remoto `main` en `15afba7`. Autenticación todavía no fusionada al verificar; no bloquea lectura pública.
- API activa: versión `"0"`, lista/GeoJSON vacíos. `api:check`: incomplete, sin muestra pública/espacial/fichas. No se sustituye esa falta con obras ficticias.

## Validación y pendientes de lanzamiento

Verificaciones del 2026-10-04 (Node 24.21.0, npm 11.19.0):

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

Casos poblados usan fixtures EJEMPLO SINTÉTICO en servidor separado; no representan cobertura real. Las primeras pruebas detectaron y permitieron corregir streaming/loading que ocultaba la lista sin JavaScript, `maxBounds` mundial de 360° que fallaba con MapLibre 6.12 y clics antes de la hidratación. Se conserva `renderWorldCopies:false` y validación de bbox; los botones que dependen de JavaScript se habilitan cuando sus handlers están listos. Formularios y enlaces siguen siendo nativos. No se presenta la ejecución inicial fallida como un pase ni se agregaron sleeps/reintentos para ocultarla.

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
