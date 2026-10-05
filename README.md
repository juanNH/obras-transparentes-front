# Obras Transparentes: frontend público

Web mobile-first con landing, exploración como lista o mapa y fichas públicas con fuentes. La etapa 2 usa Next.js App Router sobre el contrato de NestJS/PostGIS. El backoffice permanece en su repositorio React/Vite.

La interfaz aplica la [guía visual](docs/guia-visual.md): blanco y celeste, acciones azules, detalles dorados y Noto Sans del mismo origen. La guía reúne tokens, patrones y criterios de accesibilidad para mantener esa identidad en próximos cambios; las decisiones funcionales y validaciones siguen en [etapa 2](docs/etapa-2.md).

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

`build` y `dev` preparan las fuentes Noto Sans locales y su licencia desde la dependencia fijada. `public/map-fonts/` es salida generada e ignorada por Git; conservarla junto a `.next/` y `public/` en el despliegue. El mapa usa OpenLayers Canvas 2D + ol-mapbox-style y no requiere WebGL. Con cero obras, muestra la cartografía y el estado vacío de la consulta. Se usa Webpack con `extensionAlias` para conservar los imports `.js` del cliente TypeScript NodeNext independiente. `npm run build:api` sigue produciendo el cliente de diagnóstico en `dist/`.

## Configuración

Variables sólo del servidor, documentadas en `.env.example`:

| Variable | Uso |
| --- | --- |
| `PUBLIC_API_URL` | Base pública de NestJS, por defecto `http://127.0.0.1:3000/api/v1`. Sin credenciales. |
| `SITE_URL` | Origen público de canonical y sitemap. Por defecto `http://localhost:3002`. Configurarlo antes del build. |
| `SITE_INDEXABLE` | `false` por defecto. Configurar `true` antes de compilar un despliegue público revisado. |
| `MAP_STYLE_URL` | Estilo HTTPS MapLibre v8 interpretado por ol-mapbox-style; por defecto Liberty de OpenFreeMap. Al cambiar proveedor, revisar estilo, atribución, sprites y privacidad. |
| `REPORT_EMAIL` | Correo atendido por el proyecto. Sólo si está configurado aparece el enlace para informar errores. |

La landing se prerenderiza. Lista y fichas se consultan en servidor sin caché de datos para no mezclar versiones. El navegador usa exclusivamente `/api/public/…`: rutas GET limitadas, sin cookies ni autorización hacia NestJS, con validación de contrato, timeout y presupuesto de respuesta. No es un proxy general ni expone el backoffice.

Las rutas `/api/public/obras`, `/api/public/obras/{obraId}` y `/api/public/geojson` pertenecen a esta web (3002); NestJS expone `/api/v1/obras`, `/api/v1/obras/{obraId}` y `/api/v1/obras/geojson`. Si devuelve catálogo `"0"` vacío, verificar el archivo de entorno con que arrancó la API: una instancia de aceptación puede usar otra base que desarrollo. `PUBLIC_API_URL` elige la instancia para Next y `API_ORIGIN` para `api:check`. No cargar fixtures para ocultar un catálogo vacío. Reiniciar Next tras cambiar su configuración.

Para conservar otra API ya activa, se puede arrancar desarrollo en un puerto libre, desde el repositorio de la API: `$env:PORT="3003"; node --env-file=.env dist/main.js`. En el `.env` local de este frontend, usar `PUBLIC_API_URL=http://127.0.0.1:3003/api/v1` y `API_ORIGIN=http://127.0.0.1:3003`. Elegir la base de desarrollo configurada en ese repositorio; iniciar la API no publica obras ni ejecuta migraciones. Esta configuración local queda fuera de Git.

Los assets con hash aprovechan la caché del framework. El mapa base sigue las cabeceras del proveedor; no hay precarga masiva, almacenamiento offline ni service worker. El despliegue necesita Node; un export estático no cubre estos endpoints ni fichas dinámicas.

## Rutas y comportamiento

- `/`: proyecto, método y acceso al catálogo, con HTML inicial.
- `/mapa`: mapa con encuadre de las geometrías cargadas y resultados de todo el catálogo, incluidos faltantes. Lista inicial de 20 obras, utilizable sin JavaScript; filtros y página siguiente nativos.
- `/mapa?vista=lista`: alternativa textual sin cargar el motor ni el proveedor del mapa. Alternar vistas conserva consulta, páginas cargadas y selección.
- `/mapa?vista=mapa&bbox=west,south,east,north`: mapa y lista de la misma área. «Buscar en esta zona» actualiza ambos; mover el mapa no consulta el catálogo.
- `/mapa?obra=UUID&revisionId=UUID`: restaura y ubica la revisión seleccionada. El resumen se abre con una acción explícita; cerrarlo mantiene la selección. Atrás/Adelante la restaura.
- `/obras/UUID`: ficha actual con canonical y fuentes. `?revisionId=UUID` conserva una publicación específica y lleva `noindex`.
- `/privacidad`, `/robots.txt`, `/sitemap.xml`: ubicación e indexación. Sitemap consistente hasta 2.000 fichas; si supera su límite, falla explícitamente y exige particionarlo.

Sin área, la lista incluye obras sin geometría. Con área sólo aparecen ubicaciones aprobadas que la intersectan; se ofrece quitar el área y consultar obras sin ubicación. El número de obras cargadas no representa un total. Los clusters cuentan puntos, que pueden corresponder a una misma obra.

La geolocalización sólo se activa mediante «Usar mi ubicación». Centrar no guarda coordenadas en el enlace; «Buscar en esta zona» es una acción posterior explícita que envía el área a la API y la incorpora a la URL. Rechazar el permiso conserva navegación manual y lista.

## Validar

```powershell
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

El workflow `Frontend` valida tipo, unitarias, proxy, build y E2E en Chromium, Firefox y WebKit sobre Linux. `contract:check` se ejecuta localmente con el repositorio hermano de la API. En este equipo Firefox de Playwright no pudo iniciar por un error de ensamblado de Windows; se verificó en Linux aislado, sin omitir sus casos. Los resultados y límites de la aceptación están en `docs/etapa-2.md`.

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
- [Documentación original y fuentes primarias](docs/referencias.md).
- [Skill local de contexto](.agents/skills/project-context/SKILL.md).

No se publica el sitio al ejecutar estos comandos. Antes del lanzamiento faltan muestra real representativa, responsable/contacto del proyecto, destino de alojamiento y pruebas en dispositivos/lectores de pantalla reales.
