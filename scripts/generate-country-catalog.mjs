import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

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
const countries = metadata.map(country => ({
  code: country.code,
  name: country.name,
  aliases: country.aliases || []
}));
const fingerprint = createHash("sha256").update(countries.map(country => country.code).join(",")).digest("hex").slice(0, 16);
const catalog = {
  version: `countries-${fingerprint}`,
  generatedAt: new Date().toISOString(),
  count: countries.length,
  countries
};

await writeFile(resolve(root, "dist/country-catalog.json"), `${JSON.stringify(catalog)}\n`, "utf8");
console.log(`Generated ${catalog.version} with ${catalog.count} countries.`);
