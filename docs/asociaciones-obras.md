# Asociaciones espaciales y roles institucionales publicados

Entrega local del 2026-10-06, en `feature/asociaciones-obras`. La UI conserva el territorio y los roles informados por las fuentes y presenta por separado las asociaciones verificadas que fueron publicadas con la revisión. No se asignan responsabilidades desde una fuente, coordenada, razón social o partido reportado.

## Consulta pública

Las tarjetas, fichas y resúmenes distinguen:

- **Territorio informado por la fuente**: conserva el filtro `partidoId` y sus equivalencias existentes.
- **Ubicación territorial verificada**: usa exclusivamente `asociacionesEspaciales` de la revisión publicada y muestra la relación interior/cruce y su evidencia.
- **Gestión municipal verificada**: requiere una organización de nivel municipal con partido propio y rol verificado de promotor, contratante, ejecutor o financiador. Un contratista municipal conserva su rol y no se presenta como gestión municipal.
- **Roles institucionales verificados**: conservan organización, rol, vigencia original y evidencia pública de revisión. Los roles reportados siguen en «Responsabilidades informadas».

La ausencia de asociaciones o roles publicados se explicita. No significa que la obra esté fuera del territorio o carezca de participantes. Las revisiones anteriores mantienen arrays públicos vacíos; una publicación histórica se lee por su `revisionId`, sin sustituir su evidencia por la revisión actual.

## Filtros aditivos y enlaces

El formulario GET mantiene la alternativa HTML sin JavaScript, los UUID propios del padrón de partidos y las identidades institucionales recibidas de la API. No ofrece un campo de UUID ni organizaciones deducidas de páginas del listado.

El grupo institucional ocupa una fila completa del formulario. Sus cuatro controles se distribuyen en cuatro columnas en escritorio, dos en ancho intermedio y una en móvil; las explicaciones del catálogo y del período conservan todo el ancho y permanecen visibles.

| Parámetro | Significado |
| --- | --- |
| `partidoId` | Partido reportado por la fuente; conserva el comportamiento existente. |
| `partidoVerificadoId` | Partido con una asociación espacial verificada publicada para la revisión. |
| `gestionMunicipalId` | Partido de una organización municipal con uno de los cuatro roles de gestión verificados. |
| `organizacionId` | Identidad institucional pública, independiente de las organizaciones de seguridad del backoffice. |
| `rolInstitucional` | `PROMOTOR`, `CONTRATANTE`, `EJECUTOR`, `FINANCIADOR` o `CONTRATISTA`. |
| `periodoDesde`, `periodoHasta` | Fechas civiles ISO `YYYY-MM-DD` que buscan solapamiento con la vigencia del rol. |

Organización, rol, gestión municipal y período deben cumplirse en la misma relación institucional. El período no corresponde al inicio/fin de la obra, a su publicación ni a la actualización de la fuente. La UI conserva la precisión original `YEAR` o `DAY` al mostrar cada extremo; una fecha ausente no equivale a una vigencia ilimitada. La consulta exige ambas fechas o ninguna; valida días reales y que «desde» no sea posterior a «hasta». Los controles HTML explican y comprueban esa pareja antes de enviar cuando JavaScript está disponible; el parser/BFF la valida también sin JavaScript.

Los filtros se envían iguales a lista y GeoJSON. Alternar lista/mapa, seleccionar y compartir conserva los filtros. Consultar obras sin ubicación conserva las asociaciones, quita área/cursor y abre la primera página en lista. Los filtros verificados pueden combinarse con el territorial histórico; la exclusión entre `partidoId` y el par `territorioEsquema`/`municipioCodigo` permanece.

## Catálogos, evidencia y límites

`GET /api/v1/organizaciones-institucionales` devuelve únicamente organizaciones con un rol verificado en publicaciones actuales. El servidor lee listado, partidos y organizaciones en paralelo; cada falla conserva las otras lecturas. «Reintentar organizaciones» consulta sólo ese catálogo y conserva las obras y la consulta aplicada.

El BFF permite únicamente `GET /api/public/organizaciones-institucionales`, sin parámetros, con contrato validado, `no-store`, credenciales omitidas y presupuesto propio de **512 KiB JSON descomprimido / cinco segundos**. Los bytes institucionales se contabilizan separados de obras y partidos en la verificación de volumen. Una organización presente en una revisión histórica puede no figurar en el catálogo de publicaciones actuales; el nombre en la revisión se conserva y el filtro no inventa una opción actual.

La ficha lee la nómina de partidos sólo cuando necesita rotular un UUID de asociaciones o roles. Una falla conserva la ficha y muestra que el nombre del padrón no está disponible; el enlace sigue identificando el filtro exacto. Esa lectura dispone del presupuesto territorial vigente de 128 KiB/cinco segundos y es independiente del precheck y detalle de la obra.

La evidencia de asociación muestra método/versión, distribución de límites utilizada, huellas y decisión publicada. La evidencia de roles reutiliza la presentación pública de celdas, metadatos, revisiones base y decisiones. No se publican actores internos ni se deducen identidades personales; los enlaces de evidencia se restringen además a HTTP(S) sin credenciales en la UI.

Los límites cartográficos `DISPLAY_ONLY` siguen destinados exclusivamente a representación. Mostrar, ocultar o elegir una figura del mapa conserva el filtro **reportado** y no crea una asociación verificada. La UI no ejecuta intersecciones ni reutiliza la geometría simplificada para acreditar ubicación o gestión.

## Verificación

Build final `--j51hsc7CHZF6oYrYymg`, Node 24.21.0/npm 11.19.0 en Windows. `contract:sync` regeneró snapshots/tipos desde la API sin iniciar servidor o conectar su base; `contract:check`, typecheck y build pasan. JSDoc comprueba **91 módulos y 264 declaraciones**; **282/282 unitarias** en 22 archivos y **5/5 pruebas del proxy** pasan.

La suite E2E soportada recorrió **170 casos** en Chromium de escritorio/móvil/tablet y WebKit móvil, con 167 pases iniciales. Encontró dos assertions que conservaban el total anterior de solicitudes y un desbordamiento del nuevo `fieldset` a 320 px/texto al 200 %. Se corrigió el total a **14 upstream = ocho obras + tres nóminas de partidos + tres catálogos institucionales**, conservando la separación de bytes. La revisión visual también detectó una columna institucional estrecha en escritorio; el grupo ocupa ahora toda la fila y sus controles usan cuatro/dos/una columnas `minmax(0, 1fr)`, con palabras y leyenda que pueden envolver.

Sobre el build final pasan **14/14 E2E focales en 46,1 segundos** en escritorio/móvil: los diez casos nuevos, volumen de solicitudes y reflow ampliado. Se comprobaron los valores reales de los tres selectores territoriales, organización, rol y fechas después de recargar la URL. Esto cierra **170 casos distintos con resultado exitoso** entre la pasada completa y la reparación focal; no se presenta la primera pasada como un 170/170 limpio. Las diez pruebas Firefox conservan la limitación histórica de inicialización local en Windows y no se ejecutaron ni se atribuyen como aprobadas en esta entrega.

Las pruebas usan obras, organizaciones y decisiones sintéticas en la API de fixtures aislada; no escriben ni consultan la API activa. La nómina real se usa exclusivamente como catálogo de nombres/identidades y la cartografía de prueba está aislada. Los servidores temporales de 4100/3102 se cierran al finalizar. Axe no encontró violaciones en los filtros ni en la ficha con evidencia abierta en los casos nuevos; las comprobaciones de reflow y ausencia de scroll horizontal pasan.

Las capturas de escritorio y móvil se guardan en `artifacts/local-validation/asociaciones-obras/`: `ficha-*.png`, `filtros-*.png`, las versiones de viewport `filtros-viewport-*.png`/`partidos-viewport-*.png` y el recorte del grupo `fieldset-*.png`, inspeccionadas visualmente. Las versiones de viewport permiten leer el formulario sin la reducción producida por una captura de página completa muy alta. La emulación y Axe verifican los recorridos cubiertos; no acreditan precisión espacial real, cobertura de obras, WCAG completo, lectores de pantalla o teléfonos físicos. No se realiza commit, push, PR, despliegue ni publicación de datos como parte de esta entrega.
