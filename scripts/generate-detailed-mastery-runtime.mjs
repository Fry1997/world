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
  'function clampZoom(value) { return Math.max(.78, Math.min(18, value)); }',
  "zoom limit"
);

replaceOnce(
  'projection.translate([width / 2, height / 2]).scale(radius).rotate(rotation).precision(interaction ? .8 : .45);',
  'projection.translate([width / 2, height / 2]).scale(radius).rotate(rotation).precision(interaction ? .72 : Math.max(.08, .42 / Math.sqrt(Math.max(1, zoom))));',
  "projection precision"
);

replaceOnce(
  'for (const feature of pointFeatures) { const code = feature.properties.code; if ((session?.completed || []).includes(code)) drawPoint(feature,"#4c9e7f","#fff6ed",4.6); else if (flashCode === code) drawPoint(feature,code === session?.current ? "#55c996" : "#d96751","#fff6ed",6); else if (revealCode === code) drawPoint(feature,"#e7ad4f","#fff6ed",6); else if (regionCodes.has(code)) drawPoint(feature,"#8aa8ba","rgba(255,255,255,.76)",3.8); }',
  'for (const feature of pointFeatures) { const code = feature.properties.code; if ((session?.completed || []).includes(code)) drawPoint(feature,"#4c9e7f","#fff6ed",4.6); else if (flashCode === code) drawPoint(feature,code === session?.current ? "#55c996" : "#d96751","#fff6ed",6); else if (revealCode === code) drawPoint(feature,"#e7ad4f","#fff6ed",6); }',
  "neutral point markers"
);

replaceOnce(
  'function focusCountry(code) { const feature = featureByCode.get(code); if (!feature) return; const coordinate = feature.geometry.type === "Point" ? feature.geometry.coordinates : d3.geoCentroid(feature); rotation = [-coordinate[0], -coordinate[1], 0]; zoom = Math.max(1.4, Math.min(2.2, zoom)); queueRender(); }',
  'function focusCountry(code) { const feature = featureByCode.get(code); if (!feature) return; const coordinate = feature.geometry.type === "Point" ? feature.geometry.coordinates : d3.geoCentroid(feature); rotation = [-coordinate[0], -coordinate[1], 0]; if (feature.geometry.type === "Point") zoom = Math.max(zoom, 12); else { const bounds = d3.geoBounds(feature); const longitudeSpan = Math.abs(bounds[1][0] - bounds[0][0]); const latitudeSpan = Math.abs(bounds[1][1] - bounds[0][1]); const span = Math.max(.35, longitudeSpan, latitudeSpan); zoom = Math.max(zoom, Math.min(12, Math.max(1.8, 10 / span))); } queueRender(); }',
  "reveal focus"
);

replaceOnce(
  'elements.zoomIn.addEventListener("click",()=>{zoom=clampZoom(zoom*1.25);queueRender();}); elements.zoomOut.addEventListener("click",()=>{zoom=clampZoom(zoom/1.25);queueRender();}); elements.reset.addEventListener("click",()=>setRegion(activeRegion));',
  'elements.zoomIn.addEventListener("click",()=>{zoom=clampZoom(zoom*1.4);queueRender();}); elements.zoomOut.addEventListener("click",()=>{zoom=clampZoom(zoom/1.4);queueRender();}); elements.reset.addEventListener("click",()=>setRegion(activeRegion));',
  "zoom controls"
);

replaceOnce(
  'const globe = { queueRender, setRegion, focusCountry };',
  'const globe = { queueRender, setRegion, focusCountry }; window.NEARER_MASTERY_GLOBE = { zoomIn: () => elements.zoomIn.click(), zoomOut: () => elements.zoomOut.click(), reset: () => elements.reset.click() };',
  "globe controls API"
);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `// Generated from mastery/mastery.js by scripts/generate-detailed-mastery-runtime.mjs.\n${source}`, "utf8");
console.log("Generated detailed Regional Mastery runtime.");
