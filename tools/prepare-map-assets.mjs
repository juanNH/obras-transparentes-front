/** @file Preparación de subconjuntos Noto Sans fijados y su licencia para servirlos desde el mismo origen. */
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const version = "5.3.0";
const library = new URL("../node_modules/@fontsource/noto-sans/", import.meta.url);
const installed = JSON.parse(await readFile(new URL("package.json", library), "utf8"));
if (installed.version !== version) {
  throw new Error(`Map font version must be ${version}; update its public URL when upgrading.`);
}

const destination = new URL(`../public/map-fonts/${version}/`, import.meta.url);
const blocks = [];
const fonts = new Set();
for (const name of ["400.css", "400-italic.css", "700.css"]) {
  const css = await readFile(new URL(name, library), "utf8");
  // Keep unicode ranges from the complete stylesheet so browsers request only
  // needed subsets. Subset-only CSS omits them and must not be merged directly.
  const selected = [...css.matchAll(/\/\* noto-sans-(?:latin-ext|latin)-\d+-(?:normal|italic) \*\/\s*@font-face\s*\{[^}]*\}/g)];
  if (selected.length !== 2) throw new Error(`Expected Latin and Latin-ext font faces in ${name}.`);
  for (const [block] of selected) {
    if (!block.includes("unicode-range:")) throw new Error(`Font subset has no unicode range in ${name}.`);
    for (const [, font] of block.matchAll(/url\(\.\/files\/([^\s)]+)\)/g)) {
      if (!/^noto-sans-latin(?:-ext)?-(?:400|700)-(?:normal|italic)\.woff2?$/.test(font)) {
        throw new Error(`Unexpected map font asset in ${name}.`);
      }
      fonts.add(font);
    }
    blocks.push(block);
  }
}
if (fonts.size !== 12) throw new Error("Expected six font faces in WOFF2 and WOFF formats.");

await mkdir(new URL("files/", destination), { recursive: true });
for (const font of fonts) {
  await copyFile(new URL(`files/${font}`, library), new URL(`files/${font}`, destination));
}
await writeFile(new URL("noto-sans.css", destination), blocks.join("\n\n") + "\n");
await copyFile(new URL("LICENSE", library), new URL("LICENSE", destination));
const assets = ["noto-sans.css", "LICENSE", ...[...fonts].map(font => `files/${font}`)];
const bytes = (await Promise.all(assets.map(async name => (await stat(new URL(name, destination))).size))).reduce((sum, size) => sum + size, 0);
console.log(`Map fonts prepared in ${fileURLToPath(destination)} (${assets.length} files, ${bytes} bytes).`);
