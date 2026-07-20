import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

const assetsDirectory = resolve(process.cwd(), "dist/assets");
const kibibyte = 1024;

const budgets = [
  {
    label: "first-party JavaScript",
    filter: name => name.endsWith(".js") && !name.startsWith("supabase-client-"),
    largestRaw: 500 * kibibyte,
    totalRaw: 750 * kibibyte,
    largestGzip: 170 * kibibyte,
    totalGzip: 260 * kibibyte
  },
  {
    label: "lazy account client",
    filter: name => name.startsWith("supabase-client-") && name.endsWith(".js"),
    largestRaw: 230 * kibibyte,
    totalRaw: 230 * kibibyte,
    largestGzip: 65 * kibibyte,
    totalGzip: 65 * kibibyte
  },
  {
    label: "all JavaScript",
    filter: name => name.endsWith(".js"),
    largestRaw: 500 * kibibyte,
    totalRaw: 900 * kibibyte,
    largestGzip: 170 * kibibyte,
    totalGzip: 330 * kibibyte
  },
  {
    label: "stylesheet",
    filter: name => name.endsWith(".css"),
    largestRaw: 80 * kibibyte,
    totalRaw: 260 * kibibyte,
    largestGzip: 18 * kibibyte,
    totalGzip: 60 * kibibyte
  }
];

function formatBytes(bytes) {
  return `${(bytes / kibibyte).toFixed(1)} KiB`;
}

async function measureAssets(filter) {
  const names = (await readdir(assetsDirectory)).filter(filter);
  const measured = await Promise.all(names.map(async name => {
    const content = await readFile(resolve(assetsDirectory, name));
    return {
      name,
      raw: content.byteLength,
      gzip: gzipSync(content, { level: 9 }).byteLength
    };
  }));

  measured.sort((first, second) => second.raw - first.raw);
  return measured;
}

function enforceBudget(label, assets, limits) {
  if (!assets.length) throw new Error(`No ${label} assets were generated.`);

  const largestRaw = assets.reduce((largest, asset) => asset.raw > largest.raw ? asset : largest);
  const largestGzip = assets.reduce((largest, asset) => asset.gzip > largest.gzip ? asset : largest);
  const totalRaw = assets.reduce((sum, asset) => sum + asset.raw, 0);
  const totalGzip = assets.reduce((sum, asset) => sum + asset.gzip, 0);
  const failures = [];

  if (largestRaw.raw > limits.largestRaw) {
    failures.push(`${largestRaw.name} is ${formatBytes(largestRaw.raw)} raw; limit ${formatBytes(limits.largestRaw)}.`);
  }
  if (largestGzip.gzip > limits.largestGzip) {
    failures.push(`${largestGzip.name} is ${formatBytes(largestGzip.gzip)} gzip; limit ${formatBytes(limits.largestGzip)}.`);
  }
  if (totalRaw > limits.totalRaw) {
    failures.push(`Total ${label} size is ${formatBytes(totalRaw)} raw; limit ${formatBytes(limits.totalRaw)}.`);
  }
  if (totalGzip > limits.totalGzip) {
    failures.push(`Total ${label} size is ${formatBytes(totalGzip)} gzip; limit ${formatBytes(limits.totalGzip)}.`);
  }

  if (failures.length) {
    const largestAssets = assets.slice(0, 5).map(asset =>
      `  - ${asset.name}: ${formatBytes(asset.raw)} raw, ${formatBytes(asset.gzip)} gzip`
    ).join("\n");
    throw new Error(`${label} asset budget exceeded:\n${failures.join("\n")}\nLargest generated assets:\n${largestAssets}`);
  }

  console.log(
    `${label}: ${assets.length} assets, ${formatBytes(totalRaw)} raw / ${formatBytes(totalGzip)} gzip; ` +
    `largest ${largestRaw.name} at ${formatBytes(largestRaw.raw)} raw.`
  );
}

for (const budget of budgets) {
  const assets = await measureAssets(budget.filter);
  enforceBudget(budget.label, assets, budget);
}
