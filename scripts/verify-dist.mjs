import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const dist = resolve(root, "dist");

const pages = ["index.html", "mastery/index.html", "together/index.html", "together/race/index.html", "together/cooperative/index.html", "together/duel/index.html"];

for (const page of pages) {
  await access(resolve(dist, page));
  const html = await readFile(resolve(dist, page), "utf8");
  if (html.includes('<base href="/world/">')) throw new Error(`${page} still points at the legacy /world/ base path.`);
  if (/src=["'](?:\.\/)?(?:platform|cloud)\.js/i.test(html)) throw new Error(`${page} still loads raw shared platform scripts.`);
  if (!html.includes("__NEARER_PLATFORM_MODULE_PENDING")) throw new Error(`${page} is missing the early shared-module marker.`);
  if (!html.includes('type="module"') || !html.includes("/assets/")) throw new Error(`${page} is missing its generated Vite module entry.`);
  if (/src=["'][^"']*(?:chunks\/(?:app-|runtime-)|runtime-loader|mastery-loader|race-loader|cooperative-loader|duel-loader|experience8-bootstrap)/i.test(html)) throw new Error(`${page} still contains a legacy runtime or loader request.`);
  if (/<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["'](?!\/assets\/)[^"']+\.css)/i.test(html)) throw new Error(`${page} still contains a direct legacy stylesheet request.`);
}

const togetherHubHtml = await readFile(resolve(dist, "together/index.html"), "utf8");
if (/src=["'][^"']*together\/shared\/experience(?:7|8|9|10)\.js/i.test(togetherHubHtml)) throw new Error("The Together hub still loads its experience scripts directly.");

const assetNames = await readdir(resolve(dist, "assets"));
const javascriptAssets = assetNames.filter(name => name.endsWith(".js"));
const stylesheetAssets = assetNames.filter(name => name.endsWith(".css"));
if (javascriptAssets.length < 10) throw new Error("The route modules were not split into expected cached assets.");
if (stylesheetAssets.length < 7) throw new Error("The route styles were not split into generated cached assets.");

const bundledJavascript = (await Promise.all(javascriptAssets.map(name => readFile(resolve(dist, "assets", name), "utf8")))).join("\n");
const bundledStyles = (await Promise.all(stylesheetAssets.map(name => readFile(resolve(dist, "assets", name), "utf8")))).join("\n");

const requiredBundleMarkers = [
  ["__NEARER_PLATFORM_STARTED", "platform shell"], ["__NEARER_CLOUD_STARTED", "cloud account layer"],
  ["Nearer game data did not initialise.", "native game-data loader"], ["nearer-game-v1", "solo game implementation"],
  ["__NEARER_PREMIUM_GLOBE_V2_STARTED", "adaptive globe"], ["Regional Mastery did not initialise.", "Regional Mastery entry"],
  ["__NEARER_MASTERY_STARTED", "Regional Mastery implementation"], ["Same Target Race did not initialise.", "Same Target Race entry"],
  ["__NEARER_RACE_V2_STARTED", "Same Target Race implementation"], ["Cooperative Relay did not initialise.", "Cooperative Relay entry"],
  ["__NEARER_COOPERATIVE_STARTED", "Cooperative Relay implementation"], ["Hidden Country Duel did not initialise.", "Hidden Country Duel entry"],
  ["__NEARER_DUEL_STARTED", "Hidden Country Duel implementation"], ["NEARER_TOGETHER_CORE", "Together shared core"]
];
for (const [marker, description] of requiredBundleMarkers) if (!bundledJavascript.includes(marker)) throw new Error(`The ${description} is missing from generated JavaScript assets.`);

for (const marker of ["NEARER_APP_SOURCE", "NEARER_RUNTIME_SOURCE", "NEARER_RACE_SOURCE", "URL.createObjectURL", "new Blob([source]", "(0, eval)("]) {
  if (bundledJavascript.includes(marker)) throw new Error(`Generated JavaScript still contains obsolete runtime mechanism: ${marker}`);
}

const requiredStyleMarkers = [["nearer-account-dialog", "cloud account styling"], ["app-shell", "base application styling"], ["mastery-shell", "Regional Mastery styling"], ["race-shell", "Same Target Race styling"], ["together-mode-shell", "Together mode styling"]];
for (const [marker, description] of requiredStyleMarkers) if (!bundledStyles.includes(marker)) throw new Error(`The ${description} is missing from generated CSS assets.`);

const legacyFiles = [
  "platform.js", "cloud.js", "cloud.css", "runtime-loader.js", "chunks/app-01.js", "chunks/runtime-01.js", "chunks/runtime-tail-01.js",
  "mastery/mastery.js", "mastery/mastery-loader.js", "guess-rules.js", "guessed-country-info.js", "together/race/chunks/race-01.js",
  "together/race/race-loader.js", "together/cooperative/cooperative.js", "together/cooperative/cooperative-loader.js", "together/duel/duel.js",
  "together/duel/duel-loader.js", "together/duel/duel-pressure.js", "together/shared/together-core.js", "together/shared/premium-globe-v2.js",
  "together/shared/polish-ui.js", "together/shared/experience7.js", "together/shared/experience8-bootstrap.js", "styles.css", "globe.css",
  "platform.css", "performance.css", "mastery/mastery.css", "together/race/race.css", "together/cooperative/cooperative.css", "together/duel/duel.css",
  "together/shared/mode.css", "together/shared/polish.css", "together/shared/prestige.css", "together/shared/experience.css",
  "together/shared/experience2.css", "together/shared/experience3.css", "together/shared/experience4.css", "together/shared/experience5.css",
  "together/shared/experience6.css", "together/shared/experience7.css", "together/shared/experience7-multiplayer.css", "together/shared/experience8.css",
  "together/shared/experience9.css", "together/shared/experience10.css"
];
for (const legacyFile of legacyFiles) {
  try { await access(resolve(dist, legacyFile)); throw new Error(`${legacyFile} was copied into dist instead of being bundled.`); }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
}

console.log(`Verified ${pages.length} Nearer pages and ${javascriptAssets.length + stylesheetAssets.length} hashed assets.`);
