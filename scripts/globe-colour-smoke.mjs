import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const host = '127.0.0.1';
const port = 4174;
const baseUrl = `http://${host}:${port}`;
const serverOutput = [];
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', host, '--port', String(port), '--strictPort'],
  { stdio: ['ignore', 'pipe', 'pipe'] }
);
for (const stream of [server.stdout, server.stderr]) {
  stream.setEncoding('utf8');
  stream.on('data', chunk => serverOutput.push(chunk));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite preview exited early.\n${serverOutput.join('')}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Still starting.
    }
    await delay(200);
  }
  throw new Error(`Vite preview did not become ready.\n${serverOutput.join('')}`);
}

async function waitForFrames(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function sampleGlobe(page, options) {
  return page.evaluate(({ canvasId, stageId, rotation, zoom, landCode, oceanCoordinate }) => {
    const d3 = window.NEARER_D3;
    const canvas = document.getElementById(canvasId);
    const stage = document.getElementById(stageId);
    const feature = window.NEARER_COUNTRIES_GEOJSON?.features?.find(item => item.properties.code === landCode);
    if (!d3 || !canvas || !stage || !feature) return null;

    const rect = stage.getBoundingClientRect();
    const ratioX = canvas.width / Math.max(1, rect.width);
    const ratioY = canvas.height / Math.max(1, rect.height);
    const projection = d3.geoOrthographic()
      .clipAngle(90)
      .translate([rect.width / 2, rect.height / 2])
      .scale(Math.min(rect.width, rect.height) * .425 * zoom)
      .rotate(rotation)
      .precision(.38);
    const landCoordinate = feature.geometry.type === 'Point' ? feature.geometry.coordinates : d3.geoCentroid(feature);
    const context = canvas.getContext('2d');

    function luminanceAt(coordinate) {
      const point = projection(coordinate);
      if (!point) return null;
      const x = Math.round(point[0] * ratioX);
      const y = Math.round(point[1] * ratioY);
      const left = Math.max(0, Math.min(canvas.width - 5, x - 2));
      const top = Math.max(0, Math.min(canvas.height - 5, y - 2));
      const pixels = context.getImageData(left, top, 5, 5).data;
      let total = 0;
      let count = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] < 100) continue;
        total += .2126 * pixels[index] + .7152 * pixels[index + 1] + .0722 * pixels[index + 2];
        count += 1;
      }
      return count ? total / count : null;
    }

    return {
      land: luminanceAt(landCoordinate),
      ocean: luminanceAt(oceanCoordinate),
      landCoordinate,
      oceanCoordinate
    };
  }, options);
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/mastery/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.classList.contains('nearer-runtime-ready') && window.__NEARER_MASTERY_STARTED);
  await page.waitForSelector('#regionGrid [data-region="europe"]');
  await page.locator('#regionGrid [data-region="europe"]').click();
  await page.waitForFunction(() => !document.getElementById('masterySession')?.classList.contains('is-hidden'));
  await waitForFrames(page);
  const mastery = await sampleGlobe(page, {
    canvasId: 'masteryGlobeCanvas',
    stageId: 'masteryGlobeStage',
    rotation: [-14, -52, 0],
    zoom: 1.65,
    landCode: 'AUT',
    oceanCoordinate: [-30, 40]
  });
  assert(mastery && Number.isFinite(mastery.land) && Number.isFinite(mastery.ocean), 'Mastery globe colour samples were unavailable.');
  assert(mastery.land > mastery.ocean + 35, `Mastery land/ocean colours are inverted or washed out: land ${mastery.land.toFixed(1)}, ocean ${mastery.ocean.toFixed(1)}.`);
  assert(mastery.ocean < 145, `Mastery ocean is too bright: ${mastery.ocean.toFixed(1)}.`);

  await page.goto(`${baseUrl}/atlas/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.classList.contains('nearer-runtime-ready') && window.__NEARER_ATLAS_STARTED);
  await waitForFrames(page);
  const atlas = await sampleGlobe(page, {
    canvasId: 'atlasGlobeCanvas',
    stageId: 'atlasGlobeStage',
    rotation: [-12, -13, 0],
    zoom: 1,
    landCode: 'NGA',
    oceanCoordinate: [-30, 0]
  });
  assert(atlas && Number.isFinite(atlas.land) && Number.isFinite(atlas.ocean), 'Atlas globe colour samples were unavailable.');
  assert(atlas.land > atlas.ocean + 35, `Atlas land/ocean colours are inverted or washed out: land ${atlas.land.toFixed(1)}, ocean ${atlas.ocean.toFixed(1)}.`);
  assert(atlas.ocean < 145, `Atlas ocean is too bright: ${atlas.ocean.toFixed(1)}.`);

  await context.close();
  console.log(`Globe colour smoke passed. Mastery land/ocean ${mastery.land.toFixed(1)}/${mastery.ocean.toFixed(1)}; Atlas ${atlas.land.toFixed(1)}/${atlas.ocean.toFixed(1)}.`);
} finally {
  await browser?.close();
  if (server.exitCode === null) server.kill('SIGTERM');
}
