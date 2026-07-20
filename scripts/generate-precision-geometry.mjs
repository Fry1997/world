import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { feature as topoFeature } from "topojson-client";

const root = process.cwd();
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

const normalise = value => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");

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
const countries = JSON.parse(runtimeSource.slice(arrayStart, arrayEnd + 1));

const topology = JSON.parse(await readFile(resolve(root, "node_modules/world-atlas/countries-10m.json"), "utf8"));
const sourceFeatures = topoFeature(topology, topology.objects.countries).features;
const sourceByNumeric = new Map();
const sourceByName = new Map();
for (const source of sourceFeatures) {
  if (source.id !== undefined && source.id !== null && source.id !== "") {
    sourceByNumeric.set(String(source.id).padStart(3, "0"), source);
  }
  const name = normalise(source.properties?.name);
  if (name) sourceByName.set(name, source);
}

const alwaysPrecision = new Set(["VAT", "MCO", "SMR", "LIE", "AND", "LUX", "MNE"]);
const selected = countries.filter(country => Number(country.area || 0) <= 30_000 || alwaysPrecision.has(country.code));
const outputFeatures = [];
for (const country of selected) {
  let source = country.numeric ? sourceByNumeric.get(String(country.numeric).padStart(3, "0")) : null;
  if (!source) {
    for (const name of [country.name, ...(country.aliases || [])].map(normalise)) {
      source = sourceByName.get(name);
      if (source) break;
    }
  }
  if (!source?.geometry || source.geometry.type === "Point") continue;
  outputFeatures.push({
    type: "Feature",
    properties: {
      code: country.code,
      name: country.name,
      continent: country.continent,
      area: Number(country.area || 0),
      detailScale: "10m"
    },
    geometry: source.geometry
  });
}

const outputByCode = new Map(outputFeatures.map(item => [item.properties.code, item]));
const unresolved = [...alwaysPrecision].filter(code => !outputByCode.has(code));
if (unresolved.length) throw new Error(`Precision geometry is missing critical countries: ${unresolved.join(", ")}`);

const output = {
  type: "FeatureCollection",
  properties: {
    source: "Natural Earth 1:10m via world-atlas",
    thresholdAreaKm2: 30_000,
    count: outputFeatures.length
  },
  features: outputFeatures
};
const serialised = `${JSON.stringify(output)}\n`;
const bytes = Buffer.byteLength(serialised);
if (bytes > 900_000) throw new Error(`The compact precision layer is unexpectedly large (${bytes.toLocaleString()} bytes).`);

const outputPath = resolve(root, "src/generated/precision-countries.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, serialised, "utf8");
console.log(`Generated ${outputFeatures.length} precision countries in ${(bytes / 1024).toFixed(1)} KiB.`);
