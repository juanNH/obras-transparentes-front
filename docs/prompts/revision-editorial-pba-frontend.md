# Prompt de implementación — frontend público

**Modelo y rol:** GPT-6.1 Ultra, agente responsable del sitio público.
Preservá el alcance público y verificá cada cambio con fixtures aislados; no
uses el frontend para ejecutar tareas administrativas.

Mantené el sitio público como catálogo de obras publicadas. No expongas
propuestas, originales, licencias privadas, incidencias ni acciones editoriales.

Cuando exista un resumen público de cobertura, mostrar sólo datos publicados y
fechados: los 135 partidos como padrón nominal, cuántas obras publicadas tienen
ubicación aceptada y cuántas permanecen en lista sin marcador. Explicar que:

- una obra ubicada en un partido no demuestra que el municipio la gestione;
- el partido reportado, el territorio verificado y los límites visuales son
  dimensiones separadas;
- una propuesta pendiente, un duplicado o una advertencia interna no aparece
  hasta ser revisado, aprobado y publicado;
- la ausencia de obras publicadas es “sin cobertura publicada”, no cero obras.

Conservar CABA y Buenos Aires en el alcance global, el filtro de Buenos Aires
preseleccionado/deshabilitado mientras sea la única provincia soportada, la
selección múltiple de partidos y el botón de limpieza. No crear inferencias
territoriales desde la fuente, coordenadas candidatas o el mapa de límites.

Verificar contrato público, SSR/JS, no-JS, accesibilidad, mobile y mapa con
fixtures aislados. No importar datos ni contactar organismos.
