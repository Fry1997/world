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

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Vite preview exited early.\n${serverOutput.join("")}`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await delay(200);
  }
  throw new Error(`Vite preview did not become ready.\n${serverOutput.join("")}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.documentElement.classList.contains("nearer-runtime-ready"), null, { timeout: 25_000 });
  await page.waitForSelector("#globeCanvas", { state: "attached" });
  await page.waitForSelector("#nearerAccountButton", { state: "attached" });

  const initialState = await page.evaluate(() => ({
    platform: Boolean(window.__NEARER_PLATFORM_STARTED),
    cloud: Boolean(window.__NEARER_CLOUD_STARTED),
    globe: Boolean(window.__NEARER_PREMIUM_GLOBE_V2_STARTED),
    failed: document.body.textContent.includes("The globe could not start")
  }));
  assert(initialState.platform, "The shared platform shell did not start.");
  assert(initialState.cloud, "The account and cloud layer did not start.");
  assert(initialState.globe, "The adaptive globe did not start.");
  assert(!initialState.failed, "The solo failure surface was shown.");

  await page.locator('.platform-tabs [data-mode="random"]').click();
  await page.waitForFunction(() => document.querySelector('.platform-tabs [data-mode="random"]')?.classList.contains("is-active"));
  await page.locator("#countryInput").fill("France");
  await page.waitForFunction(() => {
    const suggestions = document.getElementById("suggestions");
    return Boolean(suggestions && !suggestions.classList.contains("is-hidden") && suggestions.children.length);
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.documentElement.classList.contains("nearer-runtime-ready"), null, { timeout: 25_000 });
  assert(await page.locator("#globeCanvas").count(), "The globe did not recover after a reload.");

  await page.goto(`${baseUrl}/mastery/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#masteryDashboard");
  await page.waitForSelector(".platform-mobile-dock");

  await page.goto(`${baseUrl}/together/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".platform-mobile-dock");
  assert(await page.locator(".together-card").count() === 3, "Together did not expose all three game modes.");

  assert(pageErrors.length === 0, `Browser errors were raised:\n${pageErrors.join("\n")}`);
  console.log("Mobile browser smoke test passed for Today, Random, Mastery and Together.");
} finally {
  await browser?.close();
  if (server.exitCode === null) server.kill("SIGTERM");
}
