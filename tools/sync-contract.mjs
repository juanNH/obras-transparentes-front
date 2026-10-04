import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";
import openapiTS, { astToString } from "openapi-typescript";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const backendFlag = args.indexOf("--backend");
if (
  args.some(
    (arg, index) =>
      arg !== "--check" &&
      arg !== "--backend" &&
      !(backendFlag >= 0 && index === backendFlag + 1),
  )
) {
  throw new Error(
    "Uso: npm run contract:sync -- [--check] [--backend <ruta-api>]",
  );
}
if (
  backendFlag >= 0 &&
  (!args[backendFlag + 1] || args[backendFlag + 1].startsWith("--"))
)
  throw new Error("--backend requiere una ruta.");
const backend = resolve(
  root,
  backendFlag >= 0 ? args[backendFlag + 1] : "../obras-transparentes",
);
const temporary = await mkdtemp(join(tmpdir(), "obras-public-contract-"));
try {
  // Compila fuentes, no inicia la API ni carga configuración/credenciales de entorno.
  execFileSync(
    process.execPath,
    [
      join(backend, "node_modules/typescript/bin/tsc"),
      "-p",
      "tsconfig.build.json",
    ],
    { cwd: backend, stdio: "pipe", encoding: "utf8" },
  );
  const openapiPath = join(temporary, "openapi.json");
  const examplesPath = join(temporary, "examples.json");
  const schemasPath = join(temporary, "schemas.json");
  execFileSync(
    process.execPath,
    [
      join(backend, "scripts/export-public-openapi.mjs"),
      openapiPath,
      examplesPath,
      schemasPath,
    ],
    { cwd: backend, stdio: "pipe", encoding: "utf8" },
  );
  const document = JSON.parse(await readFile(openapiPath, "utf8"));
  if (
    Object.keys(document.paths).some(
      (path) => !path.startsWith("/api/v1/obras"),
    )
  ) {
    throw new Error(
      "La exportación debe contener exclusivamente contratos públicos de obras.",
    );
  }
  const examples = JSON.parse(await readFile(examplesPath, "utf8"));
  const schemas = JSON.parse(await readFile(schemasPath, "utf8"));
  const generated = astToString(
    await openapiTS(document, { alphabetize: true }),
  );
  const files = new Map([
    ["contracts/openapi.json", JSON.stringify(document, null, 2) + "\n"],
    ["contracts/schemas.json", JSON.stringify(schemas, null, 2) + "\n"],
    ["contracts/examples.json", JSON.stringify(examples, null, 2) + "\n"],
    [
      "src/api/generated.ts",
      "// Generado desde contracts/openapi.json. Ejecutar npm run contract:sync.\n" +
        generated,
    ],
  ]);
  const differences = [];
  for (const [relative, content] of files) {
    const path = join(root, relative);
    if (args.includes("--check")) {
      const current = await readFile(path, "utf8").catch(() => null);
      // Git may check out CRLF on Windows; line endings do not change this contract.
      // Compare normalized text while retaining all semantic and formatting checks.
      if (current?.replaceAll("\r\n", "\n") !== content.replaceAll("\r\n", "\n"))
        differences.push(relative);
    } else {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content);
    }
  }
  if (differences.length) {
    console.error("Contrato desactualizado: " + differences.join(", "));
    process.exitCode = 1;
  } else
    console.log(
      args.includes("--check")
        ? "Contrato y tipos sincronizados."
        : "Contrato público, ejemplos y tipos generados sin acceder a la base de datos.",
    );
} finally {
  // Se elimina únicamente el directorio temporal creado en esta ejecución.
  await rm(temporary, { recursive: true, force: true });
}
