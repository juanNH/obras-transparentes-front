# Obras Transparentes: frontend público

Base de la **etapa 1: contrato e integración pública**. Incluye cliente TypeScript, validación de respuestas, ejemplos sintéticos, pruebas y proxy local. La landing, la interfaz de lista y el mapa se desarrollarán en la próxima etapa.

## Preparar el entorno

Usar Node.js `>=24.21 <25` y npm `>=11.19 <12`, como la API. Desde este repositorio:

```powershell
npm ci
Copy-Item .env.example .env
npm run typecheck
npm test
npm run test:proxy
npm run build
```

La copia de `.env` es opcional: los valores por defecto apuntan a `http://127.0.0.1:3000`. No agregar credenciales; las herramientas consumen únicamente endpoints públicos.

## Sincronizar con la API

La fuente del contrato es el backend en `C:\github\obras-transparentes`. Instalar sus dependencias según su README y luego ejecutar desde el frontend:

```powershell
npm run contract:sync
npm run contract:check
```

Si la API está en otra carpeta:

```powershell
npm run contract:sync -- --backend C:\ruta\obras-transparentes
```

El sincronizador compila el backend y exporta su documentación sin iniciar el servidor, cargar `.env` ni acceder a la base de datos. Regenera `contracts/openapi.json`, `contracts/schemas.json`, `contracts/examples.json` y `src/api/generated.ts`. `contract:check` falla si estos archivos difieren de las fuentes actuales de la API. Los tests y el build del consumidor usan las instantáneas versionadas y no necesitan tener el backend disponible.

El cliente importa únicamente los esquemas de respuesta en JSON Schema draft 7, derivados del mismo dominio que el OpenAPI. Esa salida conserva las restricciones de coordenadas `[longitud, latitud]` que OpenAPI 3.0 no representa exactamente. Las rutas de Swagger y los ejemplos no forman parte de su código en ejecución. El build produce módulos TypeScript compilados en `dist/`; todavía no existe un bundle web para medir rendimiento móvil.

## Probar lectura local

Con la API ya ejecutándose, iniciar el proxy:

```powershell
npm run dev:api
```

Consultar [listado público por el proxy](http://127.0.0.1:3001/api/v1/obras?limit=20). Este servidor escucha sólo en loopback, admite `GET`/`HEAD` en las rutas públicas de obras y no transmite cookies ni autorización. Sus pruebas verifican rechazos de rutas administrativas, otros métodos, redirecciones y fallas del backend. Es una herramienta de desarrollo; la configuración de origen y caché del despliegue se definirá junto con la aplicación pública.

Auditar una muestra pública: listado general, listado por área, GeoJSON y fichas por revisión, sin modificar datos:

```powershell
npm run build
npm run api:check
```

El comando devuelve `0` si la muestra es consistente, `2` si la aceptación está incompleta y `1` ante errores de contrato, HTTP o lectura. Un catálogo vacío, un área sin muestra, un cambio de catálogo o páginas sin terminar dan `incomplete`: no acreditan integración con fichas reales. Los conjuntos de mapa/lista se comparan sólo al completar ambos recorridos; varias Features pueden corresponder a una obra. Cada ficha se consulta con la revisión de su resumen y se verifican identidad y fecha de publicación.

Por defecto lee una página general, hasta tres páginas por cada consulta espacial de 20 resultados y hasta tres fichas, con cinco segundos por petición y 30 segundos en total. Configurá la zona y los límites con `API_CHECK_*` en `.env.example`. El reporte contiene estados y conteos; no vuelca fichas, identificadores, URLs ni coordenadas. Un pase acredita esa muestra, no su representatividad ni la cobertura del catálogo.

El contrato exportado corresponde al código del backend, no necesariamente al proceso activo. Si ese proceso usa una revisión anterior, actualizarlo según el procedimiento de la API antes de comprobar los nuevos campos o `bbox` del listado.

## Consumir el contrato

```typescript
import { createPublicApi, assertSameCatalog } from "./src/api/client.js";

const api = createPublicApi(); // /api/v1, mismo origen
const controller = new AbortController();
const bbox = [-59, -35, -58, -34] as const;
const [list, geojson] = await Promise.all([
  api.list({ bbox, limit: 20 }, { signal: controller.signal }),
  api.geojson({ bbox, limit: 100 }, { signal: controller.signal }),
]);
assertSameCatalog(list, geojson);
const first = list.items[0];
if (first) {
  const detail = await api.detail(first.obraId, first.revisionId);
}
```

Las consultas son cancelables; el cliente no reintenta automáticamente. Ante `CATALOG_CHANGED` se reinicia la paginación conservando los filtros. No concatenar páginas de distintas versiones ni inferir un total a partir de una página. GeoJSON pagina ubicaciones y el listado pagina obras: una obra puede tener varias Features. Sin `bbox`, el listado también incluye obras sin ubicación aprobada.

Los errores de HTTP (`PublicApiError`), respuestas incompatibles (`ApiContractError`) y errores de red/cancelación se conservan separados. Los importes, porcentajes y `catalogoVersion` mantienen su representación textual; los desconocidos conservan `null`.

## Documentación y continuidad

- [Plan, decisiones y validación de la etapa](docs/etapa-1.md).
- [Índice de fuentes originales y documentación técnica](docs/referencias.md).
- [Skill local de contexto](.agents/skills/project-context/SKILL.md), referenciada desde `AGENTS.md` para futuras tareas.

Next.js, MapLibre + OpenFreeMap y el comportamiento móvil siguen pendientes de validación. Esta base conserva NestJS/PostGIS y permite elegir el framework público sin duplicar el contrato de datos.
