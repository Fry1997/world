import { copyFile, mkdir, readFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { runInNewContext } from "node:vm";
import { defineConfig } from "vite";

const root = process.cwd();
const outDir = resolve(root, "dist");
const cloudModulePath = resolve(root, "cloud.js");

const pages = {
  main: resolve(root, "index.html"),
  mastery: resolve(root, "mastery/index.html"),
  together: resolve(root, "together/index.html"),
  race: resolve(root, "together/race/index.html"),
  cooperative: resolve(root, "together/cooperative/index.html"),
  duel: resolve(root, "together/duel/index.html")
};

const sourceFiles = {
  runtime: [
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
  ],
  app: [
    "chunks/app-01.js",
    "chunks/app-01b.js",
    "chunks/app-01c.js",
    "chunks/app-01d.js",
    "chunks/app-02.js",
    "chunks/app-03.js",
    "chunks/app-04.js",
    "chunks/app-05.js"
  ],
  race: [
    "together/race/chunks/race-01.js",
    "together/race/chunks/race-02.js",
    "together/race/chunks/race-03.js",
    "together/race/chunks/race-04.js",
    "together/race/chunks/race-05.js",
    "together/race/chunks/race-06.js"
  ]
};

const virtualModules = {
  "virtual:nearer-runtime": "\0virtual:nearer-runtime",
  "virtual:nearer-app": "\0virtual:nearer-app",
  "virtual:nearer-race": "\0virtual:nearer-race"
};
const sourceCache = new Map();

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
  /^together\/shared\/(?:together-core|premium-globe-v2|polish-ui|experience(?:4|5|6|7|8|9|10)|experience8-bootstrap)\.js$/,
  /^(?:styles|globe|platform|performance)\.css$/,
  /^mastery\/mastery\.css$/,
  /^together\/(?:race\/race|cooperative\/cooperative|duel\/duel)\.css$/,
  /^together\/shared\/(?:mode|polish|prestige|experience(?:2|3|4|5|6|7|7-multiplayer|8|9|10)?)\.css$/
];

const directPlatformScript = /<script\b[^>]*\bsrc=["'](?:\.\/)?platform\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi;
const directSoloScript = /<script\b[^>]*\bsrc=["'](?:\.\/)?(?:chunks\/(?:app-[^"']+|runtime-\d+)\.js|runtime-loader\.js)(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi;
const directMasteryScript = /<script\b[^>]*\bsrc=["'](?:\.\/)?(?:chunks\/runtime-\d+\.js|mastery\/mastery-loader\.js)(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi;
const directTogetherHubScript = /<script\b[^>]*\bsrc=["']together\/shared\/experience(?:7|8|9|10)\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi;
const directTogetherModeScript = /<script\b[^>]*\bsrc=["'](?:chunks\/runtime-\d+\.js|together\/(?:race\/race-loader|cooperative\/cooperative-loader|duel\/duel-loader|shared\/experience8-bootstrap)\.js)(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi;
const directStylesheetLink = /<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["'][^"']+\.css(?:\?[^"']*)?["'])[^>]*>\s*/gi;
const remoteSupabaseDeclaration = 'const SUPABASE_MODULE = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";';
const remoteSupabaseImport = "import(SUPABASE_MODULE)";
const cloudApiDeclaration = "window.NEARER_CLOUD = { open: openAccount, sync: () => syncAll({ initial: false }), get session() { return session; } };";
const cloudApiReplacement = "window.NEARER_CLOUD = { open: openAccount, sync: () => syncAll({ initial: false }), client: getClient, get session() { return session; } };";

async function reconstructSource(files, globalKey) {
  const cacheKey = `${globalKey}:${files.join(",")}`;
  if (sourceCache.has(cacheKey)) return sourceCache.get(cacheKey);

  const promise = (async () => {
    const context = { window: {} };
    for (const file of files) {
      const code = await readFile(resolve(root, file), "utf8");
      runInNewContext(code, context, { filename: file, timeout: 2_000 });
    }
    const source = context.window[globalKey];
    if (typeof source !== "string" || !source.trim()) {
      throw new Error(`Could not reconstruct ${globalKey}.`);
    }
    return source;
  })();

  sourceCache.set(cacheKey, promise);
  return promise;
}

async function nativeRuntimeSource() {
  const source = await reconstructSource(sourceFiles.runtime, "NEARER_RUNTIME_SOURCE");
  const externalImports = /^import \* as d3 from "[^"]+";\nimport \{ feature as topoFeature \} from "[^"]+";\nimport world from "[^"]+";\n\n/;
  const metadataMarker = "const COUNTRY_METADATA =";
  if (!externalImports.test(source) || !source.includes(metadataMarker)) {
    throw new Error("The reconstructed Nearer runtime has an unexpected format.");
  }

  return source
    .replace(externalImports, [
      'import * as d3 from "d3";',
      'import { feature as topoFeature } from "topojson-client";',
      'import world from "world-atlas/countries-110m.json";',
      ""
    ].join("\n"))
    .replace(
      metadataMarker,
      "window.NEARER_D3 = d3;\nwindow.NEARER_TOPO_FEATURE = topoFeature;\nwindow.NEARER_WORLD_TOPOLOGY = world;\nconst COUNTRY_METADATA ="
    );
}

async function nativeAppSource() {
  const source = await reconstructSource(sourceFiles.app, "NEARER_APP_SOURCE");
  if (!source.includes("initializeMap();")) {
    throw new Error("The reconstructed Nearer application has an unexpected format.");
  }
  return source.replace("initializeMap();", "");
}

async function nativeRaceSource() {
  const source = await reconstructSource(sourceFiles.race, "NEARER_RACE_SOURCE");
  if (!source.includes("window.__NEARER_RACE_V2_STARTED = true")) {
    throw new Error("The reconstructed Same Target Race source is incomplete.");
  }
  return source;
}

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
    resolveId(id) {
      return virtualModules[id] || null;
    },
    async load(id) {
      if (id === virtualModules["virtual:nearer-runtime"]) return nativeRuntimeSource();
      if (id === virtualModules["virtual:nearer-app"]) return nativeAppSource();
      if (id === virtualModules["virtual:nearer-race"]) return nativeRaceSource();
      return null;
    },
    transform(code, id) {
      if (id !== cloudModulePath) return null;
      if (!code.includes(remoteSupabaseDeclaration) || !code.includes(remoteSupabaseImport) || !code.includes(cloudApiDeclaration)) {
        throw new Error("The Nearer cloud module has an unexpected Supabase import format.");
      }
      return {
        code: code
          .replace(remoteSupabaseDeclaration, "")
          .replace(remoteSupabaseImport, 'import("./src/supabase-client.js")')
          .replace(cloudApiDeclaration, cloudApiReplacement),
        map: null
      };
    },
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
          .replace(directPlatformScript, "")
          .replace(directStylesheetLink, "");

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
