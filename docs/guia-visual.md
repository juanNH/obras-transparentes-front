# Guía visual de Obras Transparentes

Versión 2 · 2026-10-05 · frontend público.

Esta es la referencia de diseño para las próximas interfaces y refactors. La dirección acordada es **base clara, blanco y celeste**, con azul profundo para acciones y un acento dorado inspirado en el sol de la bandera argentina. Los valores son una interpretación de identidad del proyecto, no una especificación oficial de la bandera ni una identificación institucional.

La interfaz aplica esta guía en los estilos globales, explorador, ficha, ilustración y capas propias del mapa. El alcance funcional, la semántica de los datos y las decisiones técnicas siguen en [etapa-2.md](etapa-2.md), donde se registra la validación. Ante una necesidad nueva, documentar el patrón aquí antes de crear una variante local.

## 1. Identidad y propósito

**Información pública clara, con el territorio a la vista.** La app ayuda a encontrar obras, entender qué se informa y consultar su procedencia. La confianza se construye con lectura legible, controles previsibles y límites explícitos de los datos.

- Blanco como superficie de lectura; celeste para identidad, selección y contexto territorial.
- Azul profundo para vínculos y acciones. Cada pantalla debe tener una acción principal reconocible.
- Dorado en detalles pequeños de identidad. Los estados de una obra dependen de la fuente, no del color de marca.
- Jerarquía sobria: títulos claros, información agrupada, aire entre bloques y pocos elementos decorativos.
- La lista y la ficha deben resolver la consulta completa. El mapa complementa la información y conserva una alternativa textual.
- La consulta territorial relaciona mapa, resultados y obra seleccionada desde el inicio. Los componentes muestran qué se consulta, qué está seleccionado y qué cambia cada acción; esa relación da identidad a la interfaz además de su paleta.
- Una interfaz dinámica conserva contexto: alternar una presentación no debe sustituir filtros, resultados o selección. Separar selección, lectura de resumen y confirmación de área mediante acciones explícitas.

### Cómo se adapta la referencia Mapbox

El Markdown «Mapbox — Style Reference» aportado por el usuario interpreta el diseño de [Mapbox](https://www.mapbox.com/); sus mediciones no son un contrato de implementación. Se toma su disciplina de jerarquía, superficies y acciones para construir una identidad propia:

| Idea de la referencia | Regla de Obras Transparentes |
| --- | --- |
| Acento que hace reconocible la acción | Azul profundo en acciones; celeste en superficies de contexto. |
| Paneles con distintas profundidades | Fondo casi blanco, tarjetas blancas y secciones celestes suaves. |
| Cartografía como lenguaje visual | Mapa funcional y gráficos territoriales sobrios; referencias conceptuales identificadas. |
| Geometría consistente | Radios por función, bordes discretos y espaciado de base 4 px. |
| Titulares grandes | Mayor presencia en la landing; tamaños moderados en consulta y ficha. |

Se reemplazan la base oscura, la tipografía Cera Pro, las etiquetas de 10 px, las viñetas sobre el mapa y los efectos promocionales por reglas de lectura ciudadana. La inspiración visual no cambia OpenLayers Canvas 2D, OpenFreeMap, atribución ni privacidad.

## 2. Paleta y funciones

Usar nombres semánticos: un componente pide un color de acción, texto o borde, no «un azul parecido». Los colores de estado expresan mensajes de interfaz; no constituyen un catálogo de estados de obras.

| Token | Valor | Uso |
| --- | --- | --- |
| `--color-bg` | `#F4F9FC` | Fondo general. |
| `--color-surface` | `#FFFFFF` | Tarjetas, formularios y paneles de lectura. |
| `--color-surface-alt` | `#EAF4FA` | Secciones de contexto y hover secundario. |
| `--color-text` | `#172F45` | Títulos, cuerpo e iconos esenciales. |
| `--color-text-muted` | `#4E6478` | Fuentes, fechas y explicaciones secundarias legibles. |
| `--color-border` | `#C6D8E5` | Separadores y bordes decorativos. |
| `--color-border-control` | `#6B859B` | Contorno identificable de inputs y controles. |
| `--color-brand-celeste` | `#74B6E8` | Detalles de identidad; acompañar con texto oscuro. |
| `--color-primary` | `#17699D` | Acción principal y enlaces subrayados. |
| `--color-primary-hover` | `#10547F` | Hover/activación de la acción principal. |
| `--color-primary-soft` | `#DCEFFB` | Selección suave con texto azul profundo. |
| `--color-on-primary` | `#FFFFFF` | Texto sobre acción principal. |
| `--color-focus` | `#0A4C78` | Anillo de foco sobre superficies claras. |
| `--color-sun` | `#F2C14E` | Acento dorado pequeño de identidad. |
| `--color-on-sun` | `#6B4B09` | Texto sobre acento dorado. |
| `--color-success` / `--color-success-bg` | `#176B4A` / `#E7F4EC` | Confirmación de una acción de interfaz. |
| `--color-warning` / `--color-warning-bg` | `#795405` / `#FFF4CE` | Advertencia o limitación que requiere atención. |
| `--color-danger` / `--color-danger-bg` | `#A4262C` / `#FDECEE` | Error recuperable con explicación y acción. |

El celeste y el dorado son demasiado claros para texto blanco normal. El borde decorativo tampoco alcanza para identificar por sí solo un control. En esos casos usar los pares indicados y `--color-border-control`.

El fondo `--color-primary-soft` tampoco identifica por sí solo una selección frente al blanco: agregar borde azul y una etiqueta o indicador visible de selección.

### Pares de contraste

Ratios calculados con luminancia relativa sRGB, sin transparencias, redondeados a dos decimales. La revisión final debe medir el color realmente compuesto, también en hover, foco, selección y sobre la cartografía.

| Par | Colores | Contraste |
| --- | --- | --- |
| Texto / blanco | `#172F45` / `#FFFFFF` | 13,73:1 |
| Texto secundario / fondo | `#4E6478` / `#F4F9FC` | 5,79:1 |
| Texto secundario / superficie alternativa | `#4E6478` / `#EAF4FA` | 5,51:1 |
| Blanco / acción principal | `#FFFFFF` / `#17699D` | 5,93:1 |
| Blanco / hover principal | `#FFFFFF` / `#10547F` | 8,09:1 |
| Azul de acción / selección suave | `#17699D` / `#DCEFFB` | 5,02:1 |
| Texto / celeste | `#172F45` / `#74B6E8` | 6,28:1 |
| Texto dorado / acento sol | `#6B4B09` / `#F2C14E` | 4,75:1 |
| Borde de control / superficie alternativa | `#6B859B` / `#EAF4FA` | 3,45:1 |
| Foco / fondo | `#0A4C78` / `#F4F9FC` | 8,54:1 |
| Éxito / fondo de éxito | `#176B4A` / `#E7F4EC` | 5,73:1 |
| Advertencia / fondo de advertencia | `#795405` / `#FFF4CE` | 6,19:1 |
| Error / fondo de error | `#A4262C` / `#FDECEE` | 6,37:1 |

Para texto normal, exigir al menos 4,5:1; para texto grande, 3:1. Texto grande significa al menos 24 CSS px regular o aproximadamente 18,67 CSS px en negrita; un título de 18 px sigue necesitando 4,5:1. Ver [WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Para límites o señales visuales esenciales de controles, exigir 3:1 frente al color adyacente; ver [WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

## 3. Tipografía, números y contenido

Familia: **Noto Sans**, pesos reales 400 y 700, desde el mismo origen. `tools/prepare-map-assets.mjs` prepara los subconjuntos Latin/Latin-ext y su licencia para UI y mapa. El layout registra `/map-fonts/5.3.0/noto-sans.css` y precarga los WOFF2 Latin regular y bold; las reglas usan `font-display: swap`. Conservar el fallback `system-ui, -apple-system, "Segoe UI", Arial, sans-serif`. Escribir `font-family` por sí solo no descarga ni registra una nueva fuente; cualquier cambio requiere revisar carga, licencia y layout.

| Rol | Tamaño | Peso | Interlineado |
| --- | --- | --- | --- |
| Fuente, fecha, ayuda, atribución | `0.875rem` (14 px de referencia) | 400 | 1,5 |
| Cuerpo y controles | `1rem` (16 px) | 400; 700 en acción | 1,6 en cuerpo; 1,4 en control |
| Introducción breve | `1.125rem` (18 px) | 400 | 1,5 |
| Título de tarjeta | `1.25rem` (20 px) | 700 | 1,35 |
| Título de sección | `clamp(1.5rem, 3vw, 2rem)` | 700 | 1,25 |
| Título de consulta/ficha | `clamp(1.75rem, 4vw, 2.5rem)` | 700 | 1,2 |
| Título de landing | `clamp(2rem, 5vw, 3.5rem)` | 700 | 1,15 |

Los px son equivalencias con raíz de 16 px, no una razón para fijar el tamaño del navegador. Mantener texto esencial de al menos `0.875rem`, líneas de lectura de hasta 65–70 caracteres, párrafos cortos y alineación izquierda. Tracking de títulos entre 0 y `-0.02em`; las etiquetas breves pueden usar hasta `0.06em`. Evitar párrafos en mayúsculas y alturas fijas para texto.

- Español de Argentina y `lang="es-AR"`; verbos concretos: «Explorar obras», «Filtrar obras», «Ver ficha», «Buscar en esta zona».
- Enlaces dentro de texto subrayados. Un botón ejecuta una acción; un enlace navega. Iconos solos requieren nombre accesible.
- Importes y porcentajes con cifras tabulares cuando se comparan: `font-variant-numeric: tabular-nums`. Conservar el formato exacto de `src/lib/presentation.ts` y el contrato; no convertir decimales exactos a `Number` para mostrarlos.
- Mostrar «No informado» o la explicación específica del dato faltante. Cero es un valor, no un reemplazo de desconocido.
- Distinguir fuente, organismo responsable, publicación y fecha del dato. No deducir estado a partir del porcentaje de avance.
- Los textos de error explican qué pasó y cómo continuar; los estados vacíos describen la consulta y ofrecen quitar filtros o área cuando corresponda.

## 4. Espaciado, forma y composición

Base de 4 px expresada en rem: `0.25`, `0.5`, `0.75`, `1`, `1.5`, `2`, `3`, `4`. Los 44 px son el mínimo de objetivo táctil del proyecto, no un paso de la escala de espaciado.

| Elemento | Regla |
| --- | --- |
| Contenedor | Ancho máximo actual: 1224 px; márgenes de 16 px en móvil y 32–48 px al crecer. |
| Texto largo | Máximo 70ch, incluso dentro de un contenedor ancho. |
| Tarjeta/panel | Padding 16 px móvil, 24 px escritorio; la lista de consulta compacta usa 16 px y gap de 12 px. |
| Secciones de landing | Separación 48–64 px; en consulta agrupar con gaps de 16–24 px. |
| Input y botón | Radio 8 px; mínimo táctil 44 × 44 CSS px. |
| Aviso | Radio 8 px; sus acciones interactivas mantienen el mínimo de 44 × 44 CSS px. |
| Tarjeta | Radio 12 px; borde de 1 px. |
| Diálogo | Radio superior 16 px en móvil; superficie blanca y scroll propio. |
| Selector Lista/Mapa | Forma de cápsula; selección distinguible por relleno y texto/peso. |
| Etiqueta | Radio 4 px, texto desde 14 px; cápsula sólo si es un filtro accionable. |
| Elevación | Bordes/superficies para tarjetas; sombra discreta reservada al diálogo/overlay. |

Mobile-first: el explorador inicia con mapa y lista. Desde 1000 px, el mapa ocupa aproximadamente 60 % y los resultados 40 %; en móvil se apilan, con resultados visibles y un enlace ancla para llegar a ellos. La lista conserva su HTML inicial y navegación sin JavaScript. La vista Lista concentra la lectura textual; volver a Mapa conserva consulta, páginas cargadas, selección y cámara en memoria. Formularios y toolbars se envuelven; los controles pueden crecer con sus etiquetas. Ningún contenido esencial depende de hover, truncado o ancho fijo.

El header debe dejar espacio a nombres largos y al zoom. Si se vuelve sticky, comprobar que no tape foco, mensajes ni encabezados. En el panel conservar `dvh` con fallback, áreas seguras, orientación horizontal y controles Ampliar/Reducir. El scroll de la página debe seguir siendo usable junto al mapa.

La mesa territorial distingue cuatro áreas: cabecera compacta de consulta con filtros/vista, mapa con alcance y controles, resultados con datos/acciones, y franja de selección. Usar borde y superficies para relacionarlas; reservar el diálogo para una lectura solicitada. Evitar convertir cada explicación en un panel alto que desplace la tarea fuera de la primera pantalla.

## 5. Patrones por tarea

| Patrón | Apariencia y comportamiento esperados |
| --- | --- |
| Landing | Presentación breve, título legible y «Explorar obras» como acción principal. Ilustración territorial conceptual identificada, sin métricas o cobertura inventadas. |
| Botón principal | Fondo primary, texto on-primary, peso 700, radio 8 px, padding 12 × 20 px. Hover primary-hover; mantener foco además del hover. |
| Botón secundario | Blanco, texto primary, borde border-control; hover surface-alt. Acompaña sin competir con la acción principal. |
| Control de utilidad | Botón de 44 × 44 px como mínimo, icono sencillo y nombre accesible; tooltip sólo complementario. |
| Filtros | `details`/`summary` nativo «Filtrar obras» en la cabecera de consulta, labels visibles, selección legible y botón para aplicar. Conservar funcionamiento sin JavaScript y filtros admitidos por el contrato. |
| Lista/Mapa | Conservar botones y `aria-pressed`; relleno primary para el elegido, blanco para el otro. Cambiar presentación mantiene filtros, páginas cargadas y obra/revisión/ubicación seleccionada. Evitar roles de tabs si no se implementa su interacción completa. |
| Tarjeta de obra | Blanca, título/enlace destacado, localidad cuando consta, estado literal, fuente y ubicación aprobada/faltante distinguibles. Ordinal visual de la lista cargada; no es un ID oficial ni un número de marcador. «Ver en mapa» cuando hay geometría, «Ver resumen» y «Ver ficha» son acciones separadas; sin tarjeta clickeable con botones anidados. |
| Tarjeta seleccionada | Borde azul de 2 px, superficie primary-soft e indicador/«Obra seleccionada» visible. Título de consulta compacta de `1.125rem`; nombre completo, sin recortes. La selección mantiene relación con la franja del mapa y no depende sólo del color. |
| Contexto e indicadores | Encabezado «Ubicaciones de la consulta», área explícita o catálogo, cantidad de obras cargadas y explicación de lo que no puede dibujarse. Cantidades de la lectura actual, nunca totales o cobertura inferidos. |
| Selección cartográfica | Franja no modal antes del canvas con nombre, condición y etiqueta de calidad de ubicación. Elegir una geometría conserva su `obraId`, `revisionId` y `ubicacionId`; «Ver en mapa» puede encuadrar todas las ubicaciones aceptadas de una obra. «Ver resumen»/«Quitar selección» son acciones explícitas. |
| Selector de ubicación | Select nativo con label «Ubicación para consultar» cuando hay varias ubicaciones aceptadas. Permite elegir una o todas; cambiarlo conserva el foco del control, actualiza geometría/contexto y no aplica otro filtro de consulta. |
| Calidad de ubicación | Etiqueta breve visible antes del canvas y explicación completa debajo, en `details` «Cómo interpretar…». Si se consulta una única ubicación, abrirlo automáticamente; con varias, identificar cada explicación. Distinguir aprobación de geometría, precisión informada y supuesto de referencia geográfica. |
| Tooltip cartográfico | Superficie blanca opaca, borde primary de 2 px, texto desde `0.875rem` y ancho adaptable. Aparece en el flujo debajo del canvas para no cubrir ni interceptar geometrías. Muestra nombre/calidad al pasar sobre una geometría; permite mover el puntero al contenido y se descarta con Escape desde cualquier foco de la página. Complementa la selección y su detalle textual. |
| Etiqueta de estado | Texto literal del estado informado y estilo neutral por defecto. Cualquier color adicional necesita una correspondencia documentada; desconocido no significa error. |
| Aviso | Fondo suave, borde/color semántico, mensaje y acción concreta. Un icono y texto acompañan el color; no usar alertas urgentes para toda información. |
| Vacío | Mensaje contextual y acción pertinente. Nunca sustituir resultados vacíos por obras sintéticas ni dibujar marcadores para llenar el mapa. |
| Carga | Texto de estado y `aria-busy` donde corresponda, con región anunciada. Conservar el área para evitar saltos; indicar por qué un control no está disponible. |
| Ficha | Título, ubicación/precisión, estado, datos económicos y avance, fuentes y fechas en grupos claros. HTML semántico, enlaces a procedencia y acceso a revisión exacta. |
| Resumen modal | Diálogo nativo solicitado con «Ver resumen», título accesible, Cerrar visible, Escape y retorno de foco. Abrirlo desde la tarjeta de la misma obra/revisión conserva la ubicación seleccionada; cerrar mantiene selección y contexto. Ampliar/Reducir con botón; no exigir arrastrar. |
| Footer/atribución | Fuente y privacidad legibles, enlaces de 44 px cuando son controles. Atribución cartográfica visible fuera del panel y sin fundidos. |

### Mapa y selección

La cartografía base es contexto; las geometrías publicadas y los controles son la capa de consulta. Conservar estilo/proveedor de etapa 2: la paleta de marca se aplica a las capas propias, no reemplaza el estilo completo del proveedor.

- El encuadre es una presentación de la lectura, no un filtro implícito. Sin área explícita, encuadrar una vez las primeras geometrías reales; respetar una cámara ya movida. Con catálogo vacío, conservar cartografía y un encuadre orientativo identificado. La lectura amplia de GeoJSON y sus límites se documentan en etapa 2; ni el encuadre ni una descarga parcial declaran cobertura.
- Geometría de obra: identificar el nivel de la fuente pública con color y forma, sin deducirlo del territorio: Nación `#0077A8` celeste oscuro (círculo), CABA `#B42332` rojo (cuadrado), Provincia `#287A3A` verde (triángulo) y Municipio · Vicente López `#946800` oro oscuro (rombo). Se inspiran en el celeste nacional, la cruz roja de la bandera de CABA, la mitad verde bonaerense y el sol oro del escudo de la bandera municipal. Son adaptaciones para contraste, no códigos cromáticos oficiales. La página `/proyecto#colores` explica la elección y enlaza las fuentes oficiales.
- La leyenda aparece arriba de la consulta, tanto en mapa como en lista. Tarjetas, selección, tooltip y ficha repiten color, símbolo y «Datos de». «Fuente no informada» usa gris y «Fuentes de distintos niveles» usa gris azulado. La fuente publicada no acredita por sí sola quién ejecuta o financia la obra; la ficha destaca roles efectivamente informados y sus faltantes. El oro municipal corresponde a Vicente López, no a todos los municipios.
- Los colores sólidos de los marcadores y la leyenda tienen contraste de 4,95:1 a 10,35:1 frente a blanco. El relleno translúcido y el halo no certifican contraste sobre cada tesela.
- La atribución junto al mapa conserva OpenMapTiles y OpenStreetMap legibles, con sus enlaces. Se omite sólo el enlace opcional de OpenFreeMap en la atribución resuelta desde TileJSON; se conserva el proveedor y su crédito en `/proyecto#mapa`. Los créditos de otros proveedores y los callbacks por encuadre se preservan.
- «Ver en mapa» usa `obraId`/`revisionId` exactos y sólo geometría `ACCEPTED` de esa ficha. Seleccionar una geometría del mapa conserva también su `ubicacionId` en el enlace y destaca esa ubicación; el selector permite volver a todas las ubicaciones aceptadas. Ajustar cámara conserva la consulta. Informar geometría faltante o limitada; una ubicación no disponible en esa revisión no se sustituye por otro punto.
- Puntos: contorno blanco y núcleo de color/forma de fuente; líneas y polígonos repiten ese color con trazo discontinuo por categoría y relleno translúcido. La selección aumenta el punto y conserva su núcleo. En líneas y bordes de polígonos, se dibujan halo blanco de 12 px, contorno azul focus de 8 px y trazo interior de fuente de 4 px; el foco acompaña el color sin reemplazarlo.
- Medir visibilidad sobre calles, agua, parques y etiquetas del estilo real. El contraste de un token contra blanco no prueba contraste sobre todas las teselas.
- Grupos: número legible y descripción de **puntos agrupados**, no de obras ni ubicaciones únicas. Un MultiPoint puede aportar varios puntos al contador. Conservar todas las geometrías y presupuestos actuales.
- Controles sobre superficie opaca blanca, fuera de leyendas y atribución; evitar texto directamente sobre teselas.
- «Buscar en esta zona» es la acción que aplica un bbox. Abrir/cambiar vista, mover cámara, localizar una obra o usar geolocalización conserva el área consultada hasta confirmarla. Geolocalización sólo tras acción del usuario, con aviso y recuperación ante rechazo.
- Contar «obras cargadas» desde resultados y «obras representadas» desde IDs únicos del GeoJSON cargado; distinguir geometrías, puntos y obras sin ubicación. Los ordinales pertenecen sólo a la lista; los contadores de grupo pertenecen al mapa y expresan puntos.
- La vista inicial con mapa solicita cartografía externa al hidratar. Explicar ese comportamiento en privacidad y conservar un acceso con `vista=lista`; las fuentes de UI/mapa siguen en el mismo origen.
- Mantener cartografía con catálogo vacío, aviso ante proveedor caído, controles de teclado y selección desde lista. La UI no exige WebGL ni ubicación personal.

### Identidad y calidad de la ubicación seleccionada

La identidad exacta es el conjunto obra, revisión y ubicación; no implica que sus coordenadas tengan precisión conocida. Usar `ubicacionId` para conservar esa relación al alternar vistas, compartir el enlace o abrir el resumen de la misma tarjeta. No elegir una revisión actual ni otra ubicación como reemplazo silencioso de la solicitada.

Mantener una etiqueta de calidad visible junto al nombre, antes del mapa. Una geometría aceptada puede seguir siendo orientativa: por ejemplo, «Ubicación orientativa · precisión no informada» cuando la fuente carecía de referencia geográfica y WGS84 fue un supuesto aprobado en revisión. «Ubicación reportada del establecimiento» tampoco declara el alcance físico de la obra. Derivar texto y explicación de `locationPresentation`, compartido por tooltip y detalle, conservando la condición, la precisión y el fundamento de referencia del contrato.

Cuando `origenGeometria` sea `ADDRESS_GEOCODE`, usar «Domicilio geocodificado · ubicación orientativa». Explicar que la fuente no informó coordenadas y el servicio oficial Georef obtuvo el punto desde una dirección, con precisión no verificada. El punto no acredita el sitio exacto ni el alcance de la obra. EPSG:4326 describe la salida del servicio; no declara el sistema de coordenadas del dataset original. Conservar el valor de precisión del contrato sin presentar el punto como «coordenada reportada». El mismo texto aparece en la franja, la ayuda de selección, el tooltip y la ficha; teclado y toque acceden a la explicación persistente sin depender del hover. Se reutiliza el patrón de calidad existente, sin un radio de error ni un nuevo significado de color.

Ubicar la explicación completa en `details` debajo del canvas, junto a la tarea cartográfica: mostrar límites de precisión y referencia geográfica disponible. Abrirlo automáticamente para una única ubicación seleccionada y ofrecer la lectura individual cuando se eligen varias. El select conserva foco al cambiar de ubicación; el detalle no desplaza el foco por abrirse.

El tooltip permite leer su contenido al mover el puntero desde la geometría hacia su superficie y permanecer allí. Escape lo descarta aunque el foco esté en otro control; salir del área del mapa o navegar también lo cierra. Toda esa información debe seguir accesible por selección, selector y detalle para teclado y pantallas táctiles. La ayuda debajo del canvas no abre el resumen ni modifica filtros.

Aplicar estos criterios a futuras interfaces dinámicas: declarar alcance y selección, hacer visible el efecto de las acciones, y preservar la tarea mientras cambia la presentación. Una nueva capa de detalle o estado debe reforzar esa continuidad. La cantidad de tarjetas, sombras o etiquetas no reemplaza una relación comprensible entre componentes.

## 6. Accesibilidad verificable

Las asociaciones de obras reutilizan la sección de ficha, el `details` para evidencia y los controles nativos existentes. Mantener rótulos separados para territorio reportado, ubicación territorial verificada, gestión municipal y roles institucionales. La ausencia de evidencia publicada se expresa con texto; no se comunica sólo por color. Los filtros institucionales se agrupan en un `fieldset` con `legend`, nombres de organización obtenidos del catálogo y fechas etiquetadas como vigencia del rol. Los hashes y referencias largas deben refluir sin desplazar el ancho de lectura. Su semántica y verificación se registran en [asociaciones-obras.md](asociaciones-obras.md).

Objetivo: WCAG 2.2 AA y los requisitos táctiles del proyecto. Estos criterios guían el trabajo; no acreditan que toda la app ya los cumpla.

- Contraste de texto y señales esenciales según los pares anteriores. Nunca comunicar selección, error, estado o avance sólo con color.
- Orden de foco coherente, skip link visible al enfocarse, foco persistente y ningún control oculto debajo de paneles. Usar un anillo de 3 px con separación; sobre azul o mapa, agregar halo blanco para hacerlo distinguible.
- Controles de al menos 44 × 44 CSS px, también Cerrar, zoom y dirección. Es una regla del proyecto más amplia que el mínimo AA de 24 px con excepciones; ver [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- Verificar texto al 200 % y reflow a 320 CSS px (equivalente a 400 % en un viewport de 1280 px). Lista, ficha y controles deben permitir lectura sin scroll horizontal; el mapa puede necesitar disposición bidimensional, pero su alternativa textual debe refluir. Ver [WCAG 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
- Labels persistentes; placeholder sólo como ejemplo. Errores asociados al campo y mensajes de carga/cambio de resultados anunciados sin repetir cada movimiento del mapa.
- Verificar navegación por teclado, lector de pantalla y diálogo abierto: título, foco inicial, recorrido, Escape y retorno. «Ver en mapa» lleva foco/contexto a la región cartográfica; un enlace a resultados conserva consulta y orden de lectura. El selector de ubicación conserva foco al cambiar y el resumen de la misma tarjeta mantiene la ubicación elegida. Selección y cierre del resumen son acciones distintas. Mantener la consulta textual sin JavaScript.
- Verificar la ayuda de hover: contenido alcanzable con el puntero y descartable con Escape desde cualquier foco. Calidad visible y explicación textual disponible sin hover; `details` se abre automáticamente para una única ubicación sin mover foco.
- Respetar `prefers-reduced-motion`: quitar scroll suave y animaciones no esenciales. No animar cambios Lista/Mapa; cualquier transición cosmética debe ser breve, hasta 150 ms.
- En `forced-colors`, conservar límites, selección y foco con colores del sistema; evitar desactivar sus ajustes de forma global.
- Permitir espaciado personalizado y nombres/URLs largos sin recortes. El texto secundario contiene datos importantes y conserva contraste normal.

## 7. Base de tokens para implementar

Los tokens se centralizan en `src/app/globals.css`, importado por el layout raíz. Este bloque resume la base aplicada; el código del repositorio conserva los estilos completos. Mantener primitivas globales pequeñas y estilos de componentes acotados; no hace falta incorporar Tailwind ni una nueva librería de componentes.

```css
:root {
  color-scheme: light;
  --color-bg: #f4f9fc;
  --color-surface: #ffffff;
  --color-surface-alt: #eaf4fa;
  --color-text: #172f45;
  --color-text-muted: #4e6478;
  --color-border: #c6d8e5;
  --color-border-control: #6b859b;
  --color-brand-celeste: #74b6e8;
  --color-primary: #17699d;
  --color-primary-hover: #10547f;
  --color-primary-soft: #dceffb;
  --color-on-primary: #ffffff;
  --color-focus: #0a4c78;
  --color-sun: #f2c14e;
  --color-on-sun: #6b4b09;
  --color-success: #176b4a;
  --color-success-bg: #e7f4ec;
  --color-warning: #795405;
  --color-warning-bg: #fff4ce;
  --color-danger: #a4262c;
  --color-danger-bg: #fdecee;

  --font-ui: "Noto Sans", system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --radius-control: 0.5rem;
  --radius-card: 0.75rem;
  --radius-panel: 1rem;
  --radius-label: 0.25rem;
  --radius-pill: 999px;
  --control-min: 44px;
  --page-width: 1224px;
  --shadow-panel: 0 12px 36px rgb(23 47 69 / 16%);
}

/* Ejemplo de primitiva; combinar con los estilos del componente. */
.button-primary {
  min-inline-size: var(--control-min);
  min-block-size: var(--control-min);
  padding: var(--space-3) 1.25rem;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-control);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-weight: 700;
}
.button-primary:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}
:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 3px;
}
```

El ejemplo de foco sirve para fondos claros; completar halo y colores del sistema en los contextos indicados en accesibilidad. Un estado disabled no se consigue únicamente bajando opacidad: distinguir espera de indisponibilidad y explicar la causa cuando haga falta.

### Aplicación en el frontend

| Parte | Aplicación y mantenimiento |
| --- | --- |
| `src/app/globals.css` | Fuente única de tokens CSS y primitivas compartidas: tipografía, superficies, acciones, foco, avisos, tarjetas y ficha. |
| Roles de acento | Celeste para identidad, primary para acción, primary-soft para contexto y sun para detalle de marca. Conservar esa separación al agregar componentes. |
| `src/components/explorer.css` | Layout y variantes acotados a `.explorer`, sin redefinir primitivas de otras rutas. Selector flexible con texto ampliado y panel con áreas seguras. En colores forzados, sólo el botón seleccionado evita el backplate automático y conserva Highlight/HighlightText del sistema. |
| `src/app/page.tsx` | SVG conceptual basado en tokens, conservando su identificación y propósito. |
| `src/components/work-map.tsx` | Las capas Canvas muestran fuente por color y forma; la leyenda HTML y el tooltip aportan la categoría en texto. Halo blanco, selección más grande/gruesa y grupos con un único color cuando sus puntos coinciden en categoría. CSS no cambia los estilos de OpenLayers; mantener ambos alineados y verificar sobre el mapa real. |
| `src/app/layout.tsx` | Registro y precarga de fuentes del mismo origen, sin dependencia nueva; conservar fallback, licencia y semántica. |

Antes de cambiar código Next.js, leer las guías relevantes instaladas en `node_modules/next/dist/docs/`, en particular CSS y fuentes. Los archivos de contratos y tipos generados siguen su procedimiento; esta guía no autoriza modificar API, publicaciones ni datos.

## 8. Regla para próximas entregas

Antes de diseñar un componente, identificar la tarea, la información indispensable, el token y el patrón existente. Si falta un patrón, extender esta guía con su propósito, variantes y criterio de verificación. Una excepción debe tener motivo y alcance; no se propaga por copiar un hex local.

Para aplicar o extender la UI, verificar:

- [ ] Paleta semántica consistente entre landing, lista, ficha, panel e indicadores del mapa.
- [ ] Estados normal, hover, foco, seleccionado, carga, disabled, vacío y error cuando corresponden.
- [ ] Continuidad al alternar vistas y usar historial: filtros, páginas cargadas, selección/revisión, cámara y área confirmada. «Ver en mapa» y selección del mapa conservan consulta; sólo una acción explícita aplica área.
- [ ] Indicadores con alcance declarado, ordinales sólo de lista, ubicación desconocida distinguida y geometrías aprobadas de la revisión exacta; sin cantidades ni cobertura inferidas.
- [ ] Texto, pares de contraste, teclado, diálogo, zoom, reflow, movimiento reducido y colores forzados.
- [ ] Lectura y navegación textual sin JavaScript; geolocalización opcional y atribución visible.
- [ ] `npm run typecheck`, `npm test`, `npm run build` y `npm run contract:check`, según el cambio; regeneración sólo mediante `npm run contract:sync` si corresponde.
- [ ] `npm run test:e2e` con API/cartografía sintéticas aisladas para cambios de UI; capturas de móvil, escritorio y panel abierto. Revisar visualmente y documentar los límites en etapa 2.

La validación del recorrido integrado se registra en [etapa-2.md](etapa-2.md): typecheck/build/contrato, 120 unitarias, 5 pruebas del proxy y 88 E2E pasan; también se inspeccionaron móvil/escritorio y se repitió la guarda de alternancia/memoria. Los E2E cubren axe, teclado, fixtures y compatibilidad del mapa, y no sustituyen lector de pantalla ni toda la revisión manual. Una guía o un pase de axe por sí solos no certifican AA. Para cambios únicamente documentales, revisar enlaces, coherencia de tokens, cálculos de contraste y diff; no presentar las pruebas históricas como validación nueva.

### Totales públicos de fuentes municipales · 2026-10-07

El explorador muestra un panel HTML con tres tarjetas por fuente piloto y una lista de definiciones: publicaciones actuales, obras con ubicación aprobada y obras sin ubicación en el mapa. Reutiliza superficie blanca, fondo suave, bordes, tipografía y enlaces de 44 px. La grilla se apila según el espacio disponible y mantiene reflow sin tabla horizontal. Los números corresponden a un corte global al abrir la consulta, identificado explícitamente; no son facetas de filtros ni acreditan gestión municipal. Cero publicaciones, publicaciones sin ubicación y totales desconocidos tienen explicaciones distintas. Los enlaces cambian explícitamente a lista por fuente, descartando los filtros anteriores que podrían ocultar esas publicaciones. La verificación actual y sus límites se registran en etapa 2.
