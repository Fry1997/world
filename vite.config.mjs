import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { defineConfig } from "vite";

const root = process.cwd();
const outDir = resolve(root, "dist");

const pages = {
  main: resolve(root, "index.html"),
  mastery: resolve(root, "mastery/index.html"),
  together: resolve(root, "together/index.html"),
  race: resolve(root, "together/race/index.html"),
  cooperative: resolve(root, "together/cooperative/index.html"),
  duel: resolve(root, "together/duel/index.html")
};

const ignoredDirectories = new Set([
  ".git",
  ".github",
  "dist",
  "node_modules",
  "scripts",
  "src",
  "supabase"
]);

const ignoredRootFiles = new Set([
  "package.json",
  "package-lock.json",
  "vite.config.mjs",
  "vercel.json",
  "platform.js",
  "cloud.js",
  "cloud.css",
  "runtime-loader.js"
]);

const bundledOnlyLegacyAssets = [
  /^chunks\/(?:app-|runtime-)[^/]+\.js$/,
  /^mastery\/mastery(?:-loader)?\.js$/,
  /^guess-rules\.js$/,
  /^guessed-country-info\.js$/,
  /^together\/race\/chunks\/race-[^/]+\.js$/,
  /^together\/race\/race-loader\.js$/,
  /^together\/cooperative\/cooperative(?:-loader)?\.js$/,
  /^together\/duel\/(?:duel|duel-loader|duel-pressure)\.js$/,
  /^together\/shared\/(?:together-core|premium-globe-v2|polish-ui|experience(?:4|5|6|7|8|9|10)|experience8-bootstrap)\.js$/
];

const directPlatformScript = /<script\b[^>]*\bsrc=["'](?:\.\/)?platform\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi;
const directSoloScript = /<script\b[^>]*\bsrc=["'](?:\.\/)?(?:chunks\/(?:app-[^"']+|runtime-\d+)\.js|runtime-loader\.js)(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi;
const directMasteryScript = /<script\b[^>]*\bsrc=["'](?:\.\/)?(?:chunks\/runtime-\d+\.js|mastery\/mastery-loader\.js)(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi;
const directTogetherHubScript = /<script\b[^>]*\bsrc=["']together\/shared\/experience(?:7|8|9|10)\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi;
const directTogetherModeScript = /<script\b[^>]*\bsrc=["'](?:chunks\/runtime-\d+\.js|together\/(?:race\/race-loader|cooperative\/cooperative-loader|duel\/duel-loader|shared\/experience8-bootstrap)\.js)(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi;

async function copyLegacyAssets(sourceDirectory = root) {
  for (const entry of await readdir(sourceDirectory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".nojekyll") continue;

    const sourcePath = resolve(sourceDirectory, entry.name);
    const relativePath = relative(root, sourcePath);
    const normalisedPath = relativePath.split(sep).join("/");
    const firstSegment = relativePath.split(sep)[0];

    if (entry.isDirectory()) {
      if (ignoredDirectories.has(firstSegment)) continue;
      await copyLegacyAssets(sourcePath);
      continue;
    }

    if (relativePath.endsWith(".html")) continue;
    if (!relativePath.includes(sep) && ignoredRootFiles.has(entry.name)) continue;
    if (bundledOnlyLegacyAssets.some(pattern => pattern.test(normalisedPath))) continue;

    const destinationPath = resolve(outDir, relativePath);
    await mkdir(dirname(destinationPath), { recursive: true });
    await copyFile(sourcePath, destinationPath);
  }
}

function nearerCompatibilityPlugin() {
  return {
    name: "nearer-compatibility-build",
    enforce: "pre",
    transformIndexHtml: {
      order: "pre",
      handler(html, context) {
        const filename = context?.filename ? resolve(context.filename) : "";
        const isMainPage = filename === pages.main;
        const isMasteryPage = filename === pages.mastery;
        const isTogetherHub = filename === pages.together;
        const isRacePage = filename === pages.race;
        const isCooperativePage = filename === pages.cooperative;
        const isDuelPage = filename === pages.duel;
        const tags = [
          {
            tag: "script",
            children: "window.__NEARER_PLATFORM_MODULE_PENDING=true;",
            injectTo: "head-pre"
          },
          {
            tag: "script",
            attrs: { type: "module", src: "/src/platform-entry.js" },
            injectTo: "head"
          }
        ];

        const routeEntry = isMainPage ? "/src/solo-entry.js"
          : isMasteryPage ? "/src/mastery-entry.js"
            : isTogetherHub ? "/src/together-hub-entry.js"
              : isRacePage ? "/src/race-entry.js"
                : isCooperativePage ? "/src/cooperative-entry.js"
                  : isDuelPage ? "/src/duel-entry.js"
                    : null;

        if (routeEntry) {
          tags.push({
            tag: "script",
            attrs: { type: "module", src: routeEntry },
            injectTo: "head"
          });
        }

        let transformedHtml = html
          .replaceAll('<base href="/world/">', '<base href="/">')
          .replace(directPlatformScript, "");

        if (isMainPage) transformedHtml = transformedHtml.replace(directSoloScript, "");
        if (isMasteryPage) transformedHtml = transformedHtml.replace(directMasteryScript, "");
        if (isTogetherHub) transformedHtml = transformedHtml.replace(directTogetherHubScript, "");
        if (isRacePage || isCooperativePage || isDuelPage) {
          transformedHtml = transformedHtml.replace(directTogetherModeScript, "");
        }

        return { html: transformedHtml, tags };
      }
    },
    async closeBundle() {
      await copyLegacyAssets();
    }
  };
}

export default defineConfig({
  appType: "mpa",
  base: "/",
  plugins: [nearerCompatibilityPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "baseline-widely-available",
    cssCodeSplit: true,
    sourcemap: false,
    rolldownOptions: {
      input: pages
    }
  }
});
