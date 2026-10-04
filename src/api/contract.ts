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

export class ApiContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiContractError";
  }
}

export function parsePublicResponse<T>(schema: string, value: unknown): T {
  const validate = ajv.getSchema(
    `obras-publicas#/components/schemas/${schema}`,
  );
  if (!validate || !validate(value)) {
    throw new ApiContractError(`La respuesta no cumple el contrato ${schema}.`);
  }
  return value as T;
}
