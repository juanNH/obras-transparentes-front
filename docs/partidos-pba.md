# Consulta de los 135 partidos de Buenos Aires

Entrega local del 2026-10-06 con contrato público OpenAPI 0.9.0. La nómina nominal, los límites cartográficos y las publicaciones de obras conservan contratos y presupuestos independientes. Habilitar los 135 partidos no significa que se hayan relevado o publicado todas sus obras.

## Comportamiento

- `/mapa` lee la lista y `GET /api/v1/territorios/pba/partidos` en paralelo. Si falla una lectura, conserva la otra y ofrece recuperación. La interfaz no inventa un catálogo territorial de respaldo.
- El selector HTML incluye los 135 partidos aunque no haya obras publicadas. Conserva la alternativa sin JavaScript. La búsqueda local mejora el selector después de hidratar; ignora tildes y mayúsculas y no consulta la red.
- Aplicar un partido envía su UUID propio `partidoId` a lista y GeoJSON. La interfaz no transforma los códigos externos de cinco o seis dígitos en identidades intercambiables. La API determina las equivalencias admitidas.
- El filtro corresponde al **partido informado por la fuente**. No acredita gestión municipal, ubicación espacial verificada ni cobertura exhaustiva. Un resultado vacío conserva esa limitación.
- El filtro anterior `territorioEsquema=pba.municipio` + `municipioCodigo` permanece disponible en enlaces existentes. Se debe quitar antes de aplicar `partidoId`; no se combinan ambos filtros.
- «Sin filtro por partido» omite `partidoId` y consulta todo el catálogo, incluidas publicaciones de CABA. Con JavaScript se omiten opciones vacías del formulario; el GET HTML nativo puede incluir parámetros vacíos en la URL, que se descartan antes de consultar la API.
- La fecha y versión mostradas corresponden a la nómina, no a la actualización de las fuentes de obras. La referencia conserva enlaces y atribución del catálogo recibido.

## Lecturas y límites

El catálogo territorial dispone de un presupuesto propio de **128 KiB JSON y cinco segundos** por lectura. El BFF acepta sólo `GET /api/public/territorios/pba/partidos`, sin parámetros, valida la respuesta con el esquema generado y no propaga credenciales del visitante.

Cada navegación de `/mapa` obtiene la nómina en servidor. Buscar nombres, mover el mapa, seleccionar una obra o alternar vistas no vuelve a leerla. «Reintentar nómina de partidos» consulta sólo el catálogo territorial y conserva los resultados. Las pruebas de volumen distinguen estas lecturas de las ocho lecturas de obras de su recorrido sintético; sus bytes no se atribuyen al catálogo de obras.

## Capa territorial para representación

El catálogo habilita límites con `limites.estado=VALIDATED_FOR_DISPLAY`, versión `pba-partidos-limites@1`, tamaño, hash y conteo de posiciones. El estado `PENDING_LICENSE_AND_VALIDATION` sigue admitido y mantiene el selector nominal disponible, con la capa deshabilitada. Los límites proceden de [GeoRef](https://www.argentina.gob.ar/georef), cartografía de origen IGN, bajo [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). La interfaz conserva la fuente y licencia de la respuesta, enlaza la atribución y declara el uso de geometría simplificada para representación.

«Mostrar límites de partidos» es un control accesible independiente de la consulta de obras. Sólo descarga la distribución cuando se activa en el mapa. `limites=mostrar` conserva esa preferencia en el enlace y no se envía como filtro de obras. Mostrar, ocultar y alternar lista/mapa reutilizan una única distribución completa en memoria, identificada por versión y hash; no se guardan consultas ni datos del visitante. Salir a lista o desactivar la capa cancela una lectura pendiente; una falla permite reintentar sin retirar obras ni resultados.

El BFF exige una única versión explícita en `/api/public/territorios/pba/partidos/limites?version=pba-partidos-limites%401`, valida el esquema generado y el cliente concilia 135 UUID, nombres y códigos con la nómina. Rechaza distribuciones parciales, identidades duplicadas o versiones divergentes. La capa dispone de **1,5 MiB JSON descomprimido y 100.000 posiciones**, ocho segundos de lectura upstream y quince segundos en navegador. El BFF conserva `no-store`; no reenvía el ETag del archivo tras serializar la respuesta JSON. La caché de memoria sólo retiene una distribución ya completada y validada.

OpenLayers dibuja los límites en una capa separada, debajo de ubicaciones, agrupaciones y selección de obras. Un clic sobre una obra conserva su prioridad; un clic sobre un límite usa el UUID del catálogo para aplicar **partido informado por la fuente**. No asigna obras por intersección ni centros de partidos. Los límites de obras siguen siendo 500 features/10.000 posiciones y 2 MiB; las 55.842 posiciones territoriales no consumen ese presupuesto.

La distribución final contiene 135 MultiPolygon y 55.842 posiciones, ocupa **1.462.641 bytes** y tiene SHA-256 `e57052221b80e709c8199adf2672dbf432a5618f2014466af129317bc5a61920`. El corte de GeoRef es v13.0.0, generado el 2026-04-09T23:30:31.718106Z; la fecha 2026-10-06 identifica la consulta. La simplificación conjunta nominal de 50 m no acredita un error máximo de posición: el Hausdorff discreto observado fue 170,7653 m sin densificación. El asset sirve para representar territorio, sin afirmar precisión catastral o vigencia jurídica y sin modificar ubicaciones de obras.

## Verificación

**247/247 pruebas unitarias** y 20 archivos pasan. Incluyen identidad/URL, exclusión del filtro anterior, continuidad independiente de nómina y obras, versiones de límites, cancelación por exceso de bytes, conciliación de los 135 polígonos y caché acotada. `contract:check`, `typecheck`, build y `docs:check` pasan; este último registra 84 módulos y 253 declaraciones documentadas.

La verificación E2E integrada aprobó los 62 casos previos de disponibilidad, compatibilidad de mapa y volumen de consultas en Chromium de escritorio/móvil/tablet y WebKit móvil según los proyectos configurados, además de los casos territoriales. La pasada focal de nómina y límites cierra **14 casos** en Chromium de escritorio y móvil: búsqueda local sin red, UUID compartible, opción sin filtro, alternativa HTML sin JavaScript, clic sobre Tornquist real, recuperación independiente, cancelación y reutilización de límites. Los seis supuestos incorrectos de la primera pasada territorial (20 resultados en un bbox que sólo contiene 18, y píxel central fuera del mapa sintético) se corrigieron sin alterar el comportamiento del producto. El último caso móvil captura los bytes reales del BFF mediante `route.fetch/fulfill` porque Chromium retiró su cuerpo de inspección CDP después de finalizar la lectura.

La carga/render usa el asset GeoRef final completo. Obras y mapa base son sintéticos y las solicitudes externas quedan aisladas. Los informes y capturas están en `artifacts/local-validation/partidos-pba/georef-real-{desktop,mobile}-chromium.{json,png}`. Una muestra local sin throttling registró 294,91 ms de carga/pintura en escritorio y 283,99 ms en móvil emulado, 1.462.641 bytes JSON descomprimidos, una lectura de límites, ninguna consulta de obras causada por el toggle, ningún error de navegador, Axe sin hallazgos y ausencia de desbordamiento horizontal. Estos tiempos son muestras individuales de laboratorio, no p95 ni resultados de teléfonos físicos.

`node tools/measure-map.mjs --memory-only --party-boundaries` pasó en procesos locales aislados. El informe `artifacts/local-validation/map-lab-party-boundaries/report.json` y la captura `budget-mobile.png` distinguen los límites GeoRef reales de 500 MultiPoint/10.000 posiciones de obras sintéticas. Con viewport 390×844, CPU 4×, red de 1,6 Mbps y 150 ms de latencia, la muestra fría pintó el mapa base sintético a los **2.915,20 ms** y terminó mapa/datos/límites a los **8.923,10 ms**; añadió 171.310 bytes de scripts codificados (578.463 descomprimidos). No hubo errores de navegador ni solicitudes externas inesperadas. La respuesta GeoJSON de obras se intercepta en laboratorio para estresar el render, por lo que no mide rendimiento de API/PostGIS ni coste del proveedor cartográfico real.

La prueba de memoria reduce CPU a 1×, desactiva la clonación de respuestas y fuerza GC después de cada vuelta a Lista. Diez alternancias y una muestra final tras 16 segundos inactivos registraron **1.804.804 bytes de crecimiento JS retenido (1,72 MiB)** frente al umbral de regresión de 4 MiB. Las once muestras de Lista y la final tuvieron cero Canvas. El resultado comprende heap JavaScript y no demuestra ausencia absoluta de fugas ni mide memoria nativa/Canvas de un teléfono.

Los fixtures de obras son sintéticos y están aislados de la API activa; la nómina conserva el catálogo final y el fixture de límites es una copia íntegra del asset licenciado con el mismo hash. Las pruebas de interfaz no acreditan exhaustividad de obras, WCAG completo, precisión catastral ni rendimiento en dispositivos físicos.
