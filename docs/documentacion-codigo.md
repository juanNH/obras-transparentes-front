# Documentación del código

## Convención JSDoc

Cada módulo propio mantenido (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs` o `.cjs`) empieza con un bloque JSDoc `@file` que describe su propósito y límites. Las funciones, clases, métodos, constructores, interfaces, alias de tipos, enumeraciones, funciones asignadas a variables y constantes exportadas tienen una descripción JSDoc antes de su declaración.

Los comentarios explican la intención, el contrato y las decisiones que no se deducen de la firma. Usá español y mantené los nombres de APIs tal como aparecen en el código. Agregá `@param`, `@returns`, `@throws` y `@example` cuando aclaren unidades, nulos, efectos, errores, precondiciones o un caso de uso. TypeScript sigue siendo la fuente de los tipos; no los dupliques en etiquetas JSDoc.

Documentá la diferencia entre datos desconocidos y cero, fuente y responsable, fecha de publicación y actualización de origen, y ubicación aprobada y candidata cuando afecte el contrato. Explicá las escrituras, red, almacenamiento, permisos, CSRF y revisión esperada donde ocurren.

En archivos de pruebas, el bloque `@file` explica el comportamiento comprobado y si se usan datos sintéticos o una infraestructura aislada. Los callbacks anónimos y las assertions no necesitan comentarios individuales. Los helpers de pruebas pueden añadir contratos cuando resulten útiles.

No edites dependencias, artefactos generados ni declaraciones ambientales para satisfacer esta convención. Los contratos y tipos generados se regeneran desde su fuente.

## Comprobación

`npm run docs:check` analiza el código con el parser de TypeScript ya instalado y comprueba la presencia de JSDoc en los módulos y declaraciones propias. Incluye archivos nuevos que Git no ignore. La comprobación forma parte del build; una declaración nueva sin documentación falla con archivo y línea.

La comprobación automática verifica presencia y una descripción; la revisión humana evalúa si explica correctamente el comportamiento. Corregí los comentarios junto con cada cambio de código y revisá que los ejemplos continúen siendo válidos. La plantilla de pull request incluye esta comprobación.

## Ejemplo

El ejemplo usa `PublicWorkDetail` del contrato público del backend. Los clientes consumen su tipo generado equivalente.

```ts
/** @file Clasifica revisiones públicas según sus ubicaciones aprobadas. */

/**
 * Indica si la revisión pública tiene una ubicación que puede dibujarse.
 * Las ubicaciones candidatas, rechazadas u omitidas conservan su estado
 * y no se consideran representación pública en el mapa.
 * @param revision Revisión publicada que se está mostrando.
 * @returns Si al menos una ubicación tiene aprobación para el mapa.
 */
export function tieneUbicacionEnMapa(revision: PublicWorkDetail): boolean {
  return revision.ubicaciones.some(
    (ubicacion) =>
      ubicacion.condicion === "ACCEPTED" && ubicacion.geometria !== null,
  );
}
```

## Swagger y contratos HTTP

Toda operación documentada declara su propósito, parámetros, cuerpo, respuestas reales, errores, seguridad y precondiciones. Los ejemplos son sintéticos. Mostrá nulos, paginación, versiones esperadas y límites cuando correspondan. Los endpoints administrativos explican permisos, alcance de organización, sesión, Origin y CSRF.

Los consumidores generan sus contratos desde la documentación del backend. Al cambiar una ruta o esquema, regenerá los artefactos afectados y comprobá su sincronización antes de integrar el cambio. Una descripción sin un esquema de respuesta no completa un contrato con cuerpo.
