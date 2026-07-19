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
  "supabase"
]);

const ignoredRootFiles = new Set([
  "package.json",
  "package-lock.json",
  "vite.config.mjs",
  "vercel.json"
]);

async function copyLegacyAssets(sourceDirectory = root) {
  for (const entry of await readdir(sourceDirectory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".nojekyll") continue;

    const sourcePath = resolve(sourceDirectory, entry.name);
    const relativePath = relative(root, sourcePath);
    const firstSegment = relativePath.split(sep)[0];

    if (entry.isDirectory()) {
      if (ignoredDirectories.has(firstSegment)) continue;
      await copyLegacyAssets(sourcePath);
      continue;
    }

    if (relativePath.endsWith(".html")) continue;
    if (!relativePath.includes(sep) && ignoredRootFiles.has(entry.name)) continue;

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
      handler(html) {
        return html.replaceAll('<base href="/world/">', '<base href="/">');
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
