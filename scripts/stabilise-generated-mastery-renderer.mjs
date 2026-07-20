import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const runtimePath = resolve(process.cwd(), "src/generated/mastery-runtime.js");
let source = await readFile(runtimePath, "utf8");

function replaceOnce(search, replacement, label) {
  const first = source.indexOf(search);
  const last = source.lastIndexOf(search);
  if (first < 0) throw new Error(`Could not stabilise Mastery renderer: ${label} was not found.`);
  if (first !== last) throw new Error(`Could not stabilise Mastery renderer: ${label} was not unique.`);
  source = `${source.slice(0, first)}${replacement}${source.slice(first + search.length)}`;
}

replaceOnce(
  "function featureNearView(feature) { if (zoom < 24) return true; const centre = [-rotation[0], -rotation[1]]; const latitudePadding = Math.max(.08, 220 / zoom);",
  "function featureNearView(feature) { if (zoom < 4) return true; const centre = [-rotation[0], -rotation[1]]; const latitudePadding = Math.max(.08, 150 / zoom);",
  "country culling threshold"
);

replaceOnce(
  "if (zoom < 24) drawFeature(worldCollection,land,\"rgba(31,45,55,.55)\",.7); else for (const feature of basePolygonFeatures) if (featureNearView(feature)) drawFeature(feature,land,\"rgba(31,45,55,.55)\",Math.max(.22,.7/Math.sqrt(zoom/24))); for (const feature of precisionPolygonFeatures) if (featureNearView(feature)) drawFeature(feature,land,\"rgba(31,45,55,.55)\",zoom < 24 ? .7 : Math.max(.22,.7/Math.sqrt(zoom/24)));",
  "if (zoom < 4) drawFeature(worldCollection,land,\"rgba(31,45,55,.55)\",.7); else for (const feature of basePolygonFeatures) if (featureNearView(feature)) drawFeature(feature,land,\"rgba(31,45,55,.55)\",Math.max(.18,.7/Math.sqrt(Math.max(1,zoom/4)))); for (const feature of precisionPolygonFeatures) if (featureNearView(feature)) drawFeature(feature,land,\"rgba(31,45,55,.55)\",zoom < 4 ? .7 : Math.max(.18,.7/Math.sqrt(Math.max(1,zoom/4))));",
  "country-by-country land rendering"
);

await writeFile(runtimePath, source, "utf8");
console.log("Stabilised Mastery deep-zoom rendering.");
