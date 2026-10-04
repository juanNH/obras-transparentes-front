---
name: project-context
description: Recuperar requisitos, decisiones y contrato vigente de ObrasTransparentes antes de cambiar su frontend público o integrar la API. Usar para trabajo de producto e integración en este repositorio.
---

# Contexto de ObrasTransparentes

Desde la raíz del repositorio, leer `docs/etapa-1.md` para distinguir alcance autorizado, decisiones adoptadas, hipótesis y validaciones pendientes. Consultar `docs/referencias.md` para localizar el plan y los documentos originales; leer en Drive sólo lo pertinente a la tarea, sin copiar manuales o documentos completos a esta skill.

Para cambios de integración, revisar `contracts/openapi.json`, `src/api/generated.ts` y `src/api/client.ts` actuales. Si aún no existen o no coinciden, explicitar qué falta y revisar el exportador/sincronizador antes de suponer rutas, campos o filtros. Generar los tipos desde el contrato con el procedimiento documentado en el repositorio; no mantener entidades duplicadas manualmente. `contracts/examples.json` contiene datos sintéticos, no evidencia de cobertura real.

Preservar NestJS/PostgreSQL/PostGIS como backend y la base TypeScript independiente del framework. La etapa 1 prepara integración: Next.js y MapLibre + OpenFreeMap siguen como propuestas, sin UI ni mapa implementados. Las instrucciones explícitas del usuario y la evidencia actual prevalecen sobre una hipótesis anterior del plan.

Al avanzar en la interfaz pública, recuperar los requisitos de mobile-first, mapa/lista sincronizados con alternativa textual completa, WCAG 2.2 AA, URLs compartibles y geolocalización opcional iniciada por el usuario. No presentar una elección de librería como prueba de accesibilidad, SEO o rendimiento; registrar las verificaciones efectivamente realizadas y sus límites.
