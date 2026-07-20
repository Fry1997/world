import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as d3 from 'd3';
import { feature as topoFeature } from 'topojson-client';
import { orientCountryFeature } from '../src/country-geometry-orientation.js';

const root = process.cwd();
const hemisphere = Math.PI * 2;
const topology = JSON.parse(await readFile(resolve(root, 'node_modules/world-atlas/countries-50m.json'), 'utf8'));
const precision = JSON.parse(await readFile(resolve(root, 'src/generated/precision-countries.json'), 'utf8'));
const features = [
  ...topoFeature(topology, topology.objects.countries).features,
  ...(precision.features || [])
];

let corrected = 0;
const unresolved = [];
for (const feature of features) {
  if (!feature?.geometry || feature.geometry.type === 'Point') continue;
  const oriented = orientCountryFeature(feature, d3);
  if (oriented !== feature) corrected += 1;
  const area = d3.geoArea(oriented);
  if (!Number.isFinite(area) || area > hemisphere) {
    unresolved.push(feature.properties?.name || feature.id || 'unknown');
  }
}

console.log(`Checked country polygon orientation across ${features.length} features; corrected ${corrected}.`);
if (unresolved.length) console.warn(`Orientation diagnostics still flag: ${unresolved.join(', ')}`);
