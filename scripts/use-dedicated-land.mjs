import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const masteryPath = resolve(process.cwd(), 'src/generated/mastery-runtime.js');
let mastery = await readFile(masteryPath, 'utf8');
const masteryDeclaration = 'const worldCollection = { type: "FeatureCollection", features: basePolygonFeatures };';
if (!mastery.includes(masteryDeclaration)) throw new Error('Mastery land collection declaration was not found.');
mastery = mastery.replace(
  masteryDeclaration,
  `${masteryDeclaration} const landFeature = window.NEARER_LAND_GEOJSON || worldCollection;`
);
if (!mastery.includes('drawFeature(worldCollection,land')) throw new Error('Mastery base land draw was not found.');
mastery = mastery.replace('drawFeature(worldCollection,land', 'drawFeature(landFeature,land');
await writeFile(masteryPath, mastery, 'utf8');

const atlasPath = resolve(process.cwd(), 'src/generated/atlas-globe.js');
let atlas = await readFile(atlasPath, 'utf8');
if (!atlas.includes('drawPath(model.worldCollection, land')) throw new Error('Atlas base land draw was not found.');
atlas = atlas.replace('drawPath(model.worldCollection, land', 'drawPath(model.land, land');
await writeFile(atlasPath, atlas, 'utf8');

console.log('Configured Atlas and Mastery to draw the dedicated land feature.');
