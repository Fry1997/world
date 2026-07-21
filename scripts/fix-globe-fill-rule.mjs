import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const masteryPath = resolve(process.cwd(), 'src/generated/mastery-runtime.js');
const atlasPath = resolve(process.cwd(), 'src/generated/atlas-globe.js');

function replaceRequired(source, search, replacement, label, file) {
  if (!source.includes(search)) throw new Error(`Could not apply ${label} to ${basename(file)}.`);
  return source.replace(search, replacement);
}

let mastery = await readFile(masteryPath, 'utf8');
mastery = mastery
  .replaceAll('context.fill("evenodd");', 'context.fill();')
  .replaceAll("context.fill('evenodd');", 'context.fill();');
mastery = replaceRequired(
  mastery,
  'if (zoom < 4) drawFeature(worldCollection,land,"rgba(31,45,55,.55)",.7); else for (const feature of basePolygonFeatures) if (featureNearView(feature)) drawFeature(feature,land,"rgba(31,45,55,.55)",Math.max(.18,.7/Math.sqrt(Math.max(1,zoom/4)))); for (const feature of precisionPolygonFeatures) if (featureNearView(feature)) drawFeature(feature,land,"rgba(31,45,55,.55)",zoom < 4 ? .7 : Math.max(.18,.7/Math.sqrt(Math.max(1,zoom/4))));',
  'for (const feature of basePolygonFeatures) if (featureNearView(feature)) drawFeature(feature,land,"rgba(31,45,55,.55)",zoom < 4 ? .7 : Math.max(.18,.7/Math.sqrt(Math.max(1,zoom/4)))); for (const feature of precisionPolygonFeatures) if (featureNearView(feature)) drawFeature(feature,land,"rgba(31,45,55,.55)",zoom < 4 ? .7 : Math.max(.18,.7/Math.sqrt(Math.max(1,zoom/4))));',
  'individual Mastery country rendering',
  masteryPath
);

let atlas = await readFile(atlasPath, 'utf8');
atlas = atlas
  .replaceAll('context.fill("evenodd");', 'context.fill();')
  .replaceAll("context.fill('evenodd');", 'context.fill();');
atlas = replaceRequired(
  atlas,
  `    if (zoom < 4) {
      drawPath(model.worldCollection, land, 'rgba(28,43,54,.62)', .72);
    } else {
      for (const feature of model.polygons) {
        if (featureNearView(feature)) drawPath(feature, land, 'rgba(28,43,54,.62)', Math.max(.18, .7 / Math.sqrt(Math.max(1, zoom / 4))));
      }
    }`,
  `    for (const feature of model.polygons) {
      if (featureNearView(feature)) drawPath(feature, land, 'rgba(28,43,54,.62)', zoom < 4 ? .72 : Math.max(.18, .7 / Math.sqrt(Math.max(1, zoom / 4))));
    }`,
  'individual Atlas country rendering',
  atlasPath
);

for (const [file, source] of [[masteryPath, mastery], [atlasPath, atlas]]) {
  if (/context\.fill\(["']evenodd["']\)/.test(source)) {
    throw new Error(`The even-odd globe fill rule remains in ${basename(file)}.`);
  }
  await writeFile(file, source, 'utf8');
}

console.log('Corrected Atlas and Mastery spherical country rendering.');
