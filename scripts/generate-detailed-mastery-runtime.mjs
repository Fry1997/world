import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const sourcePath = resolve(root, "mastery/mastery.js");
const outputPath = resolve(root, "src/generated/mastery-runtime.js");

let source = await readFile(sourcePath, "utf8");

function replaceOnce(search, replacement, label) {
  const first = source.indexOf(search);
  const last = source.lastIndexOf(search);
  if (first < 0) throw new Error(`Could not prepare detailed Mastery runtime: ${label} was not found.`);
  if (first !== last) throw new Error(`Could not prepare detailed Mastery runtime: ${label} was not unique.`);
  source = `${source.slice(0, first)}${replacement}${source.slice(first + search.length)}`;
}

replaceOnce(
  'function clampZoom(value) { return Math.max(.78, Math.min(4.5, value)); }',
  'function clampZoom(value) { return Math.max(.78, Math.min(900, value)); }',
  "zoom limit"
);

replaceOnce(
  'const worldCollection = { type: "FeatureCollection", features: polygonFeatures };',
  'const precisionPolygonFeatures = polygonFeatures.filter(feature => feature.properties.detailScale === "10m"); const basePolygonFeatures = polygonFeatures.filter(feature => feature.properties.detailScale !== "10m"); const worldCollection = { type: "FeatureCollection", features: basePolygonFeatures };',
  "precision land separation"
);

replaceOnce(
  'projection.translate([width / 2, height / 2]).scale(radius).rotate(rotation).precision(interaction ? .8 : .45);',
  'projection.translate([width / 2, height / 2]).scale(radius).rotate(rotation).precision(interaction ? Math.max(.08, .6 / Math.sqrt(Math.max(1, zoom))) : Math.max(.012, .38 / Math.sqrt(Math.max(1, zoom))));',
  "projection precision"
);

replaceOnce(
  'for (const feature of pointFeatures) { const code = feature.properties.code; if ((session?.completed || []).includes(code)) drawPoint(feature,"#4c9e7f","#fff6ed",4.6); else if (flashCode === code) drawPoint(feature,code === session?.current ? "#55c996" : "#d96751","#fff6ed",6); else if (revealCode === code) drawPoint(feature,"#e7ad4f","#fff6ed",6); else if (regionCodes.has(code)) drawPoint(feature,"#8aa8ba","rgba(255,255,255,.76)",3.8); }',
  'for (const feature of pointFeatures) { const code = feature.properties.code; if ((session?.completed || []).includes(code)) drawPoint(feature,"#4c9e7f","#fff6ed",4.6); else if (flashCode === code) drawPoint(feature,code === session?.current ? "#55c996" : "#d96751","#fff6ed",6); else if (revealCode === code) drawPoint(feature,"#e7ad4f","#fff6ed",6); }',
  "neutral point markers"
);

replaceOnce(
  'function drawPoint(feature, fill, stroke, radiusValue = 5) { const coordinate = feature.geometry.coordinates; if (!visible(coordinate)) return; const point = projection(coordinate); if (!point) return; context.save(); context.beginPath(); context.arc(point[0], point[1], radiusValue, 0, Math.PI * 2); context.fillStyle = fill; context.fill(); context.strokeStyle = stroke; context.lineWidth = 1.7; context.stroke(); context.restore(); }',
  `function drawPoint(feature, fill, stroke, radiusValue = 5) { const coordinate = feature.geometry.coordinates; if (!visible(coordinate)) return; const point = projection(coordinate); if (!point) return; context.save(); context.beginPath(); context.arc(point[0], point[1], radiusValue, 0, Math.PI * 2); context.fillStyle = fill; context.fill(); context.strokeStyle = stroke; context.lineWidth = 1.7; context.stroke(); context.restore(); }
  const polygonBounds = new Map(polygonFeatures.map(feature => [feature.properties.code, d3.geoBounds(feature)]));
  function longitudeNear(value, minimum, maximum, padding) { const longitude = ((value + 540) % 360) - 180; if (minimum <= maximum) return longitude >= minimum - padding && longitude <= maximum + padding; return longitude >= minimum - padding || longitude <= maximum + padding; }
  function featureNearView(feature) { if (zoom < 24) return true; const centre = [-rotation[0], -rotation[1]]; const latitudePadding = Math.max(.08, 220 / zoom); const longitudePadding = latitudePadding / Math.max(.2, Math.cos(centre[1] * Math.PI / 180)); const bounds = polygonBounds.get(feature.properties.code); return Boolean(bounds && centre[1] >= bounds[0][1] - latitudePadding && centre[1] <= bounds[1][1] + latitudePadding && longitudeNear(centre[0], bounds[0][0], bounds[1][0], longitudePadding)); }`,
  "deep zoom feature culling"
);

replaceOnce(
  'const land = context.createLinearGradient(width*.18,height*.12,width*.78,height*.9); land.addColorStop(0,"#f2ebdf"); land.addColorStop(.54,"#e5dccf"); land.addColorStop(1,"#bfb8ad"); drawFeature(worldCollection,land,"rgba(31,45,55,.55)",.7);',
  'const land = context.createLinearGradient(width*.18,height*.12,width*.78,height*.9); land.addColorStop(0,"#f2ebdf"); land.addColorStop(.54,"#e5dccf"); land.addColorStop(1,"#bfb8ad"); if (zoom < 24) drawFeature(worldCollection,land,"rgba(31,45,55,.55)",.7); else for (const feature of basePolygonFeatures) if (featureNearView(feature)) drawFeature(feature,land,"rgba(31,45,55,.55)",Math.max(.22,.7/Math.sqrt(zoom/24))); for (const feature of precisionPolygonFeatures) if (featureNearView(feature)) drawFeature(feature,land,"rgba(31,45,55,.55)",zoom < 24 ? .7 : Math.max(.22,.7/Math.sqrt(zoom/24)));',
  "deep zoom land rendering"
);

replaceOnce(
  'function focusCountry(code) { const feature = featureByCode.get(code); if (!feature) return; const coordinate = feature.geometry.type === "Point" ? feature.geometry.coordinates : d3.geoCentroid(feature); rotation = [-coordinate[0], -coordinate[1], 0]; zoom = Math.max(1.4, Math.min(2.2, zoom)); queueRender(); }',
  'function focusCountry(code) { const feature = featureByCode.get(code); if (!feature) return; const coordinate = feature.geometry.type === "Point" ? feature.geometry.coordinates : d3.geoCentroid(feature); const area = Number(countryByCode.get(code)?.area) || 0; const targetZoom = feature.geometry.type === "Point" || area <= 1 ? 720 : area <= 10 ? 520 : area <= 100 ? 260 : area <= 500 ? 120 : area <= 3000 ? 48 : area <= 10000 ? 24 : area <= 100000 ? 8 : 2.2; rotation = [-coordinate[0], -coordinate[1], 0]; zoom = Math.max(zoom, targetZoom); queueRender(); }',
  "reveal focus"
);

replaceOnce(
  'elements.zoomIn.addEventListener("click",()=>{zoom=clampZoom(zoom*1.25);queueRender();}); elements.zoomOut.addEventListener("click",()=>{zoom=clampZoom(zoom/1.25);queueRender();}); elements.reset.addEventListener("click",()=>setRegion(activeRegion));',
  'function zoomFactor(value) { return value < 12 ? 1.8 : value < 120 ? 2.2 : 2.5; } function changeZoom(direction) { const factor = zoomFactor(zoom); zoom = clampZoom(direction > 0 ? zoom * factor : zoom / factor); elements.stage.dataset.zoom = zoom.toFixed(zoom < 10 ? 1 : 0); queueRender(); } elements.zoomIn.addEventListener("click",()=>changeZoom(1)); elements.zoomOut.addEventListener("click",()=>changeZoom(-1)); elements.reset.addEventListener("click",()=>setRegion(activeRegion));',
  "zoom controls"
);

replaceOnce(
  'const globe = { queueRender, setRegion, focusCountry };',
  'const globe = { queueRender, setRegion, focusCountry }; window.NEARER_MASTERY_GLOBE = { zoomIn: () => changeZoom(1), zoomOut: () => changeZoom(-1), reset: () => elements.reset.click(), focusCountry, getZoom: () => zoom, projectCountry: code => { const feature = featureByCode.get(code); if (!feature) return null; const coordinate = feature.geometry.type === "Point" ? feature.geometry.coordinates : d3.geoCentroid(feature); return projection(coordinate); } };',
  "globe controls API"
);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `// Generated from mastery/mastery.js by scripts/generate-detailed-mastery-runtime.mjs.\n${source}`, "utf8");
console.log("Generated detailed Regional Mastery runtime.");
