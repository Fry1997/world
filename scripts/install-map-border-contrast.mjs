import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const masteryPath = resolve(process.cwd(), 'src/generated/mastery-runtime.js');
const atlasPath = resolve(process.cwd(), 'src/generated/atlas-globe.js');

function replaceRequired(source, search, replacement, label, file) {
  const first = source.indexOf(search);
  const last = source.lastIndexOf(search);
  if (first < 0) throw new Error(`Could not install ${label} in ${basename(file)}.`);
  if (first !== last) throw new Error(`Could not install ${label}: the pattern was not unique in ${basename(file)}.`);
  return `${source.slice(0, first)}${replacement}${source.slice(first + search.length)}`;
}

let mastery = await readFile(masteryPath, 'utf8');
const masteryInsertionPoint = 'function markerPositionAvailable(point, placed) { return placed.every(marker => Math.hypot(marker.point[0] - point[0], marker.point[1] - point[1]) >= MICROSTATE_MARKER_SEPARATION); }';
const masteryBorderRuntime = `function persistentBorderWidths() { const scale = Math.sqrt(Math.max(1, zoom / 4)); return { under: zoom < 4 ? 1.3 : Math.max(.5, 1.15 / scale), main: zoom < 4 ? .68 : Math.max(.3, .62 / scale) }; }
  function drawPersistentCountryBorders() { const widths = persistentBorderWidths(); const visibleFeatures = polygonFeatures.filter(featureNearView); for (const feature of visibleFeatures) drawFeature(feature,null,"rgba(31,47,59,.50)",widths.under,.92); for (const feature of visibleFeatures) drawFeature(feature,null,"rgba(195,211,221,.76)",widths.main,.96); }
  ${masteryInsertionPoint}`;
mastery = replaceRequired(mastery, masteryInsertionPoint, masteryBorderRuntime, 'Mastery dual-pass border renderer', masteryPath);

const masteryRegionPass = 'for (const code of regionCodes) { const feature = featureByCode.get(code); if (!feature || feature.geometry.type === "Point") continue; drawFeature(feature,"rgba(82,126,153,.18)","rgba(221,236,244,.42)",.9); }';
mastery = replaceRequired(
  mastery,
  masteryRegionPass,
  `${masteryRegionPass} drawPersistentCountryBorders();`,
  'Mastery persistent border pass',
  masteryPath
);

let atlas = await readFile(atlasPath, 'utf8');
const atlasInsertionPoint = '  function longitudeNear(value, minimum, maximum, padding) {';
const atlasBorderRuntime = `  function persistentBorderWidths() {
    const scale = Math.sqrt(Math.max(1, zoom / 4));
    return {
      under: zoom < 4 ? 1.3 : Math.max(.5, 1.15 / scale),
      main: zoom < 4 ? .68 : Math.max(.3, .62 / scale)
    };
  }

  function drawPersistentCountryBorders() {
    const widths = persistentBorderWidths();
    const visibleFeatures = model.polygons.filter(featureNearView);
    for (const feature of visibleFeatures) drawPath(feature, null, 'rgba(31,47,59,.50)', widths.under, .92);
    for (const feature of visibleFeatures) drawPath(feature, null, 'rgba(195,211,221,.76)', widths.main, .96);
  }

${atlasInsertionPoint}`;
atlas = replaceRequired(atlas, atlasInsertionPoint, atlasBorderRuntime, 'Atlas dual-pass border renderer', atlasPath);

const atlasLandPass = `    for (const feature of model.polygons) {
      if (featureNearView(feature)) drawPath(feature, land, 'rgba(28,43,54,.62)', zoom < 4 ? .72 : Math.max(.18, .7 / Math.sqrt(Math.max(1, zoom / 4))));
    }`;
atlas = replaceRequired(
  atlas,
  atlasLandPass,
  `${atlasLandPass}\n    drawPersistentCountryBorders();`,
  'Atlas persistent border pass',
  atlasPath
);

for (const [file, source] of [[masteryPath, mastery], [atlasPath, atlas]]) {
  if (!source.includes('drawPersistentCountryBorders')) {
    throw new Error(`Persistent borders were not installed in ${basename(file)}.`);
  }
  await writeFile(file, source, 'utf8');
}

console.log('Installed subtle, persistent dual-pass country borders.');
