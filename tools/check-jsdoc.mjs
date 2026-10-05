/** @file Comprueba JSDoc en módulos y declaraciones propias sin dependencias adicionales. */
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/** Opciones para comprobar este checkout u otro repositorio con el mismo criterio. */
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--root"))
  throw new Error("Uso: npm run docs:check -- [--root <repositorio>]");
/** Raíz del repositorio analizado; no se modifica su código ni el índice de Git. */
const root = args.length
  ? resolve(args[1])
  : resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** Extensiones de código propio que puede analizar el parser de TypeScript. */
const codeExtension = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
/** Artefactos regenerados desde contratos; su documentación deriva de la fuente. */
const generatedFiles = new Set([
  "src/api/generated.ts",
  "src/shared/api/openapi.generated.ts",
]);
/** Directorios de salida o dependencias que no forman parte del código mantenido. */
const excludedDirectory =
  /(?:^|\/)(?:node_modules|dist|build|coverage|\.next|artifacts)(?:\/|$)/;
/** Archivos o directorios que describen escenarios de pruebas mediante @file. */
const testFile =
  /(?:^|\/)(?:test|tests)(?:\/|$)|\.(?:test|spec)\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
/** Archivos propios registrados o nuevos, respetando las exclusiones de Git. */
const files = [
  ...new Set(
    execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      {
        cwd: root,
        encoding: "utf8",
      },
    )
      .split("\0")
      .filter(Boolean),
  ),
].filter(
  (path) =>
    codeExtension.test(path) &&
    !path.endsWith(".d.ts") &&
    !generatedFiles.has(path) &&
    !excludedDirectory.test(path),
);
/** Incumplimientos que se informan con archivo, línea y declaración. */
const failures = [];
/** Cantidad de declaraciones documentables revisadas en módulos de producción. */
let declarationCount = 0;

/**
 * Recupera los comentarios JSDoc de una declaración, incluidos los de su
 * sentencia de variables cuando TypeScript los asocia al contenedor.
 * @param node Declaración que exige documentación.
 * @returns Bloques JSDoc que describen la declaración.
 */
function documentationFor(node) {
  const nodes = [node];
  if (
    ts.isVariableDeclaration(node) &&
    ts.isVariableDeclarationList(node.parent)
  )
    nodes.push(node.parent.parent);
  return nodes.flatMap((candidate) => candidate.jsDoc ?? []);
}

/**
 * Comprueba que el bloque explique la declaración mediante texto descriptivo.
 * Las etiquetas por sí solas no reemplazan esa descripción.
 * @param docs Bloques asociados por el parser.
 * @returns Si alguno contiene una descripción no vacía.
 */
function hasDescription(docs) {
  return docs.some((doc) => {
    const comment =
      typeof doc.comment === "string"
        ? doc.comment
        : doc.comment?.map((part) => part.text ?? "").join("");
    return Boolean(comment?.trim());
  });
}

/**
 * Selecciona declaraciones nominales y constantes exportadas cuyo contrato
 * debe permanecer junto al código. Los callbacks anónimos quedan fuera.
 * @param node Nodo del árbol sintáctico.
 * @returns Si exige un bloque JSDoc de declaración.
 */
function requiresDocumentation(node) {
  if (
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  )
    return true;
  if (!ts.isVariableDeclaration(node)) return false;
  const initializer = node.initializer;
  const isNamedFunction =
    initializer &&
    (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer));
  const calledName =
    initializer && ts.isCallExpression(initializer)
      ? ts.isIdentifier(initializer.expression)
        ? initializer.expression.text
        : ts.isPropertyAccessExpression(initializer.expression)
          ? initializer.expression.name.text
          : undefined
      : undefined;
  const isWrappedFunction =
    calledName && ["useCallback", "memo", "forwardRef"].includes(calledName);
  const statement = ts.isVariableDeclarationList(node.parent)
    ? node.parent.parent
    : undefined;
  const isExported =
    statement &&
    ts.isVariableStatement(statement) &&
    statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
  return Boolean(isNamedFunction || isWrappedFunction || isExported);
}

/**
 * Informa el nombre o categoría de una declaración, sin ejecutar el código.
 * @param node Nodo inspeccionado.
 * @param source Módulo al que pertenece.
 * @returns Etiqueta legible para el diagnóstico.
 */
function declarationName(node, source) {
  return (
    node.name?.getText(source) ??
    (ts.isConstructorDeclaration(node)
      ? "constructor"
      : ts.SyntaxKind[node.kind])
  );
}

for (const path of files) {
  const text = await readFile(resolve(root, path), "utf8");
  const kind = /\.(?:tsx|jsx)$/.test(path)
    ? ts.ScriptKind.TSX
    : /\.(?:js|mjs|cjs)$/.test(path)
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    kind,
  );
  const firstStart = source.statements[0]?.getStart(source) ?? text.length;
  const leading = text.slice(0, firstStart);
  if (!/\/\*\*[\s\S]*?@file(?:overview)?\s+[^\s*][\s\S]*?\*\//.test(leading))
    failures.push(path + ":1: falta JSDoc @file con el propósito del módulo");
  if (testFile.test(path)) continue;

  /**
   * Recorre declaraciones del módulo y conserva líneas para corregir faltantes.
   * @param node Nodo actual, sin evaluar inicializadores ni llamar funciones.
   */
  function visit(node) {
    if (requiresDocumentation(node)) {
      declarationCount++;
      if (!hasDescription(documentationFor(node))) {
        const line =
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        failures.push(
          path +
            ":" +
            line +
            ": falta JSDoc descriptivo en " +
            declarationName(node, source),
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
if (failures.length) {
  process.stderr.write(failures.join("\n") + "\n");
  process.stderr.write(
    "JSDoc: " +
      failures.length +
      " faltantes en " +
      files.length +
      " módulos.\n",
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    "JSDoc: " +
      files.length +
      " módulos y " +
      declarationCount +
      " declaraciones documentadas.\n",
  );
}
