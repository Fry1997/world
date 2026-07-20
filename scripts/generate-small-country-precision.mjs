import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { feature as topoFeature } from "topojson-client";

const root = process.cwd();
const outputPath = resolve(root, "src/generated/small-country-precision.geojson");
const areaThreshold = 35_000;
const criticalCodes = new Set(["VAT", "MCO", "SMR", "LIE", "AND", "LUX", "MNE"]);
const runtimeFiles = [
  "chunks/runtime-01.js",
  "chunks/runtime-02.js",
  "chunks/runtime-03.js",
  "chunks/runtime-04.js",
  "chunks/runtime-05.js",
  "chunks/runtime-06.js",
  "chunks/runtime-tail-01.js",
  "chunks/runtime-tail-02.js",
  "chunks/runtime-tail-03.js",
  "chunks/runtime-tail-04.js",
  "chunks/runtime-tail-05.js",
  "chunks/runtime-tail-06.js",
  "chunks/runtime-tail-07.js",
  "chunks/runtime-tail-08.js",
  "chunks/runtime-tail-09.js"
];

const context = { window: {} };
for (const file of runtimeFiles) {
  const source = await readFile(resolve(root, file), "utf8");
  runInNewContext(source, context, { filename: file, timeout: 2000 });
}

const runtimeSource = context.window.NEARER_RUNTIME_SOURCE;
const marker = "const COUNTRY_METADATA =";
const start = runtimeSource.indexOf(marker);
if (start < 0) throw new Error("The country metadata marker is missing from the Nearer runtime.");
const arrayStart = runtimeSource.indexOf("[", start);
const arrayEnd = runtimeSource.indexOf("];", arrayStart);
if (arrayStart < 0 || arrayEnd < 0) throw new Error("The country metadata array could not be extracted.");

const metadata = JSON.parse(runtimeSource.slice(arrayStart, arrayEnd + 1));
const selected = metadata.filter(country => {
  const area = Number(country.area) || 0;
  return criticalCodes.has(country.code) || (area > 0 && area <= areaThreshold);
});

const topology = JSON.parse(await readFile(resolve(root, "node_modules/world-atlas/countries-10m.json"), "utf8"));
const sourceFeatures = topoFeature(topology, topology.objects.countries).features;
const sourceByNumeric = new Map(sourceFeatures.map(item => [String(item.id).padStart(3, "0"), item]));

const features = selected.map(country => {
  const source = sourceByNumeric.get(String(country.numeric).padStart(3, "0"));
  if (!source?.geometry) return null;
  return {
    type: "Feature",
    properties: {
      code: country.code,
      name: country.name,
      numeric: String(country.numeric).padStart(3, "0"),
      area: Number(country.area) || 0
    },
    geometry: source.geometry
  };
}).filter(Boolean);

const featureCodes = new Set(features.map(item => item.properties.code));
const missingCritical = [...criticalCodes].filter(code => !featureCodes.has(code));
if (missingCritical.length) {
  throw new Error(`Precision geometry is missing required countries: ${missingCritical.join(", ")}`);
}

const collection = {
  type: "FeatureCollection",
  properties: {
    source: "Natural Earth 1:10m via world-atlas",
    areaThreshold,
    count: features.length
  },
  features
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(collection)}\n`, "utf8");
console.log(`Generated compact 1:10m precision geometry for ${features.length} small countries.`);
