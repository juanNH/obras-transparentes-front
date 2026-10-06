# Solicitudes y datos del explorador público

Auditoría del frontend del **2026-10-05** para la preparación del sitio público. No consulta ni escribe el catálogo activo. Complementa los presupuestos vigentes de [etapa 2](etapa-2.md) y la referencia de [salida a producción](https://docs.google.com/document/d/1Rc6Wp70stMVFRJEYpmQSrJYhK2ZH9SkFKPzP_CKQ8W4/edit).

## Recorrido existente y límites

El sitio ya tiene dos recorridos con cursores. No se agregó otra paginación: no se encontró un caso funcional sin cubrir que la justifique.

| Lectura | Disparador y continuidad | Límite vigente |
| --- | --- | --- |
| Lista inicial | El servidor genera HTML con la página de la URL; no espera el motor cartográfico. | 20 obras por solicitud. |
| Más resultados | «Cargar más obras» usa `nextCursor`, verifica versión y conserva páginas. Al llegar a 100 obras ofrece navegación nativa a la siguiente página; se puede continuar el catálogo. | Hasta 100 obras acumuladas en el DOM; no es un límite total del catálogo. |
| GeoJSON | Primera apertura de mapa de una consulta; recorre `nextCursor` secuencialmente. Sin área confirmada lee el mundo representable, separado del encuadre argentino inicial. | 100 Features por solicitud, máximo 5 páginas/500 Features, 2 MiB de JSON leído por recorrido y 15 segundos. |
| Geometría representada | Usa Features completas; omite las que no caben y muestra mapa parcial. La selección exacta tiene prioridad y comparte presupuesto con el catálogo. | 500 Features y 10.000 posiciones entre catálogo y selección. Una Feature puede incluir varios puntos. |
| Ficha seleccionada | «Ver en mapa» o «Ver resumen» consultan la obra/revisión exactas. Elegir otra ubicación de esa revisión, cerrar/reabrir resumen y alternar vistas conservan la ficha cargada. | Una lectura por nueva selección de obra/revisión; 2 MiB y 8 segundos en el BFF. |
| Todas las lecturas BFF/servidor | Validación de contrato en servidor, `no-store`, cancelación hacia la API por la señal de solicitud. | 2 MiB descomprimidos y 8 segundos por respuesta upstream. |

Mover/acercar el mapa, geolocalizar para centrarlo y encuadrar una obra **no generan otra consulta de lista/GeoJSON**. «Buscar en esta zona» confirma `bbox` y crea una consulta nueva. Aplicar filtros también crea una consulta nueva. La ausencia de geometría no elimina publicaciones del listado; `tieneGeometria=false` evita por completo la lectura GeoJSON.

El estado mantiene el GeoJSON y la ficha completados en memoria durante la consulta. Alternar vistas conserva páginas y selección; no hay caché HTTP del catálogo ni persistencia de consultas en almacenamiento del navegador. Una carga GeoJSON interrumpida al pasar a lista se cancela; si se vuelve a abrir antes de haberla completado, se inicia otra lectura. Una respuesta ya recibida por el BFF puede haber consumido tráfico upstream aunque el navegador la cancele: los informes separan intentos, cancelaciones y lecturas completadas.

Un cursor repetido, cambio de `catalogoVersion` o presupuesto excedido termina el recorrido sin un bucle ilimitado. El mapa parcial ofrece acercar el área o seguir la lista; no acredita cobertura completa ni un total de obras.

El contrato público **0.7.0** describe respuesta `429 RATE_LIMITED` y `Retry-After` para lista, GeoJSON y ficha, con una cuota predeterminada compartida de 240 solicitudes por IP/proceso en 60 segundos y configurable por entorno. Es información del contrato generado; **no se midió ni confirmó la configuración de la API activa**. El BFF actual no reenvía la IP del visitante: las lecturas pueden compartir una IP de salida del servidor. Antes de publicar, debe calibrarse la cuota con el recorrido/concurrencia previstos y la configuración de proxies confiables, incluyendo varias instancias. No se cambiaron cuotas ni cabeceras de confianza como parte de esta auditoría.

## Cartografía, peso y carga

Las consultas de datos y las solicitudes del mapa base son presupuestos distintos. OpenLayers/`ol-mapbox-style` se cargan por `dynamic()` cuando se monta el mapa. Entrar con `vista=lista` difiere el motor, GeoJSON y solicitudes a OpenFreeMap. Abrir la vista inicial de mapa los necesita al hidratar.

Al pasar a lista se dispone el motor para liberar capas/fuentes. Reabrirlo vuelve a solicitar el estilo y puede necesitar recursos del proveedor, aunque el GeoJSON completado se conserve. Los movimientos de cámara pueden descargar teselas; eso no implica otra búsqueda en el catálogo. No hay prefetch masivo de teselas ni PWA offline. La prueba de volumen usa un estilo sintético inline sin teselas: mide este comportamiento de montaje, sin atribuir un costo fijo a OpenFreeMap.

La compresión de Next permanece habilitada: `next.config.ts` no la desactiva. La guía instalada de Next (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/compress.md`) describe gzip de contenido renderizado y archivos estáticos en `next start`. En la corrida aislada de esta entrega, el HTML inicial tuvo `Content-Encoding: gzip`; las respuestas JSON BFF 200 del recorrido no tuvieron `Content-Encoding` en escritorio ni móvil. `compress: true` no acredita compresión de esas rutas JSON. Debe verificarse su compresión y `Vary: Accept-Encoding` en la infraestructura elegida, conservando los límites sobre bytes descomprimidos. No se configuró un proxy de compresión/alojamiento ni un proveedor como parte de esta auditoría. El fixture informa bytes JSON UTF-8 sin comprimir; no deben sumarse como si fueran bytes de transferencia comprimidos.

Las fuentes Noto Sans salen del mismo origen en WOFF2/WOFF, con subconjuntos Latin/Latin-ext y `unicode-range`; el navegador pide los necesarios. Se precargan sólo los WOFF2 Latin normal 400 y 700 usados por la interfaz. Los assets de fuentes tienen URL versionada y caché inmutable. La UI actual usa SVG y Canvas; no hay fotografías/raster propios que justifiquen una conversión adicional de formatos o agregar un optimizador de imágenes. Se preserva el criterio de texto alternativo: descriptivo para contenido informativo y vacío para imágenes decorativas.

Oportunidades que requieren medición representativa antes de cambiar código:

- Medir bytes/tiempo del motor y del mapa base en móviles físicos y redes lentas, separando primera apertura, volver a abrir y mover la cámara. El medidor existente `tools/measure-map.mjs` registra recursos y memoria con fixtures aislados.
- Medir si conviene conservar o cachear recursos del estilo al alternar; cualquier cambio debe repetir el laboratorio de memoria y preservar cancelaciones y atribución dinámica. El ahorro de tráfico no se deduce sólo del tamaño del bundle.
- Evaluar caché HTTP del catálogo sólo con una política de invalidación/revisiones acordada con backend. Agregarla ahora podría mezclar versiones.
- Si una muestra real supera el mapa parcial con frecuencia, evaluar área/filtros y capacidad operativa con evidencia de cantidad, distribución, geometrías y latencias; no duplicar la paginación existente.

## Medición reproducible y aislada

Después de generar un build vigente, ejecutar:

```powershell
npm run test:e2e -- e2e/map-request-volume.spec.ts --project=desktop-chromium --project=mobile-chromium
```

La configuración inicia exclusivamente el fixture en `127.0.0.1:4100` y `next start` en `127.0.0.1:3102`, sin reutilizar procesos existentes. Bloquea red externa, sirve cartografía sintética y deshabilita WebGL. El endpoint `/__requests` existe **sólo** en `tools/mock-public-api.mjs`; conserva en memoria rutas, parámetros, estado y bytes JSON de respuestas sintéticas para incluir lecturas SSR invisibles en la red del navegador. No agrega una ruta de diagnóstico a la aplicación pública ni persiste datos.

Cada caso adjunta `map-request-volume.json` en los resultados Playwright. Contiene el proyecto, checkpoints, lecturas upstream del fixture, solicitudes del navegador, cancelaciones y límites de interpretación. Los snapshots del registro se comparan desde el comienzo del caso; la suite usa un worker.

| Caso | Resultado que exige la prueba |
| --- | --- |
| Recorrido de interacción con 24 obras/18 ubicaciones | Entrada lista: 1 lista/0 GeoJSON/0 fichas. Cargar más: 2/0/0 acumulados. Primera apertura mapa: 2/1/0. Mover/zoom: conserva 2/1/0. Selección exacta: 2/1/1. Resumen, selección repetida y dos alternancias completas: conserva 2/1/1, con tres solicitudes de estilo por los tres montajes. Confirmar área: 3/2/1. Aplicar fuente conservando área: 4/3/1. |
| 600 Features sintéticas validadas por contrato | Cinco solicitudes de 100 Features, cursores desde inicio hasta `volume-offset-400`, 500 Features representadas y cursor `volume-offset-500` pendiente. Aviso visible de mapa parcial; alternar después no repite GeoJSON. |
| Respuesta inicial retenida/cancelada | Una lista SSR, dos intentos GeoJSON upstream/navegador, uno cancelado por el navegador y una lectura completada tras reabrir; una alternancia posterior no agrega un tercer intento. La demora es deliberada del fixture y no mide latencia real. |

Registro final de ejecución de esta entrega: **12/12 casos pasan** sobre build de producción local: seis de mapa y seis de fichas HTML, distribuidos entre Chromium escritorio 1280×900 y Chromium móvil emulado 390×844. El recorrido de interacción también pasó **10/10 repeticiones** (cinco por proyecto). La inspección de código, TypeScript y `docs:check` finales también pasaron. Los conteos de la tabla se verificaron en ambos proyectos; los bytes medidos fueron idénticos entre ellos:

| Muestra sintética | Solicitudes y datos observados |
| --- | --- |
| Recorrido completo de interacción | 8 lecturas upstream: 4 listas, 3 GeoJSON y 1 ficha; 43.530 bytes JSON acumulados. Mover/zoom, resumen y alternancia completada no agregaron lecturas de catálogo. |
| Primeros datos de la consulta | Lista inicial de 20 obras: 15.654 bytes. GeoJSON de 18 ubicaciones: 16.094 bytes. Son tamaños de estas respuestas sintéticas, no promedios del catálogo real. |
| Presupuesto de 600 Features | 5 páginas recibidas, 500 Features/500 posiciones y 452.265 bytes JSON; 100 Features pendientes, con aviso de mapa parcial y sin otra lectura al alternar. |
| Cancelación deliberada y reapertura | 1 lista y 2 intentos GeoJSON upstream: 47.842 bytes JSON. El navegador canceló un intento y completó el otro; alternar después no agregó una tercera lectura. La respuesta retenida ya había sido leída desde el fixture, por lo que se cuenta el costo upstream de ambos intentos. |
| Compresión del recorrido | HTML inicial con gzip; respuestas BFF 200 sin `Content-Encoding`. El estilo sintético no descarga teselas: estos casos no miden su volumen ni su compresión. |

Los doce informes completos de la corrida final y `summary.json` se conservaron en `artifacts/local-validation/preparacion-sitio-publico/volumen-mapa/`, ignorado por Git, para que otra ejecución de Playwright no los borre. Las repeticiones finales tienen diez informes y resumen propios en `repeticiones-finales/`; las trazas y resultados anteriores se preservaron por separado, como se detalla abajo. La corrida integrada mantuvo su resultado **143/144**: después de reparar sólo la sincronización del medidor, los pases focales verifican el caso restante y completan los 144 casos distintos. No se presenta esa corrida integrada como 144/144.

Sigue pendiente medir el volumen real por visitante/concurrencia, respuesta API y cartografía, percentiles de latencia, geometrías representativas y dispositivos físicos. Estos fixtures no verifican un catálogo de 709 obras ni producen un p95 real, y el tamaño de la respuesta sintética no representa capacidad de producción.

## Costo de recuperación HTML de fichas

La reparación de 404 sin JavaScript incorpora una comprobación en `src/proxy.ts` antes del render de fichas. Se aplica a GET de documento `/obras/:id`, valida UUID/revisión y consulta el estado HTTP de esa misma ficha. Sólo un 404 con sobre `PublicApiError` válido reescribe hacia la recuperación estática con status 404; en el fixture el código es `NOT_FOUND`. Ese sobre tiene un límite de 16 KiB. En otros estados se cancela el body y la página maneja el resultado; errores o un 404 cuyo body sea HTML, vacío, inválido o excesivo también conservan ese recorrido. El presupuesto total de comprobación y lectura del sobre es 2 segundos; además respeta la cancelación de la solicitud original. HEAD, POST, RSC y prefetch no usan esta comprobación.

El beneficio es entregar recuperación HTML visible antes de entrar al render que produjo un documento vacío en Next. Su costo esperado es una lectura y un viaje de red adicionales para una ficha válida, previos a la lectura validada que genera el contenido. Ambas consumen la cuota de catálogo. Cancelar el body no elimina la solicitud ni garantiza ahorro de trabajo de base/serialización de la API.

| Navegación de documento sin JavaScript | Lecturas upstream y bytes observados en ambos proyectos |
| --- | --- |
| Ficha existente actual o por revisión exacta | 2 GET a la misma obra/revisión: comprobación 200 y lectura del contenido 200. Cada respuesta ofrece 1.603 bytes JSON; 3.206 bytes ofrecidos entre ambas por navegación. |
| UUID válido sin publicación | 1 GET con respuesta 404 y sobre de 91 bytes JSON; la recuperación estática no consulta otra ficha. |
| UUID/revisión inválidos o revisión repetida | 0 lecturas y 0 bytes de catálogo; se rechaza el enlace antes de llamar a la API. |

Los tres casos de ficha por proyecto usan snapshots independientes del ledger del fixture y comprueban HTTP y contenido sin JavaScript. Pasaron **6/6**, incluidos dentro de los doce casos finales del archivo. Los bytes del ledger representan el body que el fixture ofrece: cancelar el body evita leer/validar el JSON completo de una comprobación 200 en el frontend, pero el upstream puede serializar y enviar toda la respuesta antes de esa cancelación. No se acredita ahorro de bytes de transferencia; el costo de las dos lecturas GET es real.

La corrida integrada posterior al proxy obtuvo **143/144** pases: falló la medición móvil de selección al consultar el ledger antes de completar la ficha. La traza registra el retorno inmediato de `networkidle` y la lectura del ledger mientras el GET de ficha seguía en curso; la captura posterior ya muestra el detalle completo. El heading se podía construir con el listado sin esperar esa respuesta. Se corrigió únicamente el test para esperar el estado visible «Ubicación aprobada destacada…» antes de contar, conservando las assertions estrictas y el comportamiento de la aplicación. La evidencia de falla y los once informes disponibles se preservaron en `volumen-mapa/integrada-previa/`.

La primera repetición focal del recorrido obtuvo **7/10** pases (cinco intentos por proyecto). Las tres fallas, una de escritorio y dos móviles, ocurrieron al confirmar el área: el texto «Consulta por área» aparecía antes de completar el nuevo GeoJSON. En la traza móvil el GET GeoJSON comenzó en 37.553,420 ms y duró 15,013 ms; la lectura del ledger comenzó en 37.560,389 ms, antes de esa respuesta. `networkidle` seguía siendo un estado ya alcanzado y no esperaba la nueva consulta. Las tres trazas/contextos/capturas y los siete informes se conservaron en `volumen-mapa/repeticiones-previas/`.

La primera implementación de esa espera produjo **0/10** pases por errores del propio test: nueve selectors ambiguos de `role=status`, que también incluían el aviso de carga del motor, y un timeout de observación de respuesta. Sus artefactos se preservaron en `volumen-mapa/repeticiones-espera-inicial/`. Corregir el selector permitió un smoke **2/2**, seguido de **9/10** pases en la repetición; el único timeout restante ocurrió en `Response.finished()` después de la navegación HTML de filtros. La traza muestra que `waitForResponse` ya había terminado y que GeoJSON respondió 200; el contexto final mostraba el catálogo cargado. Ese resultado y los nueve informes se conservaron en `volumen-mapa/repeticiones-respuestas/`.

La sincronización final usa como fuente primaria el ledger del fixture: después del estado visible que exige cada acción, `expect.poll` espera hasta diez segundos los conteos exactos esperados; luego se toma otro snapshot y se vuelve a exigir la comparación estricta. También se espera la URL de área antes de capturar su bbox, y se conserva la espera del detalle visible. El fixture registra estado y bytes sin pausa en el mismo handler antes de responder. El checkpoint no depende de `networkidle` ni de la promesa `Response.finished()` durante navegación, no agrega solicitudes de catálogo y no modifica la aplicación. El smoke final pasó **2/2** en 9,8 s; las repeticiones finales pasaron **10/10** en 41,3 s y la corrida final pasó **12/12** en 24,6 s.

Después de la corrida de doce se agregó `expect(filtered).toHaveLength(8)` para detectar también una ruta inesperada del fixture, además de los conteos 4 listas/3 GeoJSON/1 ficha. Se verificó con una nueva corrida del recorrido: **2/2** pases en 9,7 s, uno por proyecto, archivada en `volumen-mapa/assertion-total-lecturas/`. Los doce informes previos ya registraban ocho lecturas, pero esa corrida no contenía aún la assertion explícita de longitud.

El OpenAPI público 0.7.0 documenta GET de ficha, sin una operación HEAD ni endpoint de existencia confirmado. No se sustituyó la comprobación por un HEAD supuesto: incluso una implementación implícita de HEAD podría ejecutar toda la consulta. Una optimización futura requiere acordar una comprobación liviana contractual con backend, o un diseño de servidor que comparta una única lectura validada dentro de la misma solicitud, preservando revisión, errores y consistencia. No se agregó caché global ni se cambió la API para resolverlo.

## Generación de contrato dentro del frontend

`tools/sync-contract.mjs` ahora compila las fuentes de API como entradas de sólo lectura, con salida en un directorio `public-contract-*` dentro de `artifacts/local-validation/` del frontend e incremental desactivado para evitar `tsbuildinfo` en el backend. Copia el exporter allí conservando sus imports, resuelve las dependencias mediante un enlace a `node_modules` del backend y lo desvincula antes de borrar el temporal. Comprueba el destino físico y el prefijo antes de la eliminación; si no puede desvincular dependencias, conserva el temporal. Mantiene `--backend`, `contract:sync` y `contract:check`, sin iniciar la API, cargar `.env` o acceder a la base.

La regeneración a 0.7.0 agrega las tres respuestas 429 y `RateLimitedError` en OpenAPI/tipos/esquemas. Una comparación semántica confirma que los esquemas existentes, el resto del OpenAPI y los ejemplos sintéticos permanecen iguales. Los archivos generados se obtuvieron exclusivamente con el sincronizador; no se editaron a mano. `npm run contract:sync` y la comprobación secuencial final `npm run contract:check` pasaron con el temporal aislado y eliminado. La primera comparación detectó metadata concurrente de la API; se regeneró una vez antes de la comprobación final exitosa.
