import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const dist = resolve(root, "dist");

const requiredFiles = [
  "index.html",
  "mastery/index.html",
  "together/index.html",
  "together/race/index.html",
  "together/cooperative/index.html",
  "together/duel/index.html",
  "platform.js",
  "cloud.js",
  "runtime-loader.js",
  "mastery/mastery-loader.js",
  "together/race/race-loader.js",
  "together/cooperative/cooperative-loader.js",
  "together/duel/duel-loader.js"
];

for (const file of requiredFiles) {
  await access(resolve(dist, file));
}

const pages = requiredFiles.filter(file => file.endsWith(".html"));
for (const page of pages) {
  const html = await readFile(resolve(dist, page), "utf8");
  if (html.includes('<base href="/world/">')) {
    throw new Error(`${page} still points at the legacy /world/ base path.`);
  }
  if (!html.includes("platform")) {
    throw new Error(`${page} is missing the Nearer platform shell.`);
  }
}

console.log(`Verified ${requiredFiles.length} Nearer build outputs.`);
