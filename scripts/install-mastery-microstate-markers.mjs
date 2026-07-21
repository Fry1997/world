import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const runtimePath = resolve(process.cwd(), 'src/generated/mastery-runtime.js');
let source = await readFile(runtimePath, 'utf8');

function replaceRequired(search, replacement, label) {
  const first = source.indexOf(search);
  const last = source.lastIndexOf(search);
  if (first < 0) throw new Error(`Could not install ${label} in ${basename(runtimePath)}.`);
  if (first !== last) throw new Error(`Could not install ${label}: the runtime pattern was not unique.`);
  source = `${source.slice(0, first)}${replacement}${source.slice(first + search.length)}`;
}

replaceRequired(
  'let rotation = [...initialRotation], zoom = 1, queued = false, interaction = null, activeRegion = regions[0], pointers = new Map(), width = 0, height = 0, ratio = 1;',
  'let rotation = [...initialRotation], zoom = 1, queued = false, interaction = null, activeRegion = regions[0], pointers = new Map(), width = 0, height = 0, ratio = 1, microstateMarkers = [];',
  'microstate marker state'
);

const featureNearView = 'function featureNearView(feature) { if (zoom < 4) return true; const centre = [-rotation[0], -rotation[1]]; const latitudePadding = Math.max(.08, 150 / zoom); const longitudePadding = latitudePadding / Math.max(.2, Math.cos(centre[1] * Math.PI / 180)); const bounds = polygonBounds.get(feature.properties.code); return Boolean(bounds && centre[1] >= bounds[0][1] - latitudePadding && centre[1] <= bounds[1][1] + latitudePadding && longitudeNear(centre[0], bounds[0][0], bounds[1][0], longitudePadding)); }';
const markerRuntime = `${featureNearView}
  const MICROSTATE_MARKER_SIZE = 18;
  const MICROSTATE_MARKER_AREA = 6000;
  const MICROSTATE_MARKER_HIT_RADIUS = 16;
  const MICROSTATE_MARKER_SEPARATION = 24;
  const MICROSTATE_MARKER_OFFSETS = [[0,0],[0,-24],[24,0],[0,24],[-24,0],[18,-18],[18,18],[-18,18],[-18,-18],[0,-34],[34,0],[0,34],[-34,0],[26,-26],[26,26],[-26,26],[-26,-26]];
  function microstateCoordinate(feature) { return feature.geometry.type === "Point" ? feature.geometry.coordinates : d3.geoCentroid(feature); }
  function shouldUseMicrostateMarker(feature) { if (feature.geometry.type === "Point") return true; const bounds = path.bounds(feature); const projectedWidth = Math.abs(bounds[1][0] - bounds[0][0]); const projectedHeight = Math.abs(bounds[1][1] - bounds[0][1]); const projectedArea = projectedWidth * projectedHeight; const area = Number(countryByCode.get(feature.properties.code)?.area) || 0; return projectedWidth < MICROSTATE_MARKER_SIZE && projectedHeight < MICROSTATE_MARKER_SIZE && (area <= MICROSTATE_MARKER_AREA || projectedArea < 90); }
  function markerOffsetsFor(code) { let hash = 0; for (const character of code) hash = (hash * 31 + character.charCodeAt(0)) >>> 0; const fixed = MICROSTATE_MARKER_OFFSETS[0]; const movable = MICROSTATE_MARKER_OFFSETS.slice(1); const shift = movable.length ? hash % movable.length : 0; return [fixed, ...movable.slice(shift), ...movable.slice(0, shift)]; }
  function clampMarkerPoint(point) { const maximumX = Math.max(12, width - 66); const maximumY = Math.max(12, height - 62); return [Math.max(12, Math.min(maximumX, point[0])), Math.max(12, Math.min(maximumY, point[1]))]; }
  function markerPositionAvailable(point, placed) { return placed.every(marker => Math.hypot(marker.point[0] - point[0], marker.point[1] - point[1]) >= MICROSTATE_MARKER_SEPARATION); }
  function buildMicrostateMarkers(regionCodes) { const candidates = [...regionCodes].map(code => ({ code, feature: featureByCode.get(code) })).filter(item => item.feature).map(item => ({ ...item, coordinate: microstateCoordinate(item.feature) })).filter(item => item.coordinate && visible(item.coordinate)).map(item => ({ ...item, anchor: projection(item.coordinate) })).filter(item => item.anchor && shouldUseMicrostateMarker(item.feature)).sort((a,b) => a.code.localeCompare(b.code)); const placed = []; for (const candidate of candidates) { let point = null; for (const offset of markerOffsetsFor(candidate.code)) { const proposed = clampMarkerPoint([candidate.anchor[0] + offset[0], candidate.anchor[1] + offset[1]]); if (markerPositionAvailable(proposed, placed)) { point = proposed; break; } } if (!point) { for (let index = 0; index < 28 && !point; index += 1) { const angle = index * Math.PI * (3 - Math.sqrt(5)); const distance = 42 + Math.floor(index / 8) * 12; const proposed = clampMarkerPoint([candidate.anchor[0] + Math.cos(angle) * distance, candidate.anchor[1] + Math.sin(angle) * distance]); if (markerPositionAvailable(proposed, placed)) point = proposed; } } point ||= clampMarkerPoint(candidate.anchor); placed.push({ code: candidate.code, anchor: candidate.anchor, point, hitRadius: MICROSTATE_MARKER_HIT_RADIUS, displaced: Math.hypot(point[0] - candidate.anchor[0], point[1] - candidate.anchor[1]) > 2 }); } return placed; }
  function microstateMarkerStyle(code) { if ((session?.completed || []).includes(code)) return { fill: "#4c9e7f", stroke: "#f4faf5", glow: "rgba(76,158,127,.36)" }; if (flashCode === code) return flashCode === session?.current ? { fill: "#55c996", stroke: "#fff5eb", glow: "rgba(85,201,150,.46)" } : { fill: "#d96751", stroke: "#fff5eb", glow: "rgba(217,103,81,.42)" }; if (revealCode === code) return { fill: "#e7ad4f", stroke: "#fff6dc", glow: "rgba(231,173,79,.46)" }; return { fill: "#071722", stroke: "rgba(255,247,238,.92)", glow: null }; }
  function drawMicrostateMarker(marker) { const style = microstateMarkerStyle(marker.code); const feature = featureByCode.get(marker.code); context.save(); context.lineCap = "round"; if (marker.displaced) { context.beginPath(); context.moveTo(marker.anchor[0], marker.anchor[1]); context.lineTo(marker.point[0], marker.point[1]); context.strokeStyle = "rgba(232,239,242,.58)"; context.lineWidth = 1.05; context.stroke(); context.beginPath(); context.arc(marker.anchor[0], marker.anchor[1], 1.8, 0, Math.PI * 2); context.fillStyle = "rgba(245,242,234,.86)"; context.fill(); } if (style.glow) { context.beginPath(); context.arc(marker.point[0], marker.point[1], 9, 0, Math.PI * 2); context.fillStyle = style.glow; context.fill(); } context.beginPath(); context.arc(marker.point[0], marker.point[1], 6.7, 0, Math.PI * 2); context.strokeStyle = "rgba(4,15,23,.68)"; context.lineWidth = 3.6; context.stroke(); context.beginPath(); context.arc(marker.point[0], marker.point[1], 4.7, 0, Math.PI * 2); context.fillStyle = style.fill; context.fill(); context.strokeStyle = style.stroke; context.lineWidth = 1.8; context.stroke(); context.restore(); if ((flashCode === marker.code || revealCode === marker.code) && feature?.geometry.type !== "Point") drawFeature(feature,null,style.stroke,2.6,.98); }`;
replaceRequired(featureNearView, markerRuntime, 'microstate marker layout and rendering');

replaceRequired(
  'for (const feature of pointFeatures) { const code = feature.properties.code; if ((session?.completed || []).includes(code)) drawPoint(feature,"#4c9e7f","#fff6ed",4.6); else if (flashCode === code) drawPoint(feature,code === session?.current ? "#55c996" : "#d96751","#fff6ed",6); else if (revealCode === code) drawPoint(feature,"#e7ad4f","#fff6ed",6); }',
  'microstateMarkers = buildMicrostateMarkers(regionCodes); for (const marker of microstateMarkers) drawMicrostateMarker(marker);',
  'microstate marker draw pass'
);

replaceRequired(
  'function hitCountry(clientX, clientY) { const rect = elements.stage.getBoundingClientRect(); const point = [clientX - rect.left, clientY - rect.top]; const translate = projection.translate(); const radiusValue = projection.scale(); if (Math.hypot(point[0]-translate[0],point[1]-translate[1]) > radiusValue) return null; for (const feature of pointFeatures) { const projected = projection(feature.geometry.coordinates); if (projected && visible(feature.geometry.coordinates) && Math.hypot(projected[0]-point[0],projected[1]-point[1]) <= 17) return feature.properties.code; } const coordinate = projection.invert(point); if (!coordinate) return null; const feature = polygonFeatures.find(item => d3.geoContains(item, coordinate)); return feature?.properties.code || null; }',
  'function hitCountry(clientX, clientY) { const rect = elements.stage.getBoundingClientRect(); const point = [clientX - rect.left, clientY - rect.top]; const translate = projection.translate(); const radiusValue = projection.scale(); if (Math.hypot(point[0]-translate[0],point[1]-translate[1]) > radiusValue) return null; let nearestMarker = null, nearestDistance = Infinity; for (const marker of microstateMarkers) { const distance = Math.hypot(marker.point[0]-point[0],marker.point[1]-point[1]); if (distance <= marker.hitRadius && distance < nearestDistance) { nearestMarker = marker; nearestDistance = distance; } } if (nearestMarker) return nearestMarker.code; const coordinate = projection.invert(point); if (!coordinate) return null; const feature = polygonFeatures.find(item => d3.geoContains(item, coordinate)); return feature?.properties.code || null; }',
  'microstate marker hit testing'
);

replaceRequired(
  'function focusCountry(code) { const feature = featureByCode.get(code); if (!feature) return; const coordinate = feature.geometry.type === "Point" ? feature.geometry.coordinates : d3.geoCentroid(feature); const area = Number(countryByCode.get(code)?.area) || 0; const targetZoom = feature.geometry.type === "Point" || area <= 1 ? 720 : area <= 10 ? 520 : area <= 100 ? 260 : area <= 500 ? 120 : area <= 3000 ? 48 : area <= 10000 ? 24 : area <= 100000 ? 8 : 2.2; rotation = [-coordinate[0], -coordinate[1], 0]; zoom = Math.max(zoom, targetZoom); queueRender(); }',
  'function focusCountry(code) { const feature = featureByCode.get(code); if (!feature) return; const coordinate = feature.geometry.type === "Point" ? feature.geometry.coordinates : d3.geoCentroid(feature); const area = Number(countryByCode.get(code)?.area) || 0; const targetZoom = feature.geometry.type === "Point" || area <= 100 ? 18 : area <= 500 ? 12 : area <= 3000 ? 8 : area <= 10000 ? 5 : area <= 100000 ? 3.2 : 2.2; rotation = [-coordinate[0], -coordinate[1], 0]; zoom = Math.max(zoom, targetZoom); queueRender(); }',
  'sensible Mastery reveal zoom'
);

replaceRequired(
  'const globe = { queueRender, setRegion, focusCountry }; window.NEARER_MASTERY_GLOBE = { zoomIn: () => changeZoom(1), zoomOut: () => changeZoom(-1), reset: () => elements.reset.click(), focusCountry, getZoom: () => zoom, projectCountry: code => { const feature = featureByCode.get(code); if (!feature) return null; const coordinate = feature.geometry.type === "Point" ? feature.geometry.coordinates : d3.geoCentroid(feature); return projection(coordinate); } };',
  'const globe = { queueRender, setRegion, focusCountry }; window.NEARER_MASTERY_GLOBE = { zoomIn: () => changeZoom(1), zoomOut: () => changeZoom(-1), reset: () => elements.reset.click(), focusCountry, getZoom: () => zoom, getMicrostateMarkers: () => microstateMarkers.map(marker => ({ code: marker.code, anchor: [...marker.anchor], point: [...marker.point], hitRadius: marker.hitRadius, displaced: marker.displaced })), projectCountry: code => { const feature = featureByCode.get(code); if (!feature) return null; const coordinate = feature.geometry.type === "Point" ? feature.geometry.coordinates : d3.geoCentroid(feature); return projection(coordinate); } };',
  'microstate marker test API'
);

if (!source.includes('getMicrostateMarkers') || !source.includes('buildMicrostateMarkers')) {
  throw new Error(`Microstate marker support was not installed in ${basename(runtimePath)}.`);
}

await writeFile(runtimePath, source, 'utf8');
console.log('Installed neutral, collision-aware Mastery microstate markers.');
