import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const dist = resolve(root, "dist");
const runtimeTailFiles = Array.from(
  { length: 9 },
  (_, index) => `chunks/runtime-tail-${String(index + 1).padStart(2, "0")}.js`
);

const requiredFiles = [
  "index.html",
  "mastery/index.html",
  "together/index.html",
  "together/race/index.html",
  "together/cooperative/index.html",
  "together/duel/index.html",
  "chunks/runtime-01.js",
  ...runtimeTailFiles,
  "mastery/mastery-loader.js",
  "together/race/race-loader.js",
  "together/cooperative/cooperative-loader.js",
  "together/duel/duel-loader.js",
  "together/shared/experience8-bootstrap.js"
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
  if (/src=["'](?:\.\/)?(?:platform|cloud)\.js/i.test(html)) {
    throw new Error(`${page} still loads the raw shared platform scripts.`);
  }
  if (!html.includes("__NEARER_PLATFORM_MODULE_PENDING")) {
    throw new Error(`${page} is missing the early shared-module marker.`);
  }
  if (!html.includes('type="module"') || !html.includes("/assets/")) {
    throw new Error(`${page} is missing the generated Vite module entry.`);
  }
}

const mainHtml = await readFile(resolve(dist, "index.html"), "utf8");
if (/chunks\/(?:app-|runtime-\d)/.test(mainHtml) || mainHtml.includes("runtime-loader.js")) {
  throw new Error("The Today and Random page still contains the legacy solo script waterfall.");
}

const assetNames = await readdir(resolve(dist, "assets"));
const javascriptAssets = assetNames.filter(name => name.endsWith(".js"));
const stylesheetAssets = assetNames.filter(name => name.endsWith(".css"));

if (javascriptAssets.length < 6) {
  throw new Error("The shared and solo modules were not split into cached assets.");
}
if (!stylesheetAssets.length) {
  throw new Error("The shared Vite stylesheet asset was not generated.");
}

const bundledJavascript = (await Promise.all(
  javascriptAssets.map(name => readFile(resolve(dist, "assets", name), "utf8"))
)).join("\n");
const bundledStyles = (await Promise.all(
  stylesheetAssets.map(name => readFile(resolve(dist, "assets", name), "utf8"))
)).join("\n");

if (!bundledJavascript.includes("__NEARER_PLATFORM_STARTED")) {
  throw new Error("The platform shell is missing from the generated JavaScript assets.");
}
if (!bundledJavascript.includes("__NEARER_CLOUD_STARTED")) {
  throw new Error("The cloud account layer is missing from the generated JavaScript assets.");
}
if (!bundledJavascript.includes("Nearer application source modules are missing.")) {
  throw new Error("The bundled solo bootstrap is missing from the generated JavaScript assets.");
}
if (!bundledJavascript.includes("__NEARER_PREMIUM_GLOBE_V2_STARTED")) {
  throw new Error("The solo enhancement sequence is missing from the generated JavaScript assets.");
}
if (!bundledStyles.includes("nearer-account-dialog")) {
  throw new Error("The cloud account styling is missing from the generated CSS assets.");
}

const togetherBootstrap = await readFile(resolve(dist, "together/shared/experience8-bootstrap.js"), "utf8");
if (!togetherBootstrap.includes("__NEARER_PLATFORM_MODULE_PENDING")) {
  throw new Error("Together can still race the bundled platform module with its legacy loader.");
}

for (const legacyFile of ["platform.js", "cloud.js", "cloud.css", "runtime-loader.js", "chunks/app-01.js"]) {
  try {
    await access(resolve(dist, legacyFile));
    throw new Error(`${legacyFile} was copied into dist instead of being bundled.`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const copiedChunks = await readdir(resolve(dist, "chunks"));
if (copiedChunks.some(name => name.startsWith("app-"))) {
  throw new Error("One or more solo application source fragments remain as public deployment files.");
}

console.log(`Verified ${requiredFiles.length} Nearer outputs and ${javascriptAssets.length + stylesheetAssets.length} hashed assets.`);
