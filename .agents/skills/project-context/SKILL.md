---
name: project-context
description: Recuperar requisitos, decisiones y contrato vigente de ObrasTransparentes antes de cambiar su frontend público o integrar la API. Usar para trabajo de producto e integración en este repositorio.
---

# Contexto de ObrasTransparentes

Desde la raíz del repositorio, leer `docs/etapa-2.md` y `docs/etapa-1.md` para distinguir alcance autorizado, decisiones adoptadas, hipótesis y validaciones pendientes. Consultar `docs/referencias.md` para localizar el plan y los documentos originales; leer en Drive sólo lo pertinente a la tarea, sin copiar manuales o documentos completos a esta skill.

Para cambios de integración, revisar `contracts/openapi.json`, `src/api/generated.ts` y `src/api/client.ts` actuales. Si aún no existen o no coinciden, explicitar qué falta y revisar el exportador/sincronizador antes de suponer rutas, campos o filtros. Generar los tipos desde el contrato con el procedimiento documentado en el repositorio; no mantener entidades duplicadas manualmente. `contracts/examples.json` contiene datos sintéticos, no evidencia de cobertura real.

Preservar NestJS/PostgreSQL/PostGIS y la base TypeScript independiente. La etapa 2 adopta Next.js App Router y OpenLayers Canvas 2D + ol-mapbox-style + OpenFreeMap. El recorrido vigente abre mapa y resultados juntos, con lista HTML inicial completa por paginación; `vista=lista` difiere el motor y proveedor. Cambiar presentación no aplica bbox ni borra páginas/selección; el encuadre usa geometrías reales, y sólo «Buscar en esta zona» confirma un área. Debe mostrar la cartografía con catálogo vacío y WebGL deshabilitado, sin pedir al visitante cambios de configuración. La API conserva WGS84; la proyección del renderer es interna. Fuentes Noto Sans del mismo origen y atribución visible; un cambio de proveedor requiere revisar también estilos, fuentes, sprites y privacidad. El contrato se valida en servidor; el navegador usa rutas públicas de mismo origen. Consultar presupuestos, caché y límites en `docs/etapa-2.md`. Las instrucciones explícitas del usuario y la evidencia actual prevalecen sobre decisiones anteriores.

Al avanzar en la interfaz pública, recuperar los requisitos de mobile-first, mapa/lista sincronizados con alternativa textual completa, WCAG 2.2 AA, URLs compartibles y geolocalización opcional iniciada por el usuario. No presentar una elección de librería como prueba de accesibilidad, SEO o rendimiento; registrar las verificaciones efectivamente realizadas y sus límites.

Para validar el mapa, usar cartografía/API sintéticas aisladas y WebGL bloqueado en los E2E. Un fallo de inicialización del navegador de pruebas no es un pase ni un defecto demostrado de la aplicación. Separar compatibilidad funcional, medición de laboratorio, smoke del proveedor y aceptación en dispositivos/datos reales; un catálogo versión "0" vacío deja esta última incompleta.

Ante un catálogo vacío, verificar la instancia y su archivo de entorno antes de concluir que no existen publicaciones: E7 y desarrollo pueden servir el mismo puerto con bases diferentes. El BFF usa `PUBLIC_API_URL`; el auditor `API_ORIGIN`. No sembrar datos para llenar el mapa. Validar cobertura del bbox y fichas generales por separado, porque puede haber publicaciones fuera del área. Al cambiar el ciclo de vida del mapa, repetir el laboratorio de alternancia y memoria: disponer capas/fuentes y evitar callbacks que retengan el contexto React desde cachés del adaptador.
