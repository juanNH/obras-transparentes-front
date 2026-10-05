# Obras Transparentes: frontend público

- Consultá la skill local `.agents/skills/project-context/SKILL.md` para requisitos y referencias del proyecto.
- La etapa 1 prepara el contrato; la etapa 2 agrega Next.js y mapa/lista públicos. Consultá `docs/etapa-2.md` para decisiones y límites vigentes.
- Revisá el estado de Git y conservá cambios ajenos antes de editar. Trabajá en una rama desde `main` y seguí `CONTRIBUTING.md`: `feature/`, `fix/`, `docs/`, `refactor/` o `chore/`, con tema breve en minúsculas y guiones, sin prefijos propios de herramientas.
- Los archivos de `contracts/` y `src/api/generated.ts` se regeneran mediante `npm run contract:sync`; no los edites a mano. El cliente importa sólo `contracts/schemas.json`, sin rutas ni ejemplos de Swagger.
- Los ejemplos son sintéticos. No publiques datos ni modifiques la API activa como parte de una comprobación de lectura.
- Distinguí desconocidos de cero, fuente de organismo responsable y fecha de publicación de fecha del dato.
- Verificá typecheck, tests, build y sincronización de contrato según el cambio. Para UI ejecutá también E2E con fixtures aislados. Documentá resultados en la etapa correspondiente.
- Hacé commit o push cuando el usuario lo solicite.
- Seguí [docs/documentacion-codigo.md](docs/documentacion-codigo.md): JSDoc `@file` en módulos propios y descripción de contratos en declaraciones mantenidas. El código nuevo debe pasar `npm run docs:check`, incluido en el build; no edites los artefactos generados para cumplirlo.
- Las obras publicadas sin ubicación aprobada deben indicar claramente que no aparecen en el mapa y conservar acceso a lista y ficha. La ausencia de geometría no equivale a una obra sin publicar.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
