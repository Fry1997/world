import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const sourcePath = resolve(root, "src/atlas-globe.js");
const outputPath = resolve(root, "src/generated/atlas-globe.js");
let source = await readFile(sourcePath, "utf8");

function replaceOnce(search, replacement, label) {
  const first = source.indexOf(search);
  const last = source.lastIndexOf(search);
  if (first < 0) throw new Error(`Could not prepare stable Atlas globe: ${label} was not found.`);
  if (first !== last) throw new Error(`Could not prepare stable Atlas globe: ${label} was not unique.`);
  source = `${source.slice(0, first)}${replacement}${source.slice(first + search.length)}`;
}

replaceOnce(
  `  function featureNearView(feature) {
    if (zoom < 24) return true;
    const centre = [-rotation[0], -rotation[1]];
    const latitudePadding = Math.max(.08, 220 / zoom);`,
  `  function featureNearView(feature) {
    if (zoom < 4) return true;
    const centre = [-rotation[0], -rotation[1]];
    const latitudePadding = Math.max(.08, 150 / zoom);`,
  "deep-zoom feature culling"
);

replaceOnce(
  `    if (zoom < 24) {
      drawPath(model.worldCollection, land, 'rgba(28,43,54,.62)', zoom > 7 ? .45 : .72);
    } else {
      for (const feature of model.polygons) {
        if (featureNearView(feature)) drawPath(feature, land, 'rgba(28,43,54,.62)', Math.max(.22, .7 / Math.sqrt(zoom / 24)));
      }
    }`,
  `    if (zoom < 4) {
      drawPath(model.worldCollection, land, 'rgba(28,43,54,.62)', .72);
    } else {
      for (const feature of model.polygons) {
        if (featureNearView(feature)) drawPath(feature, land, 'rgba(28,43,54,.62)', Math.max(.18, .7 / Math.sqrt(Math.max(1, zoom / 4))));
      }
    }`,
  "stable country-by-country land rendering"
);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `// Generated from src/atlas-globe.js by scripts/generate-stable-atlas-globe.mjs.\n${source}`, "utf8");
console.log("Generated stable Atlas deep-zoom renderer.");
