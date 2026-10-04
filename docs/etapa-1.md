# Etapa 1: base de integración pública

Fecha de decisión y validación: **2026-10-03**. Estado: base implementada y verificada en las ramas `feature/etapa-1-integracion` (frontend) y `feature/contrato-publico` (API). La instancia local ya ejecuta el nuevo contrato; la aceptación con fichas públicas reales sigue pendiente porque su catálogo está vacío.

## Objetivo y alcance

Establecer un contrato comprobable entre el frontend público y la API existente antes de desarrollar la interfaz. Esta etapa prepara un cliente TypeScript independiente del framework, tipos generados desde OpenAPI, validación de respuestas en ejecución y un acceso local al backend mediante un proxy de mismo origen.

No incluye landing, listado visual, mapa, geolocalización, diseño de filtros, backoffice ni despliegue público. Next.js sigue siendo una propuesta para la aplicación pública; esta base no lo adopta ni lo descarta. NestJS y PostgreSQL/PostGIS permanecen como backend. React/Vite continúa como opción planteada para el backoffice.

Las fuentes de producto y técnicas se encuentran en [referencias.md](referencias.md). El plan de Drive es una referencia viva: este documento conserva decisiones locales, no una copia completa del plan.

## Punto de partida observado

El frontend contenía únicamente `README.md` al comenzar esta etapa. No había aplicación, bundle, ruta pública ni prototipo móvil que permitiera medir rendimiento. Por lo tanto, no existe una línea base de LCP, INP, CLS, memoria o peso del mapa.

El plan menciona **557 registros normalizados de CABA** y una ficha publicada de muestra. Son evidencia del trabajo descripto allí, no un conteo verificado de la API actual ni una garantía de cobertura territorial.

## Decisiones adoptadas para esta etapa

| Decisión                            | Aplicación y límite                                                                                                                                                                                                                                                                                                          |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contrato derivado del backend       | `contracts/openapi.json` se obtiene del exportador del backend. No mantener manualmente una segunda definición de sus entidades.                                                                                                                                                                                             |
| Tipos generados                     | `src/api/generated.ts` se genera con `openapi-typescript`. Sus tipos son una ayuda de compilación, no validación de respuestas HTTP.                                                                                                                                                                                         |
| Validación en ejecución             | El cliente verifica respuestas contra los esquemas del contrato con Ajv. Los casos inválidos deben producir un error explícito.                                                                                                                                                                                              |
| Esquemas separados                  | `contracts/schemas.json` es el subconjunto generado que importa el cliente; las rutas y ejemplos de Swagger quedan fuera de su código en ejecución. Medir su costo real de bundle y validación al crear el prototipo.                                                                                                        |
| Ejemplos sintéticos                 | `contracts/examples.json` contiene fixtures identificados como sintéticos. No representan datos reales, cobertura ni calidad de la fuente.                                                                                                                                                                                   |
| Cliente independiente del framework | `src/api/client.ts` concentra el consumo público. No agrega dependencias de React, Next.js o del motor de mapas.                                                                                                                                                                                                             |
| Listado con área opcional           | `bbox` se incorpora como filtro opcional del listado. Sin él, la exploración textual puede funcionar sin depender del mapa. Se conserva la paginación definida por la API.                                                                                                                                                   |
| Semántica pública de datos          | El contrato describe `estado`, clasificaciones y `metadata`. `metadata.publicadoEn` identifica en ISO UTC la primera publicación de esa revisión; `metadata.fechaActualizacionFuente` es `null` cuando la fecha de actualización de la fuente no está acreditada. No derivar una fecha de fuente de la fecha de publicación. |
| Proxy local de alcance limitado     | `tools/dev-proxy.mjs` ofrece un punto de entrada local de mismo origen en el puerto 3001, restringido a `GET`/`HEAD` de rutas públicas admitidas. No es un proxy abierto, un acceso administrativo ni un diseño de producción.                                                                                               |
| Generación reproducible             | `tools/sync-contract.mjs` sincroniza el contrato exportado y genera tipos. La exportación debe poder realizarse sin iniciar la aplicación ni conectar a la base de datos.                                                                                                                                                    |

Las rutas, parámetros, formatos, valores admitidos y respuestas exactas se leen del OpenAPI generado. Si el cliente y esta descripción divergen del contrato, investigar la diferencia antes de añadir un comportamiento supuesto.

Para validar respuestas, el backend exporta también JSON Schema draft 7 desde los mismos esquemas Zod del contrato. Esta salida preserva las tuplas `[longitud, latitud]` que OpenAPI 3.0 no representa exactamente; el cliente la consume sin convertir Swagger a mano. La validación de transporte no reemplaza las reglas de dominio/PostGIS sobre topología y procedencia.

## Plan de ejecución

1. Ajustar en el backend el contrato de lectura pública: esquemas OpenAPI, área opcional del listado y metadatos públicos.
2. Exportar el contrato sin base de datos; guardar la instantánea y generar los tipos del consumidor.
3. Incorporar el cliente TypeScript y su validación de respuestas, incluidos errores de red/HTTP y datos incompatibles con el contrato.
4. Añadir fixtures sintéticos y pruebas de integración del consumidor que no requieran datos de producción.
5. Incorporar el proxy local limitado y probar tanto las rutas admitidas como los rechazos.
6. Registrar resultados reales de validación y diferencias pendientes antes de comenzar la interfaz.

Los comandos operativos y requisitos del entorno deben mantenerse en el `README.md` y `package.json`; esta lista describe el resultado esperado, no reemplaza esos comandos.

## Checklist de cierre

- [x] El contrato se exporta sin iniciar servidor, cargar `.env` ni conectar a la base de datos.
- [x] OpenAPI, JSON Schema draft 7, ejemplos y tipos se regeneran y `contract:check` no encuentra diferencias.
- [x] El contrato cubre listado, ficha, GeoJSON y errores; el cliente toma los tipos de filtros desde OpenAPI.
- [x] El listado con área coincide con las obras del GeoJSON en pruebas PostGIS; sin área conserva las obras sin ubicación. El área participa en el cursor y una obra con varias ubicaciones no duplica filas.
- [x] Paginación, territorio y filtros se serializan sin trasladar parámetros de la interfaz.
- [x] El cliente valida ejemplos completos/parciales/vacíos, rechaza porcentajes y coordenadas inválidos, conserva desconocidos y excluye coordenadas candidatas.
- [x] Se distinguen HTTP, JSON malformado, respuestas incompatibles y errores de red/cancelación, incluso al leer el body.
- [x] El proxy permite lectura pública y rechaza escrituras, rutas privadas, destinos/redirecciones no admitidos y esperas excesivas.
- [x] Typecheck, tests y build del frontend pasan.
- [x] Build, typecheck, lint e integración del backend pasan; la suite unitaria requiere el timeout ampliado registrado abajo en este equipo.
- [x] La consulta a la API activa se documenta por separado de las pruebas con fixtures sintéticos.
- [x] Instancia local E7 actualizada, saludable y con listado por área HTTP 200 y los cinco esquemas públicos publicados en Swagger.
- [x] Auditoría de aceptación acotada: fichas por revisión, paginación espacial completa antes de comparar conjuntos, versiones exactas y estados `passed` / `incomplete` / `failed`.
- [ ] Aceptación con una muestra representativa de fichas realmente publicadas.

### Registro de validación

Entorno: Windows, Node `24.21.0`, npm `11.19.0`. Pruebas de persistencia contra la base aislada `obras_transparentes_test`, mediante el runner y su verificación de destino; no se cargaron fixtures en el catálogo público activo.

| Repositorio | Verificación                                                                            | Resultado                                                                                               |
| ----------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Frontend    | `npm run typecheck`, `npm run build`                                                    | Pasan.                                                                                                  |
| Frontend    | `npm test`                                                                              | 39 pruebas pasan: 20 de cliente/contrato y 19 de aceptación acotada.                                    |
| Frontend    | `npm run test:proxy`                                                                    | 5 pruebas pasan: alcance público, caché, credenciales, redirecciones, errores y desconexión.            |
| Frontend    | `npm run contract:sync`, `npm run contract:check`                                       | Generación sin BD; instantáneas y tipos sincronizados.                                                  |
| API         | `npm run typecheck`, `npm run lint`, `npm run build`                                    | Pasan.                                                                                                  |
| API         | `npm run test:integration`                                                              | 101 pruebas pasan.                                                                                      |
| API         | Repetición aislada de `e2-review-publication.spec.ts` tras añadir la aserción histórica | 10 pruebas pasan, incluida preservación de la fecha de primera publicación tras reemplazar la revisión. |
| API         | `npm run test:unit -- --testTimeout=15000`                                              | 583 pruebas pasan.                                                                                      |
| Skill local | `quick_validate.py .agents/skills/project-context`                                      | Skill válida; PyYAML utilizado sólo en un directorio temporal, sin dependencia nueva del proyecto.      |

La ejecución unitaria con timeout por defecto de 5 segundos falló dos veces en la prueba no modificada `bounds 100 grouped synthetic proposals...` de `e6-review-rules.spec.ts` (aproximadamente 5,6 segundos). Se verificó la suite con 15 segundos por prueba, sin cambiar código ni configuración para ocultar esa limitación. No se atribuye esa ejecución como un pase del comando por defecto.

`npm run test:e2e` completó 51 pruebas HTTP exitosas y 3 omitidas en la suite E7. Esa aceptación está desactivada por defecto mediante `E7_ACCEPTANCE_ENABLED`; no se presenta como una prueba ejecutada ni se habilitó para este trabajo.

La revisión independiente detectó y permitió corregir dos problemas: cancelaciones durante `response.json()` transformadas en errores de contrato, y pérdida de los rangos posicionales de coordenadas al exportar tuplas a OpenAPI 3.0. Las pruebas del consumidor y una comprobación independiente con Ajv confirman los fixes. JSON Schema valida el transporte, pero las reglas topológicas y semánticas que dependen de refinements permanecen en el dominio/PostGIS.

La instancia de `127.0.0.1:3000` inicialmente ejecutaba una versión anterior, que rechazaba `bbox` del listado con HTTP 422. Para el cierre se recompiló la API y se reinició únicamente ese proceso con su misma configuración `.env.acceptance.e7`; no se cambiaron identidad, worker, datos ni volúmenes. Después del reinicio, salud y listado por área responden HTTP 200 y Swagger expone los cinco esquemas públicos. Listado y GeoJSON siguen vacíos, con `catalogoVersion="0"`.

`npm run api:check` ahora ejecuta `src/api/acceptance.ts`: consulta una página general, recorre lista y GeoJSON del área con límites y verifica una muestra de fichas por revisión. Compara conjuntos únicamente si los dos recorridos espaciales terminan; cuenta obras únicas aunque tengan varias ubicaciones. Las cancelaciones por timeout, cambios de catálogo, cursores repetidos e identidades inconsistentes quedan identificados en el reporte. El comando distingue muestra consistente (`passed`, salida 0), aceptación inconclusa (`incomplete`, salida 2) y falla (`failed`, salida 1).

La ejecución contra la instancia actual informó `incomplete`, `NO_PUBLIC_WORKS`, `NO_SPATIAL_SAMPLE` y `NO_DETAIL_SAMPLE`. La API acepta el contrato, pero la ausencia de fichas impide acreditar contenido real o cobertura. Las 19 pruebas de aceptación agregadas verifican esos límites y los casos poblados con fixtures sintéticos; el total del frontend es ahora 39 pruebas más 5 del proxy. Los parámetros `API_CHECK_*` permiten elegir la zona, páginas, fichas y tiempos sin barrer el catálogo completo. El reporte no incluye registros, identificadores, coordenadas ni URLs de fuentes.

No existe todavía un bundle web ni medición móvil. Los archivos locales sin comprimir miden aproximadamente 122 kB (OpenAPI), 79 kB (esquemas runtime) y 10 kB (ejemplos); sólo los esquemas runtime se importan en el cliente. Estos tamaños de archivos no son una medición del JavaScript transferido. En el prototipo se decidirá si conviene compilar validadores o separar la validación de fichas para cumplir el presupuesto móvil.

## Continuidad hacia la etapa 2

La [etapa 2](etapa-2.md) implementa Next.js y mapa diferido. Sus decisiones/validaciones actualizan las hipótesis de interfaz/framework que se enumeran abajo; esta página conserva el registro histórico. Sigue pendiente aceptación con fichas reales porque el catálogo continúa vacío.

## Pendientes registrados al cerrar esta etapa

- Definir búsqueda por texto (`q`) y filtro por organismo con semántica y cobertura conocidas antes de agregarlos al cliente.
- Unificar la representación de territorio y la relación entre provincia, municipio y otros niveles disponibles; no asumir que los datos de CABA generalizan al resto del país.
- Definir facets y conteos sobre el universo filtrado, incluyendo el tratamiento de valores desconocidos y la diferencia entre total del área y página recibida.
- Diseñar el reporte de errores de datos y de fallas del servicio; acordar qué eventos se registran, sin enviar ubicación precisa por defecto.
- Precisar qué estados y clasificaciones son comparables entre fuentes. La ausencia de un dato no significa ausencia de obras ni un estado de avance determinado.
- Preservar la semántica de la normalización al diseñar las fichas: decimales como cadenas según el contrato, moneda desconocida sin asumir pesos, fecha de corte/publicación/medición diferenciadas y avance del 100 % sin inferir automáticamente un estado de obra completada.
- Elegir el framework público y la política de publicación/invalidez de caché según cantidad de fichas, ritmo de altas/correcciones y capacidad operativa. Next.js con HTML inicial y mapa diferido sigue siendo una hipótesis; React/Vite con prerender o SSR mantenido es una alternativa.
- Diseñar URL estable de ficha y parámetros compartibles de zona, filtros y selección, junto con el comportamiento de volver atrás.

## Requisitos de producto que deben preservar las próximas etapas

La web pública será mobile-first, con una landing explicativa, fichas públicas útiles para SEO y enlaces directos, y exploración mediante mapa y lista sincronizados. La lista debe ofrecer una alternativa textual completa: búsqueda y navegación de resultados sin necesidad de operar el mapa.

WCAG 2.2 AA es el objetivo de accesibilidad. Las próximas interfaces deben contemplar teclado, foco visible y no oculto, lectores de pantalla, nombres de controles, estados de carga/error, gestos con alternativa por pulsación y objetivos táctiles suficientes. El control móvil “Mapa | Lista” y el panel deslizable requieren validación de uso; no se consideran una solución accesible por su sola presencia.

La geolocalización será opcional y se solicitará únicamente después de una acción explícita y explicada. Si se rechaza, falla o no está disponible, debe continuar la selección manual de zona y la exploración por lista.

MapLibre GL JS + OpenFreeMap es una hipótesis para el piloto sin cargo por solicitud o carga. Antes de integrarla se revisarán las condiciones vigentes, atribución, privacidad y degradación cuando el proveedor falle. La instancia pública de OpenFreeMap no ofrece SLA; la lista y las fichas deben seguir siendo útiles ante una falla del mapa. La etapa 1 no instala ni evalúa su rendimiento.

El prototipo móvil deberá medir carga inicial, JavaScript transferido, tiempo hasta lista utilizable, tiempo desde abrir el mapa hasta poder operarlo, consultas por área, apertura de ficha y memoria tras alternar vistas. Los objetivos de rendimiento y la selección inicial de filtros se validarán con datos representativos, dispositivos modestos y redes lentas; no se deducen del framework elegido.
