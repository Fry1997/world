import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const input = resolve(process.cwd(), "src/atlas-globe.js");
const output = resolve(process.cwd(), "src/generated/atlas-globe.js");
let source = await readFile(input, "utf8");
source = source.replace("if (zoom < 24) return true;", "if (zoom < 4) return true;");
source = source.replace("const latitudePadding = Math.max(.08, 220 / zoom);", "const latitudePadding = Math.max(.08, 150 / zoom);");
source = source.replace("if (zoom < 24) {\n      drawPath(model.worldCollection, land, 'rgba(28,43,54,.62)', zoom > 7 ? .45 : .72);", "if (zoom < 4) {\n      drawPath(model.worldCollection, land, 'rgba(28,43,54,.62)', .72);");
source = source.replace("Math.max(.22, .7 / Math.sqrt(zoom / 24))", "Math.max(.18, .7 / Math.sqrt(Math.max(1, zoom / 4)))");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, source, "utf8");
console.log("Stabilised Atlas deep-zoom rendering.");
