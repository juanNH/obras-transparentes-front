import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const library = new URL("../node_modules/maplibre-gl/", import.meta.url);
const destination = new URL("../public/maplibre/", import.meta.url);
await mkdir(destination, { recursive: true });
// MapLibre 6 publishes an ESM worker that imports the shared module by relative URL.
// Do not copy sourcemaps or development builds into the public site.
for (const name of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await copyFile(new URL(`dist/${name}`, library), new URL(name, destination));
}
await copyFile(new URL("LICENSE.txt", library), new URL("LICENSE.txt", destination));
console.log(`MapLibre worker assets prepared in ${fileURLToPath(destination)}`);
