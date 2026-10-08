/** @file Exportación pública y generación de tipos con compilación temporal sólo en frontend, sin iniciar API ni acceder a su base. */
import { execFileSync } from "node:child_process";
import { copyFile, mkdtemp, readFile, writeFile, mkdir, realpath, rm, symlink, unlink } from "node:fs/promises";
import { resolve, join, dirname, basename, relative, isAbsolute } from "node:path";
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
const temporaryPrefix = "public-contract-";
const repositoryPath = await realpath(root);

/** Comprueba el destino físico antes de crear o borrar artefactos para no salir del frontend mediante enlaces. */
async function frontendPath(path) {
  const physical = await realpath(path);
  const child = relative(repositoryPath, physical);
  if (!child || child === ".." || child.startsWith("..\\") || child.startsWith("../") || isAbsolute(child))
    throw new Error("El destino temporal debe permanecer dentro del frontend.");
  return physical;
}

/** Crea un solo nivel cuyo padre ya se comprobó; un directorio existente también se valida físicamente. */
async function temporaryDirectory(path) {
  await mkdir(path).catch(error => { if (error.code !== "EEXIST") throw error; });
  return frontendPath(path);
}

const artifacts = await temporaryDirectory(join(root, "artifacts"));
const temporaryRoot = await temporaryDirectory(join(artifacts, "local-validation"));
const temporary = await mkdtemp(join(temporaryRoot, temporaryPrefix));
const dependencyLink = join(temporary, "node_modules");
try {
  // Conserva la configuración y dependencias del backend sólo como entradas.
  // Toda emisión, incluidos mapas/declaraciones, queda en el frontend; desactivar
  // incremental evita crear o modificar tsbuildinfo en el checkout de la API.
  execFileSync(
    process.execPath,
    [
      join(backend, "node_modules/typescript/bin/tsc"),
      "-p",
      join(backend, "tsconfig.build.json"),
      "--outDir",
      join(temporary, "dist"),
      "--incremental",
      "false",
    ],
    { cwd: backend, stdio: "pipe", encoding: "utf8" },
  );
  const openapiPath = join(temporary, "openapi.json");
  const examplesPath = join(temporary, "examples.json");
  const schemasPath = join(temporary, "schemas.json");
  const scripts = join(temporary, "scripts");
  await mkdir(scripts);
  const exporter = join(scripts, "export-public-openapi.mjs");
  await copyFile(join(backend, "scripts/export-public-openapi.mjs"), exporter);
  // El exporter conserva imports ../dist idénticos a su repositorio fuente.
  // El enlace permite resolver sus dependencias sin instalarlas/copiar su árbol.
  await writeFile(join(temporary, "package.json"), '{"type":"module"}\n');
  await symlink(join(backend, "node_modules"), dependencyLink, process.platform === "win32" ? "junction" : "dir");
  execFileSync(
    process.execPath,
    [
      exporter,
      openapiPath,
      examplesPath,
      schemasPath,
    ],
    { cwd: temporary, stdio: "pipe", encoding: "utf8" },
  );
  const document = JSON.parse(await readFile(openapiPath, "utf8"));
  const publicPaths = new Set(["/api/v1/obras", "/api/v1/obras/geojson", "/api/v1/obras/conteos", "/api/v1/obras/cobertura-municipal", "/api/v1/obras/cobertura-fuentes", "/api/v1/obras/{id}", "/api/v1/territorios/provincias", "/api/v1/territorios/pba/partidos", "/api/v1/territorios/pba/partidos/limites", "/api/v1/organizaciones-institucionales"]);
  if (
    Object.keys(document.paths).some(
      (path) => !publicPaths.has(path),
    )
  ) {
    throw new Error(
      "La exportación debe contener exclusivamente rutas públicas de obras, provincias, partidos y organizaciones institucionales admitidas.",
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
  // Se comprueba el directorio creado por mkdtemp y se desvincula node_modules
  // antes de borrar. Si unlink falla, se conserva el temporal: no se recorre el
  // enlace ni se arriesga el árbol de dependencias del backend.
  const physical = await frontendPath(temporary);
  if (dirname(physical) !== temporaryRoot || !basename(physical).startsWith(temporaryPrefix))
    throw new Error("No se puede eliminar un temporal fuera de su directorio/prefijo esperado.");
  await unlink(dependencyLink).catch(error => { if (error.code !== "ENOENT") throw error; });
  await rm(temporary, { recursive: true, force: true });
}
