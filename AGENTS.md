# Obras Transparentes: frontend público

- Consultá la skill local `.agents/skills/project-context/SKILL.md` para requisitos y referencias del proyecto.
- La etapa 1 prepara el contrato y la integración; la interfaz, Next.js y el mapa pertenecen a etapas posteriores.
- Revisá el estado de Git y conservá cambios ajenos antes de editar. Trabajá en una rama desde `main` y seguí `CONTRIBUTING.md`: `feature/`, `fix/`, `docs/`, `refactor/` o `chore/`, con tema breve en minúsculas y guiones, sin prefijos propios de herramientas.
- Los archivos de `contracts/` y `src/api/generated.ts` se regeneran mediante `npm run contract:sync`; no los edites a mano. El cliente importa sólo `contracts/schemas.json`, sin rutas ni ejemplos de Swagger.
- Los ejemplos son sintéticos. No publiques datos ni modifiques la API activa como parte de una comprobación de lectura.
- Distinguí desconocidos de cero, fuente de organismo responsable y fecha de publicación de fecha del dato.
- Verificá typecheck, tests, build y sincronización de contrato según el cambio. Documentá resultados y pendientes en `docs/etapa-1.md`.
- Hacé commit o push cuando el usuario lo solicite.
