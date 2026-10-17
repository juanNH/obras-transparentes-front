# Padrón institucional: filas de oferta educativa

Integración autorizada el 16 de octubre de 2026. Consume el contrato público
oficial del backend conjunto: SHA-256
`237299fc5ad1144b7c30a9db2dfe0f5797cc670c55cff70cd2760850fc2687b5`.
La licencia exacta, las publicaciones y la activación se deciden en sus flujos
administrativos autorizados; esta entrega no los ejecuta.

## Unidad y navegación

`registro-informado@4`, política `publicacion-instituciones@1`, tipo
`EDUCATIONAL_ESTABLISHMENT_RECORD`, representa **una fila de oferta institucional
educativa** en un período. Varias filas pueden compartir el código reportado de
establecimiento. No acredita obra, edificio intervenido, institución nueva o
identidad jurídica verificada. La etiqueta del registro es generada y se muestra
como tal. La denominación literal de fuente conserva su campo propio.

El padrón se enlaza desde `/registros` mediante
`/registros?fuente=pba-establecimientos&tipo=EDUCATIONAL_ESTABLISHMENT_RECORD`.
La fuente y el tipo están disponibles en esos filtros con nombres descriptivos.
No se agregan a `SOURCES`, `SOURCE_COVERAGE_CODES`, el selector del mapa o las
fuentes admisibles de WorkSnapshot. La navegación y los filtros territoriales
mantienen sus nombres/códigos oficiales; no deducen una localidad o un punto.

Lista y ficha explican el identificador informado, la oferta, la etiqueta
generada y la ausencia de vínculo/geometría. `NOT_ASSERTED` se presenta como
«No se afirma una vinculación con una obra», sin fabricar un enlace. La ficha
conserva namespace, código y ordinal CSV del original, fechas de captura y
publicación separadas, advertencias, licencia, cita y descargas actuales. Los
retiros siguen retirando el contenido y bloqueando sus descargas.

## Diez campos y tratamiento explícito

La whitelist es establecimiento_id, establecimiento_nombre, cueanexo, modalidad,
nivel, sector, tipo_organizacion, periodo, municipio_id y municipio_nombre.
No se exportan domicilio, contactos, coordenadas, demografía, matrícula, notas
administrativas, rawCells o bytes originales privados.

El cliente valida Ajv y las relaciones entre campos, columnas, recurso y oferta.
No admite campos repetidos, una identidad distinta del código permitido, un
vínculo afirmado ni geometría publicada. REPORTED requiere texto no vacío;
NOT_REPORTED requiere null; WITHHELD requiere null y un motivo explícito. La ficha
y tarjeta muestran las limitaciones sin buscar hallazgos de versiones anteriores
que este snapshot no tiene. La proyección JSON conserva los diez campos y sus
estados/motivos. La descarga valida el DTO completo antes de exportarlo; un
payload con propiedades privadas o inesperadas falla en vez de copiarlas.

El CSV conserva estado por campo y agrega los motivos de limitación, política,
identidad institucional reportada, oferta, etiqueta generada, localizador,
atribuciones y avisos. El tratamiento de fórmulas para planillas permanece
activo; JSON conserva los textos públicos literales. La cita identifica la fila
de oferta, el namespace/código reportado, el registro CSV y la versión publicada,
sin atribuir a la fuente la etiqueta generada ni una fecha de obra.

## Conteos del mismo corte

El objeto opcional `instituciones` contiene `filasOfertaPublicadas` e
`establecimientosDistintosInformados`. Se comprueba su relación con porTipo y
con el total filtrado; se permiten cantidades explícitas cero. La interfaz sólo
muestra este desglose cuando los conteos y la lista tienen el mismo catálogo y
filtros. Un error, corte distinto o ausencia del objeto se muestra como cantidad
no disponible: no se inventa cero. Los dos conteos institucionales se presentan
separados entre sí y de las obras. Las filas ya están incluidas en registros;
no se suman de nuevo. Los 21593/19853 del original histórico no se usan como
cantidades publicadas actuales.

## Comprobación y entrega

Sincronización oficial, docs y tipos pasan. La compilación de producción se
prepara en `source-v6` con manifiesto v6 y launcher separado; las versiones
anteriores se conservan. No se agregan ni ejecutan tests ni se inicia runtime.
El manifiesto registra el build y sus archivos exactos; no acredita permiso,
publicación efectiva, aceptación editorial o lectura nativa. Esas comprobaciones
se coordinan con el frente principal en una ventana segura posterior.
