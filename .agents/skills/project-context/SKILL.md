---
name: project-context
description: Recuperar requisitos, decisiones y contrato vigente de ObrasTransparentes antes de cambiar su frontend público o integrar la API. Usar para trabajo de producto e integración en este repositorio.
---

# Contexto de ObrasTransparentes

Desde la raíz del repositorio, leer `docs/etapa-2.md` y `docs/etapa-1.md` para distinguir alcance autorizado, decisiones adoptadas, hipótesis y validaciones pendientes. Consultar `docs/referencias.md` para localizar el plan y los documentos originales; leer en Drive sólo lo pertinente a la tarea, sin copiar manuales o documentos completos a esta skill.

Para cambios de integración, revisar `contracts/openapi.json`, `src/api/generated.ts` y `src/api/client.ts` actuales. Si aún no existen o no coinciden, explicitar qué falta y revisar el exportador/sincronizador antes de suponer rutas, campos o filtros. Generar los tipos desde el contrato con el procedimiento documentado en el repositorio; no mantener entidades duplicadas manualmente. `contracts/examples.json` contiene datos sintéticos, no evidencia de cobertura real.

Preservar NestJS/PostgreSQL/PostGIS y la base TypeScript independiente. La etapa 2 adopta Next.js App Router y MapLibre + OpenFreeMap, con lista inicial y mapa diferido. El contrato se valida en servidor; el navegador usa rutas públicas de mismo origen. Consultar presupuestos, caché y límites en `docs/etapa-2.md`. Las instrucciones explícitas del usuario y la evidencia actual prevalecen sobre hipótesis anteriores.

Al avanzar en la interfaz pública, recuperar los requisitos de mobile-first, mapa/lista sincronizados con alternativa textual completa, WCAG 2.2 AA, URLs compartibles y geolocalización opcional iniciada por el usuario. No presentar una elección de librería como prueba de accesibilidad, SEO o rendimiento; registrar las verificaciones efectivamente realizadas y sus límites.
