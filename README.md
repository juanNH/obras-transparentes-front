# Obras Transparentes: frontend público

Web mobile-first con landing, exploración como lista o mapa y fichas públicas con fuentes. La etapa 2 usa Next.js App Router sobre el contrato de NestJS/PostGIS. El backoffice permanece en su repositorio React/Vite.

**Integración anterior comprobada el 5 de octubre de 2026:** el [PR #5](https://github.com/juanNH/obras-transparentes-front/pull/5) se fusionó mediante `8848de5`. Incorporó referencias de fuentes por color y forma, `/proyecto` y correcciones de selección, atribución y reflow. El [workflow Frontend 37380466432](https://github.com/juanNH/obras-transparentes-front/actions/runs/37380466432) pasó sobre `76590ca`, con 116/116 E2E en Linux, incluidas las diez pruebas de Firefox. Ese resultado corresponde a esa entrega; la verificación de JSDoc y publicaciones sin ubicación se registra aparte en [etapa 2](docs/etapa-2.md#jsdoc-y-publicaciones-sin-ubicación-en-el-mapa--2026-10-05).

En la revisión local del 5 de octubre, el sitio activo en `localhost:3002` corre en desarrollo y consulta la API E7 de `127.0.0.1:3000`; el backoffice funciona en `127.0.0.1:5173`. Publicar obras en ese catálogo habilita su consulta anónima local. La puesta en producción requiere su destino y configuración de operación.

La conciliación actual confirma catálogo **20**: **709 obras públicas**, **481 representadas mediante 483 geometrías** y **228 sin geometría**, todas consultables en lista y ficha. CABA tiene 489 publicaciones y 395 con ubicación; Vicente López tiene 12 publicaciones y ninguna geometría aceptada. Las fechas de actualización de fuente siguen sin informarse; la fecha de publicación no acredita frescura del dato ni la posición exacta de una obra.

La interfaz aplica la [guía visual](docs/guia-visual.md): blanco y celeste, acciones azules, detalles dorados y Noto Sans del mismo origen. La guía reúne tokens, patrones y criterios de accesibilidad para mantener esa identidad en próximos cambios; las decisiones funcionales y validaciones siguen en [etapa 2](docs/etapa-2.md).

El código propio sigue la [convención JSDoc](docs/documentacion-codigo.md): propósito de cada módulo y documentación de funciones, componentes, clases, tipos y contratos relevantes. Los cambios futuros deben mantener esos comentarios junto con el comportamiento que explican. `npm run docs:check` comprueba módulos nuevos y existentes y se ejecuta automáticamente antes del build.

## Ejecutar

Requiere Node.js `>=24.21 <25` y npm `>=11.19 <12`. Con la API funcionando en el puerto 3000:

```powershell
npm ci
# Opcional, sólo si no existe ya un .env local:
Copy-Item .env.example .env
npm run dev
```

Abrir [http://localhost:3002](http://localhost:3002). El puerto 3001 queda reservado al proxy de diagnóstico de etapa 1; el backoffice usa 5173. La web puede arrancar sin API: muestra un error recuperable en el catálogo. Una API vacía muestra un estado vacío, nunca datos de demostración.

Para producción:

```powershell
npm run build
npm start
```

`build` verifica primero JSDoc mediante `docs:check`; una declaración propia sin documentación impide compilar. `build` y `dev` preparan las fuentes Noto Sans locales y su licencia desde la dependencia fijada. `public/map-fonts/` es salida generada e ignorada por Git; conservarla junto a `.next/` y `public/` en el despliegue. El mapa usa OpenLayers Canvas 2D + ol-mapbox-style y no requiere WebGL. Con cero obras, muestra la cartografía y el estado vacío de la consulta. Se usa Webpack con `extensionAlias` para conservar los imports `.js` del cliente TypeScript NodeNext independiente. `npm run build:api` sigue produciendo el cliente de diagnóstico en `dist/`.

## Configuración

Variables sólo del servidor, documentadas en `.env.example`:

| Variable | Uso |
| --- | --- |
| `PUBLIC_API_URL` | Base pública de NestJS, por defecto `http://127.0.0.1:3000/api/v1`. Sin credenciales. |
| `SITE_URL` | Sin valor por defecto. Configurar sólo el origen HTTPS público real (sin ruta, parámetros ni credenciales) antes del build; orígenes locales, IP y nombres reservados no habilitan SEO público. |
| `SITE_ENVIRONMENT` | `local` por defecto; `local` y `staging` conservan `noindex`. Sólo `production` permite habilitar indexación con las otras dos variables. |
| `SITE_INDEXABLE` | `false` por defecto. `true` requiere además `SITE_ENVIRONMENT=production` y `SITE_URL` válida; desarrollo sigue cerrado. |
| `MAP_STYLE_URL` | Estilo HTTPS MapLibre v8 interpretado por ol-mapbox-style; por defecto Liberty de OpenFreeMap. Al cambiar proveedor, revisar estilo, atribución, sprites y privacidad. |
| `REPORT_EMAIL` | Contacto opcional para informar errores desde las fichas; sin valor predeterminado. Sólo se muestra con un correo válido configurado. Las páginas legales no publican correo. |

La landing se prerenderiza. Lista y fichas se consultan en servidor sin caché de datos para no mezclar versiones. El navegador usa exclusivamente `/api/public/…`: rutas GET limitadas, sin cookies ni autorización hacia NestJS, con validación de contrato, timeout y presupuesto de respuesta. No es un proxy general ni expone el backoffice.

Las solicitudes GET de documento a `/obras/UUID` comprueban antes de renderizar si la ficha o revisión está ausente, para ofrecer recuperación HTML incluso sin JavaScript. El precheck tiene un máximo total de 2 segundos: ante 404 lee sólo un sobre de error de hasta 16 KiB y lo valida contra `PublicApiError`; en otros estados cancela el body tras recibir los headers. No reenvía Cookie, Authorization o X-Forwarded-For. Un enlace inválido no consulta la API, un 404 compatible con el contrato hace una solicitud breve y una ficha válida requiere dos solicitudes upstream: precheck y lectura completa validada para el render. RSC, precargas y HEAD siguen el recorrido habitual. Un 404 con HTML, JSON inválido o sobre incompatible, fallas, timeout, 429 y 5xx pasan al manejo de errores existente. La [medición aislada](docs/volumen-mapa.md) registra ese costo y sus límites; un endpoint público liviano de existencia o una capacidad equivalente queda como dependencia futura de API. No hay caché global compartida ni traslado del contenido de ficha en headers.

Las rutas `/api/public/obras`, `/api/public/obras/{obraId}` y `/api/public/geojson` pertenecen a esta web (3002); NestJS expone `/api/v1/obras`, `/api/v1/obras/{obraId}` y `/api/v1/obras/geojson`. Si devuelve catálogo `"0"` vacío, verificar el archivo de entorno con que arrancó la API: una instancia de aceptación puede usar otra base que desarrollo. `PUBLIC_API_URL` elige la instancia para Next y `API_ORIGIN` para `api:check`. No cargar fixtures para ocultar un catálogo vacío. Reiniciar Next tras cambiar su configuración.

Para conservar otra API ya activa, se puede arrancar desarrollo en un puerto libre, desde el repositorio de la API: `$env:PORT="3003"; node --env-file=.env dist/main.js`. En el `.env` local de este frontend, usar `PUBLIC_API_URL=http://127.0.0.1:3003/api/v1` y `API_ORIGIN=http://127.0.0.1:3003`. Elegir la base de desarrollo configurada en ese repositorio; iniciar la API no publica obras ni ejecuta migraciones. Esta configuración local queda fuera de Git.

Los assets con hash aprovechan la caché del framework. El mapa base sigue las cabeceras del proveedor; no hay precarga masiva, almacenamiento offline ni service worker. El despliegue necesita Node; un export estático no cubre estos endpoints ni fichas dinámicas.

## Rutas y comportamiento

- `/`: proyecto, método y acceso al catálogo, con HTML inicial.
- `/proyecto`: referencias de los colores de fuente, roles informados, cobertura y créditos cartográficos.
- `/mapa`: mapa con encuadre de las geometrías cargadas y resultados de todo el catálogo, incluidos faltantes. Lista inicial de 20 obras, utilizable sin JavaScript; filtros y página siguiente nativos.
- `/mapa?vista=lista`: alternativa textual sin cargar el motor ni el proveedor del mapa. Alternar vistas conserva consulta, páginas cargadas y selección.
- `/mapa?vista=mapa&bbox=west,south,east,north`: mapa y lista de la misma área. «Buscar en esta zona» actualiza ambos; mover el mapa no consulta el catálogo.
- `/mapa?obra=UUID&revisionId=UUID`: restaura y ubica la revisión seleccionada. El resumen se abre con una acción explícita; cerrarlo mantiene la selección. Atrás/Adelante la restaura.
- `/obras/UUID`: ficha HTML actual con título propio, territorio reportado cuando existe y fuentes. `?revisionId=UUID` conserva una publicación específica y lleva `noindex`.
- `/privacidad`, `/terminos`: privacidad y condiciones del catálogo basadas en el funcionamiento actual, sin correo publicado. Mantienen visibles los datos del operador, el canal de consultas y la conservación propia aún no informados; la revisión jurídica y operativa se registra en la documentación.
- `/robots.txt`, `/sitemap.xml`: en local/staging robots bloquea todo y no anuncia sitemap; sitemap devuelve 404 sin consultar el catálogo. Sólo al habilitar producción con URL real se publican canonical, Open Graph de texto y sitemap consistente hasta 2.000 fichas; si supera su límite, falla explícitamente y exige particionarlo. La imagen y verificación de preview social quedan pendientes de esa URL y de un asset aprobado.

La descripción general y las metadescripciones existentes por página se conservan. Landing, proyecto, legales y fichas entregan contenido HTML inicial; los filtros del explorador mantienen `noindex`. El favicon SVG reutiliza el símbolo de la cabecera sin añadir una imagen raster. La configuración SEO se decide antes del build: no usar una URL local o de ejemplo como origen público ni habilitar indexación en staging. Mantener `SITE_URL`, `SITE_ENVIRONMENT` y `SITE_INDEXABLE` iguales entre build y arranque del mismo entorno; generar un build nuevo si cambian, para que metadatos prerenderizados, robots y sitemap mantengan la misma política.

Sin área, la lista incluye obras sin geometría. Con área sólo aparecen ubicaciones aprobadas que la intersectan; se ofrece quitar el área y consultar obras sin ubicación. El número de obras cargadas no representa un total. Los clusters cuentan puntos, que pueden corresponder a una misma obra.

Las publicaciones sin ubicación aprobada muestran **«Publicada · Sin ubicación en el mapa»** en la tarjeta, ficha y resumen, con icono y explicación legible. Siguen siendo obras publicadas y consultables. El aviso de lista cuenta únicamente las obras cargadas que no pueden dibujarse. «Ver solo obras sin ubicación en el mapa» conserva los demás filtros, quita área y cursor y abre la primera página en vista lista. Una consulta por área explica que no puede incluir esas publicaciones porque se desconoce si están dentro de la zona. Las revisiones históricas muestran «Revisión sin ubicación en el mapa»; la etiqueta no cambia el estado informado de la obra. Tener ubicación aprobada tampoco garantiza que esté visible en el encuadre actual o que un mapa parcial ya la haya cargado.

La geolocalización sólo se activa mediante «Usar mi ubicación». Centrar no guarda coordenadas en el enlace; «Buscar en esta zona» es una acción posterior explícita que envía el área a la API y la incorpora a la URL. Rechazar el permiso conserva navegación manual y lista.

## Validar

```powershell
npm run docs:check
npm run typecheck
npm test
npm run test:proxy
npm run contract:check
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
```

E2E inicia una API sintética aislada en 4100 y la web de producción en 3102; no escribe datos ni consulta la API activa. Necesita esos puertos libres y un build previo. Comprueba escritorio/celular/tablet, HTML sin JavaScript, teclado, axe, paginación, cambios de catálogo y geolocalización. La suite Canvas bloquea WebGL y usa cartografía vectorial sintética: mapa vacío, puntos/líneas/polígonos, selección y revisión, consulta por área, reintento, rotación de pantalla y cambios de vista. Chromium se inicia con `--disable-webgl`; Firefox y WebKit tienen proyectos de compatibilidad. La emulación no sustituye teléfonos físicos. No reemplaza revisión manual con lectores de pantalla.

Con `npm start` activo, `node tools/measure-mobile.mjs` genera capturas responsive y una muestra fría de laboratorio en `artifacts/local-validation/`, ignorado por Git. Usa Chromium, CPU ×4, red simulada y sólo lectura; no activa geolocalización. Los números de una API vacía no representan fichas reales ni percentiles de campo. `LAB_SITE_URL` permite elegir otro origen y `--visual-only` limita la ejecución a capturas.

`node tools/measure-map.mjs` usa el build existente y levanta sus propios servidores aislados en 4101/3103. Mide mapa vacío, 18 geometrías y el presupuesto de 500 MultiPoint/10.000 posiciones, con WebGL bloqueado, CPU ×4, red simulada y caché desactivada; incluye seis tamaños de pantalla y alternancia mapa/lista. Genera `artifacts/local-validation/map-lab/report.json` y capturas. No consulta la API activa ni descarga teselas reales. La cartografía sintética permite comparar regresiones, pero no representa el costo del proveedor ni un teléfono físico. `--visual-only` limita a layouts; `MAP_LAB_API_PORT` y `MAP_LAB_SITE_PORT` permiten otros puertos libres.

El workflow `Frontend` valida tipo, unitarias, proxy, build y E2E en Chromium, Firefox y WebKit sobre Linux; el build incluye `docs:check`. `contract:check` se ejecuta localmente con el repositorio hermano de la API. La entrega de JSDoc y avisos cartográficos pasó typecheck/build, 147 unitarias, 5 pruebas del proxy y 116 E2E distintos en los proyectos soportados localmente. Las diez pruebas de Firefox de esta entrega siguen pendientes de CI Linux: su pase en el PR #5 es evidencia histórica, y el problema previo de inicialización de Firefox en Windows permanece registrado. Los resultados y límites de la aceptación están en [etapa 2](docs/etapa-2.md#jsdoc-y-publicaciones-sin-ubicación-en-el-mapa--2026-10-05).

Auditoría real, acotada y de sólo lectura:

```powershell
npm run api:check
```

Devuelve `0` para muestra consistente, `2` para aceptación incompleta y `1` para falla. Un catálogo vacío no acredita fichas reales ni cobertura. `API_CHECK_*` controla zona, páginas, fichas y tiempos; el informe no vuelca datos ni coordenadas. No hay carga de fixtures en producción.

## Contrato y referencias

La API fuente está en `C:\github\obras-transparentes`:

```powershell
npm run contract:sync
npm run contract:check
# Otra ubicación:
npm run contract:sync -- --backend C:\ruta\obras-transparentes
```

La exportación compila el backend sin iniciarlo, cargar `.env` ni conectar su base. Genera `contracts/` y `src/api/generated.ts`; no editar esos archivos a mano. La comparación normaliza LF/CRLF. Ajv valida respuestas en el servidor; los esquemas y rutas de Swagger no se incluyen en el bundle del explorador.

- [Etapa 2: decisiones, límites y validación](docs/etapa-2.md).
- [Etapa 1: contrato e integración](docs/etapa-1.md).
- [Documentación del código: JSDoc y comprobación automática](docs/documentacion-codigo.md).
- [Documentación original y fuentes primarias](docs/referencias.md).
- [Skill local de contexto](.agents/skills/project-context/SKILL.md).

El catálogo local ya tiene publicaciones reales, documentadas en [etapa 2](docs/etapa-2.md). Para el lanzamiento de producción faltan responsable/contacto del proyecto, destino de alojamiento con dominio HTTPS y operación definida, y pruebas en dispositivos/lectores de pantalla reales. La cobertura y representatividad de los datos requieren su propia evaluación. La política actual de catálogo `no-store` permite seguir consultando el entorno local; cualquier cambio de caché debe conservar la coherencia de revisiones. `robots.txt` mantiene la indexación deshabilitada y el origen local configurado. No se comprobó un despliegue remoto durante esta revisión.
