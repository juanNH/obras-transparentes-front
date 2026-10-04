# Obras Transparentes: frontend público

Web mobile-first con landing, exploración como lista o mapa y fichas públicas con fuentes. La etapa 2 usa Next.js App Router sobre el contrato de NestJS/PostGIS. El backoffice permanece en su repositorio React/Vite.

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

`build` y `dev` preparan el worker de MapLibre desde la dependencia fijada, incluida su licencia. `public/maplibre/` es salida generada e ignorada por Git; conservarla junto a `.next/` y `public/` en el despliegue. Se usa Webpack con `extensionAlias` para conservar los imports `.js` del cliente TypeScript NodeNext independiente. `npm run build:api` sigue produciendo el cliente de diagnóstico en `dist/`.

## Configuración

Variables sólo del servidor, documentadas en `.env.example`:

| Variable | Uso |
| --- | --- |
| `PUBLIC_API_URL` | Base pública de NestJS, por defecto `http://127.0.0.1:3000/api/v1`. Sin credenciales. |
| `SITE_URL` | Origen público de canonical y sitemap. Por defecto `http://localhost:3002`. Configurarlo antes del build. |
| `SITE_INDEXABLE` | `false` por defecto. Configurar `true` antes de compilar un despliegue público revisado. |
| `MAP_STYLE_URL` | Estilo HTTPS compatible con MapLibre; por defecto Liberty de OpenFreeMap. |
| `REPORT_EMAIL` | Correo atendido por el proyecto. Sólo si está configurado aparece el enlace para informar errores. |

La landing se prerenderiza. Lista y fichas se consultan en servidor sin caché de datos para no mezclar versiones. El navegador usa exclusivamente `/api/public/…`: rutas GET limitadas, sin cookies ni autorización hacia NestJS, con validación de contrato, timeout y presupuesto de respuesta. No es un proxy general ni expone el backoffice.

Los assets con hash aprovechan la caché del framework. El mapa base sigue las cabeceras del proveedor; no hay precarga masiva, almacenamiento offline ni service worker. El despliegue necesita Node; un export estático no cubre estos endpoints ni fichas dinámicas.

## Rutas y comportamiento

- `/`: proyecto, método y acceso al catálogo, con HTML inicial.
- `/mapa`: lista inicial de 20 obras, utilizable sin JavaScript. Filtros y página siguiente con formularios/enlaces nativos.
- `/mapa?vista=mapa&bbox=west,south,east,north`: mapa y lista de la misma área. «Buscar en esta zona» actualiza ambos; mover el mapa no consulta el catálogo.
- `/mapa?obra=UUID&revisionId=UUID`: abre el resumen de una revisión. Atrás/Adelante restaura la selección.
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
npx playwright install chromium
npm run test:e2e
```

E2E inicia una API sintética aislada en 4100 y la web de producción en 3102; no escribe datos ni consulta la API activa. Necesita esos puertos libres y un build previo. Comprueba escritorio/móvil, HTML sin JavaScript, teclado, axe, paginación, cambios de catálogo, geolocalización denegada y worker/capas del mapa con estilo local interceptado. Chromium usa SwiftShader: valida función, no rendimiento de una GPU móvil real. No reemplaza revisión manual con lectores de pantalla.

Con `npm start` activo, `node tools/measure-mobile.mjs` genera capturas responsive y una muestra fría de laboratorio en `artifacts/local-validation/`, ignorado por Git. Usa Chromium, CPU ×4, red simulada y sólo lectura; no activa geolocalización. Los números de una API vacía no representan fichas reales ni percentiles de campo. `LAB_SITE_URL` permite elegir otro origen y `--visual-only` limita la ejecución a capturas.

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
