import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const host = "127.0.0.1";
const port = 4173;
const baseUrl = `http://${host}:${port}`;
const serverOutput = [];
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "preview", "--host", host, "--port", String(port), "--strictPort"],
  { stdio: ["ignore", "pipe", "pipe"] }
);
for (const stream of [server.stdout, server.stderr]) {
  stream.setEncoding("utf8");
  stream.on("data", chunk => serverOutput.push(chunk));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite preview exited early.\n${serverOutput.join("")}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Still starting.
    }
    await delay(200);
  }
  throw new Error(`Vite preview did not become ready.\n${serverOutput.join("")}`);
}

async function waitForRuntime(page, flag = null, timeout = 35_000) {
  await page.waitForFunction(
    runtimeFlag => document.documentElement.classList.contains("nearer-runtime-ready") && (!runtimeFlag || Boolean(window[runtimeFlag])),
    flag,
    { timeout }
  );
}

async function assertDetailedGeometry(page, label, precision = false) {
  const detail = await page.evaluate(() => {
    const critical = ["VAT", "MCO", "SMR", "LIE", "AND", "LUX"];
    const features = new Map((window.NEARER_COUNTRIES_GEOJSON?.features || []).map(feature => [feature.properties.code, feature]));
    return {
      source: String(window.__NEARER_DETAILED_GEOMETRY?.source || ""),
      detailedCount: Number(window.__NEARER_DETAILED_GEOMETRY?.detailedCount || 0),
      unresolved: window.__NEARER_DETAILED_GEOMETRY?.unresolvedMicrostates || [],
      criticalTypes: Object.fromEntries(critical.map(code => [code, features.get(code)?.geometry?.type || null]))
    };
  });
  assert(detail.source.includes(precision ? "1:10m" : "1:50m"), `${label}: the expected country geometry did not load.`);
  assert(detail.detailedCount > 150, `${label}: detailed country geometry did not load.`);
  if (!precision) return;
  assert(detail.unresolved.length === 0, `${label}: critical microstates still use point fallbacks: ${detail.unresolved.join(", ")}.`);
  for (const [code, type] of Object.entries(detail.criticalTypes)) {
    assert(type && type !== "Point", `${label}: ${code} is not represented by a real polygon.`);
  }
}

async function exerciseAccount(page) {
  await page.locator("#nearerAccountButton").click();
  await page.waitForSelector("#nearerAccountDialog[open]");
  await page.waitForFunction(() => {
    const message = document.querySelector("#nearerAccountDialog [data-auth-message]");
    return Boolean(message && !message.textContent.includes("Loading your account"));
  }, null, { timeout: 15_000 });
  await page.locator("[data-account-close]").click();
}

async function exerciseSolo(page, label, mobile) {
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await waitForRuntime(page, "__NEARER_PREMIUM_GLOBE_V2_STARTED");
  await page.waitForSelector("#globeCanvas", { state: "attached" });
  await page.waitForSelector("#nearerAccountButton", { state: "attached" });
  await assertDetailedGeometry(page, label);

  if (mobile) {
    const dock = page.locator(".platform-mobile-dock [data-platform-section]");
    await page.waitForSelector(".platform-mobile-dock", { state: "visible" });
    assert(await dock.count() === 5, `${label}: the mobile dock does not contain all five sections.`);
    await page.locator('.platform-mobile-dock [data-platform-section="random"]').click();
  } else {
    await page.waitForSelector(".platform-tabs", { state: "visible" });
    assert(await page.locator('.platform-tabs [data-platform-section="atlas"]').isVisible(), `${label}: Atlas is missing from primary navigation.`);
    await page.locator('.platform-tabs [data-mode="random"]').click();
  }

  await page.waitForFunction(() => document.querySelector('.platform-tabs [data-mode="random"]')?.classList.contains("is-active"));
  await page.locator("#countryInput").fill("France");
  await page.waitForSelector('#suggestions [role="option"], #suggestions > *');
  await page.locator('#suggestions [role="option"], #suggestions > *').first().click();
  if (Number(await page.locator("#guessCount").textContent()) === 0) await page.locator("#guessButton").click();
  await page.waitForFunction(() => Number(document.getElementById("guessCount")?.textContent || 0) > 0);
  await exerciseAccount(page);
}

async function exerciseMastery(page, label) {
  await page.goto(`${baseUrl}/mastery/`, { waitUntil: "domcontentloaded" });
  await waitForRuntime(page, "__NEARER_MASTERY_STARTED");
  await assertDetailedGeometry(page, label, true);
  await page.waitForSelector("#regionGrid [data-region]");
  await page.locator("#regionGrid [data-region]").first().click();
  await page.waitForFunction(() => !document.getElementById("masterySession")?.classList.contains("is-hidden"));
  await page.waitForSelector("#masteryGlobeCanvas", { state: "attached" });
  assert(Boolean(await page.evaluate(() => localStorage.getItem("nearer-mastery-session-v1"))), `${label}: Mastery did not save its session.`);

  const microstateView = await page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const feature = window.NEARER_COUNTRIES_GEOJSON.features.find(item => item.properties.code === "VAT");
    const markers = window.NEARER_MASTERY_GLOBE.getMicrostateMarkers();
    const vatican = markers.find(marker => marker.code === "VAT") || null;
    const sanMarino = markers.find(marker => marker.code === "SMR") || null;
    return {
      type: feature?.geometry?.type || null,
      markerCount: markers.length,
      vatican,
      sanMarino
    };
  });
  assert(microstateView.type !== "Point", `${label}: Vatican City remains a point in Mastery.`);
  assert(microstateView.markerCount >= 5, `${label}: Mastery did not expose the region's tiny places as neutral markers.`);
  assert(microstateView.vatican && microstateView.sanMarino, `${label}: Vatican City or San Marino is missing from the marker layer.`);
  assert(microstateView.vatican.hitRadius >= 14, `${label}: the Vatican City marker does not have an accessible touch target.`);
  assert(
    Math.hypot(
      microstateView.vatican.point[0] - microstateView.sanMarino.point[0],
      microstateView.vatican.point[1] - microstateView.sanMarino.point[1]
    ) >= 20,
    `${label}: nearby microstate markers still overlap.`
  );

  const revealView = await page.evaluate(async () => {
    window.NEARER_MASTERY_GLOBE.focusCountry("VAT");
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {
      zoom: window.NEARER_MASTERY_GLOBE.getZoom(),
      point: window.NEARER_MASTERY_GLOBE.projectCountry("VAT")
    };
  });
  assert(revealView.zoom >= 12 && revealView.zoom <= 24, `${label}: Mastery reveal zoom is not a usable local view.`);
  assert(Array.isArray(revealView.point) && revealView.point.every(Number.isFinite), `${label}: Vatican City could not be projected for reveal feedback.`);

  await page.locator("#exitSessionButton").click();
}

async function exerciseAtlas(page, label, mobile) {
  await page.goto(`${baseUrl}/atlas/`, { waitUntil: "domcontentloaded" });
  await waitForRuntime(page, "__NEARER_ATLAS_STARTED");
  await assertDetailedGeometry(page, label, true);
  await page.waitForSelector("#atlasGlobeCanvas", { state: "attached" });
  await page.waitForSelector('.platform-mobile-dock [data-platform-section="atlas"]', { state: "attached" });

  if (mobile) {
    const atlasDock = page.locator('.platform-mobile-dock [data-platform-section="atlas"]');
    assert(await atlasDock.isVisible(), `${label}: Atlas is not visible in the mobile dock.`);
    assert(await atlasDock.evaluate(node => node.classList.contains("is-active")), `${label}: Atlas is not active in the mobile dock.`);
  } else {
    assert(await page.locator('.platform-tabs [data-platform-section="atlas"]').isVisible(), `${label}: Atlas is not visible in desktop navigation.`);
  }

  await page.locator("#atlasSearch").fill("Luxembourg");
  await page.waitForSelector('#atlasSuggestions [data-atlas-country="LUX"]');
  await page.locator('#atlasSuggestions [data-atlas-country="LUX"]').click();
  await page.waitForFunction(() => document.getElementById("atlasCountryCode")?.textContent === "LUX");
  assert(!await page.locator("#atlasProfileContent").evaluate(node => node.classList.contains("is-hidden")), `${label}: Luxembourg profile did not open.`);
  await page.locator("#atlasFavouriteButton").click();
  assert(await page.locator("#atlasFavouriteButton").getAttribute("aria-pressed") === "true", `${label}: Atlas did not save a country.`);

  await page.locator("#atlasSearch").fill("Vatican City");
  await page.waitForSelector('#atlasSuggestions [data-atlas-country="VAT"]');
  await page.locator('#atlasSuggestions [data-atlas-country="VAT"]').click();
  await page.waitForFunction(() => document.getElementById("atlasCountryCode")?.textContent === "VAT");
  await page.waitForFunction(() => Number.parseFloat(document.getElementById("atlasZoomLabel")?.textContent || "0") >= 700);

  if (!mobile) {
    const globe = await page.locator(".atlas-globe-panel").boundingBox();
    const profile = await page.locator(".atlas-profile").boundingBox();
    assert(globe && profile && profile.x > globe.x, `${label}: Atlas collapsed out of its desktop two-column layout.`);
  }
}

async function exerciseTogether(page, label) {
  await page.goto(`${baseUrl}/together/`, { waitUntil: "domcontentloaded" });
  await waitForRuntime(page);
  assert(await page.locator(".together-card").count() === 3, `${label}: Together does not expose all three modes.`);
  for (const [route, flag, name] of [
    ["race", "__NEARER_RACE_V2_STARTED", "Same Target Race"],
    ["cooperative", "__NEARER_COOPERATIVE_STARTED", "Cooperative Relay"],
    ["duel", "__NEARER_DUEL_STARTED", "Hidden Country Duel"]
  ]) {
    await page.goto(`${baseUrl}/together/${route}/`, { waitUntil: "domcontentloaded" });
    await waitForRuntime(page, flag);
    await assertDetailedGeometry(page, `${label} ${name}`);
    assert(!((await page.locator("body").textContent()) || "").includes("could not start"), `${label}: ${name} showed a failure surface.`);
  }
}

async function runSuite(browser, options) {
  const context = await browser.newContext(options.context);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await exerciseSolo(page, options.label, options.mobile);
    await exerciseMastery(page, options.label);
    await exerciseAtlas(page, options.label, options.mobile);
    await exerciseTogether(page, options.label);
    assert(errors.length === 0, `${options.label} browser errors were raised:\n${errors.join("\n")}`);
  } finally {
    await context.close();
  }
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  await runSuite(browser, {
    label: "Mobile",
    mobile: true,
    context: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  });
  await runSuite(browser, {
    label: "Desktop",
    mobile: false,
    context: { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false }
  });
  console.log("Mobile and desktop browser smoke tests passed for every Nearer route, including neutral, collision-aware microstate markers.");
} finally {
  await browser?.close();
  if (server.exitCode === null) server.kill("SIGTERM");
}
