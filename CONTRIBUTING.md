# Colaboración

## Alcance de los cambios

- Mantené cada cambio acotado a un objetivo que se pueda revisar.
- Revisá el estado de Git antes de empezar y no incluyas cambios ajenos en tu commit.
- Documentá las decisiones acordadas; señalá las que sigan abiertas.
- Para diseño o estilos del frontend público, consultá [docs/guia-visual.md](docs/guia-visual.md). Reutilizá sus tokens y patrones; documentá cualquier extensión o excepción junto con su verificación de accesibilidad.

## JSDoc y documentación HTTP

- Seguí [docs/documentacion-codigo.md](docs/documentacion-codigo.md) para documentar módulos y declaraciones propias con JSDoc descriptivo.
- Actualizá los comentarios junto con el comportamiento y ejecutá `npm run docs:check`; el build exige esta convención también al código nuevo.
- Documentá cada contrato HTTP con sus solicitudes, respuestas, errores y seguridad. Regenerá los snapshots y tipos afectados desde el backend.
- Al revisar, comprobá que los comentarios expliquen el contrato y los límites, y que las obras publicadas sin ubicación se identifiquen claramente en los listados.

## Ramas y commits

- Para cambios que requieran revisión, trabajá en una rama breve creada desde `main` y abrí un pull request.
- Usá el prefijo que describa el tipo de cambio y un tema corto en minúsculas separado por guiones:
  - `feature/<tema>` para funcionalidad nueva, por ejemplo `feature/fase-1-fundamentos`.
  - `fix/<tema>` para corregir un defecto.
  - `docs/<tema>` para documentación.
  - `refactor/<tema>` para reorganizar código sin cambiar su comportamiento.
  - `chore/<tema>` para mantenimiento, herramientas o configuración.
- Evitá nombres de personas, espacios, fechas y prefijos propios de herramientas.
- Preferí commits pequeños con un mensaje `tipo: resumen`, como `docs: agrega guia de colaboracion`.
- No reescribas la historia de `main` ni fuerces cambios en ramas compartidas.

## Pull requests

- Usá `.github/pull_request_template.md` como guía. Explicá el objetivo, los cambios, la verificación realizada, las decisiones pendientes y la asistencia de IA cuando corresponda.
- Mantené la descripción actualizada si cambia el alcance del pull request.
- No incluyas prompts, datos confidenciales ni credenciales en la descripción.
