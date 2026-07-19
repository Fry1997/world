import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const skip = new Set([".git", "node_modules"]);

async function walk(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await walk(file));
    else result.push(file);
  }
  return result;
}

async function localReferenceExists(file) {
  try {
    const info = await stat(file);
    if (info.isDirectory()) await stat(path.join(file, "index.html"));
    return true;
  } catch {
    return false;
  }
}

const errors = [];
const htmlFiles = (await walk(root)).filter(file => file.endsWith(".html"));

for (const file of htmlFiles) {
  const source = await readFile(file, "utf8");
  const label = path.relative(root, file);
  const ids = [...source.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicates.length) errors.push(`${label}: duplicate ids ${duplicates.join(", ")}`);

  const rootBased = /<base\s+href=["']\/world\/["']/i.test(source);
  const references = [...source.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)].map(match => match[1]);
  for (const reference of references) {
    if (/^(?:https?:|data:|mailto:|tel:|#)/i.test(reference)) continue;
    const clean = reference.split(/[?#]/)[0];
    if (!clean || clean === "." || clean === "./") continue;
    const githubPagesRoot = clean === "/world" || clean.startsWith("/world/");
    const resolved = rootBased || githubPagesRoot
      ? path.resolve(root, clean.replace(/^\/world\/?/, "").replace(/^\//, ""))
      : path.resolve(path.dirname(file), clean);
    if (!await localReferenceExists(resolved)) errors.push(`${label}: missing ${reference}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${htmlFiles.length} HTML files.`);
}
