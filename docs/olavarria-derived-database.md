# Oferta pública de la base derivada de Olavarría

Implementación autorizada el 16 de octubre de 2026. La decisión ODbL, su
registro y las publicaciones de negocio siguen pendientes. Esta entrega prepara
la oferta para una confirmación posterior con el contenido listo.

## Contrato e integración

`npm run contract:sync` exporta el contrato del backend sin conectar la base de
datos. El sincronizador admite de manera explícita la única ruta nueva
`GET /api/v1/bases-derivadas/olavarria-obras`. Los artefactos de `contracts/` y
`src/api/generated.ts` se generan oficialmente; no se editan a mano.

El cliente consume `OlavarriaDerivedDatabase`, valida JSON Schema y comprueba
cantidades, identidades únicas, publicaciones vigentes y el estado pendiente
vacío. El servidor limita esta respuesta completa a 10 MiB/8 segundos; no se
amplían los presupuestos de obras, registros, conteos u otros catálogos.

El BFF admite únicamente `/api/public/bases-derivadas/olavarria-obras` sin query.
Lee anónimamente, sin cookies ni autorización administrativa, conserva la
cancelación, valida el resultado y entrega JSON real como archivo adjunto,
`olavarria-base-derivada.json`, con `Cache-Control: no-store`. No acepta contratos,
registra decisiones ni redirige hacia originales privados. La serialización del
BFF conserva el contenido validado; no copia el ETag HTTP de otros bytes.

## Presentación

`/bases/olavarria-obras` entrega HTML SSR sin caché. Muestra PENDING_POLICY
explícito cuando corresponde y distingue el estado desconocido por una falla de
lectura de un estado pendiente confirmado. Un fallo no se presenta como cero.
ACTIVE puede estar vacío antes de publicar; la interfaz no anticipa la decisión.

Los conteos de revisiones de obras y registros informados se muestran separados,
con sus dos versiones de catálogo, sin sumarlos ni llamarlos obras nuevas. La
descarga vuelve a consultar el estado vigente y puede reflejar un corte posterior
al HTML. La página conserva el aviso literal, original exacto y SHA-256, tamaño,
transformaciones, huella de las colecciones y atribuciones públicas registradas.
El enlace oficial vivo puede cambiar de contenido: no se presenta como una copia
inmutable del original capturado. La descarga contiene las proyecciones públicas
y no los bytes originales privados.

La cobertura Olavarría y el componente compartido `WorkSourceLicenses` enlazan
la oferta. Se reutilizan tokens y patrones `detail-page`, `detail-grid`, avisos,
botones y enlaces con foco existentes, sin colores o tipografías nuevos. Los
textos literales y hashes tienen envoltura de línea; las obras sin ubicación
aprobada conservan su ficha y el aviso de que no aparecen en el mapa. Los enlaces
de originales y licencias se limitan a HTTP(S) seguro sin credenciales.

## Comprobación y límites

Se ejecutan sincronización oficial, documentación, tipos y compilación, sin
agregar ni correr tests por instrucción del usuario. Los manifiestos y hashes
de `artifacts/local-validation/expansion-states-20261016-v1/manifest.v5.json`
documentan el build congelado preparado; no acreditan activación o permiso.
El build previo source-v4 y sus manifiestos se conservan. El nuevo launcher
requiere el SHA exacto de manifest.v5 y valida antes de cualquier inicio.

La revisión nativa del HTML/BFF, accesibilidad visual y lectura real PENDING
quedan pendientes de la ventana segura de activación que coordina el frente
principal. La compilación no demuestra el caso futuro con publicaciones ODbL
ni sustituye esa aceptación. No se inicia ni reinicia el servicio en esta entrega.
