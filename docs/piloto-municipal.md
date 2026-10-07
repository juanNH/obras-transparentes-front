# Fuentes del piloto municipal

El sitio público admite los códigos `bahia-obras`, `olavarria-obras` y
`pergamino-obras` junto con las cuatro fuentes anteriores. Las etiquetas nuevas
identifican al municipio editor de los datos; no atribuyen gestión, ejecución o
financiación de una obra. Las URLs y el selector de fuente conservan la consulta
textual, incluidas publicaciones sin ubicación aprobada.

Las cuatro fuentes municipales comparten categoría visual **Municipios**, rombo
y ocre. La leyenda y la página del proyecto aclaran que este tono no representa
el escudo o bandera de un municipio particular. Se mantienen los colores y
formas existentes, la alternativa textual y los créditos de OpenFreeMap y
OpenStreetMap.

La ficha y el resumen distinguen localizadores CSV, XLSX y JSON. Para JSON
muestran ordinal de registro, pointer e intervalo de bytes con fin exclusivo.
Esto describe procedencia física; no aprueba una ubicación ni habilita publicar
datos de una fuente con licencia pendiente. La API conserva esa decisión y sus
restricciones, aunque el renderer admita todos los códigos del contrato.

## Verificación aislada

Las pruebas nuevas usan exclusivamente datos sintéticos. Comprueban etiquetas,
roundtrip de filtro y acceso a obras sin punto, referencias físicas, nivel
municipal compartido y créditos. Los recorridos de UI verifican las tres
fuentes en consultas vacías del fixture y un resumen sintético con evidencia
JSON; no representan una importación o publicación real.

`NEXT_DIST_DIR` permite generar un build para QA o desarrollo sin sobrescribir
la `.next` de una aplicación activa. El valor por defecto sigue siendo `.next`.
En esta entrega se reserva `.next-piloto-municipal/`, ignorada por Git. Next exige
que ese directorio permanezca dentro del proyecto. Los tests UI usan API fixture
en 4100 y Next en 3102 después de comprobar que están libres; los procesos del
usuario y su `next-env.d.ts` se conservan.

El coordinador regenera `contracts/` y `src/api/generated.ts` desde el backend;
esos artefactos no se editan manualmente. La ampliación del contrato conserva la
semántica de publicación y de geometrías aprobadas.

La verificación del 6 de octubre de 2026 pasó: 299 pruebas unitarias,
`docs:check`, typecheck y build de producción aislado. Se comprobaron 14
escenarios UI en Chromium de escritorio y móvil emulado, incluyendo JSON
visible en el viewport, tres filtros municipales, leyenda, créditos y reflujo
a 320 px con texto al 200 %. Axe no reportó infracciones en los recorridos
verificados. Las capturas quedaron en
`artifacts/local-validation/piloto-municipal/`, fuera de Git. No se ejecutó
Firefox ni una prueba con dispositivo físico. `next-env.d.ts` y `tsconfig.json`
se restauraron byte a byte desde sus copias previas al QA; el typecheck directo
posterior también pasó.

## Licencias conservadas en cada publicación

La ficha y el resumen consumen `licenciasFuentes`, campo opcional generado desde
el contrato público. Presentan la atribución exacta, el alcance, la referencia
de licencia, la evidencia capturada y, cuando está registrada, la licencia y el
aviso de distribución de la base derivada. La captura de evidencia se muestra
en UTC y no reemplaza la fecha de actualización de la fuente.

La información corresponde a la decisión conservada al publicar esa revisión.
Una decisión posterior de licencia no cambia la atribución de una revisión
histórica. Sin ese campo, o con una colección vacía, el sitio indica que la
publicación no conserva evidencia de licencia; no asigna derechos a partir del
nombre de la fuente. Las referencias admiten sólo HTTP(S) sin credenciales y
las atribuciones se renderizan como texto. Los contenidos individuales muestran
su licencia únicamente cuando está registrada; la ficha no descarga ni embebe
imágenes o documentos externos.

La revisión de duplicados, identidad, ubicación e incidencias y el registro de
licencias se operan en el backoffice. Esta web mantiene una lectura pública de
revisiones publicadas. Las publicaciones sin ubicación aceptada conservan ficha
y alternativa textual, con el aviso de ausencia en el mapa. El editor municipal
de una fuente sigue sin acreditar ubicación territorial ni gestión municipal.

La validación de esta ampliación usa una ficha ODbL sintética adicional y una
publicación anterior sin licencia registrada. El fixture no cambia el número de
obras de la lista de pruebas ni conecta con la API o los originales municipales
del entorno operativo.

Esta ampliación pasó 346 pruebas unitarias, `docs:check`, TypeScript directo y
build de producción en `.next-piloto-municipal/`. Los 6 escenarios nuevos de
licencias pasaron en Chromium de escritorio y móvil, junto con los 8 recorridos
municipales existentes. Se verificaron HTML del servidor, atribución y aviso
conservados al recargar una revisión fijada, enlaces, ausencia de consultas a
fuentes mutables y de descargas externas, faltante histórico, reflujo a 320 px
con texto al 200 % y análisis Axe sin infracciones. Las capturas revisadas están
en `artifacts/local-validation/revision-municipal/`, fuera de Git. La prueba UI
comprueba el consumo del snapshot publicado; la conservación frente a una
decisión de licencia posterior se valida también en el backend. La validación
no realizó ingestas, aprobaciones ni publicaciones del entorno operativo.
