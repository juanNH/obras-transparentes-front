/** @file Validación AJV de respuestas públicas contra los esquemas exportados de la API; conserva tuplas WGS84. */
import { Ajv } from "ajv";
import { fullFormats } from "ajv-formats/dist/formats.js";
import schemas from "../../contracts/schemas.json" with { type: "json" };

const ajv = new Ajv({ allErrors: true, strict: false, formats: fullFormats });
// Draft 7 derivado del mismo dominio que OpenAPI; conserva tuplas [lon,lat].
// No incorpora rutas, ejemplos ni contratos administrativos.
ajv.addSchema({
  $id: "obras-publicas",
  components: { schemas },
});

/** Respuesta pública incompatible con JSON o con el esquema esperado por el consumidor. */
export class ApiContractError extends Error {
  /** Identifica el error de contrato para distinguirlo de HTTP, red y cancelación. */
  constructor(message: string) {
    super(message);
    this.name = "ApiContractError";
  }
}

/**
 * Valida un valor desconocido contra un esquema público registrado antes de confiar en su tipo.
 * @param schema - Nombre de componente exportado en contracts/schemas.json.
 * @param value - JSON recibido de la API.
 * @returns Valor validado como el tipo solicitado.
 * @throws ApiContractError Si el esquema no existe o el payload lo incumple.
 */
export function parsePublicResponse<T>(schema: string, value: unknown): T {
  const validate = ajv.getSchema(
    `obras-publicas#/components/schemas/${schema}`,
  );
  if (!validate || !validate(value)) {
    throw new ApiContractError(`La respuesta no cumple el contrato ${schema}.`);
  }
  return value as T;
}
