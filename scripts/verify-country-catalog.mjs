import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const path = resolve(process.cwd(), "dist/country-catalog.json");
const catalog = JSON.parse(await readFile(path, "utf8"));
if (!/^countries-[a-f0-9]{16}$/.test(catalog.version || "")) {
  throw new Error("The generated country catalog has an invalid version fingerprint.");
}
if (!Array.isArray(catalog.countries) || catalog.countries.length !== 197 || catalog.count !== 197) {
  throw new Error(`Expected 197 countries in the generated catalog, found ${catalog.countries?.length || 0}.`);
}
const codes = catalog.countries.map(country => country.code);
if (new Set(codes).size !== codes.length || codes.some(code => !/^[A-Z]{3}$/.test(code))) {
  throw new Error("The generated country catalog contains duplicate or invalid codes.");
}
console.log(`Verified ${catalog.version} with ${catalog.count} unique countries.`);
