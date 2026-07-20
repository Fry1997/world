import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const host = "127.0.0.1";
const port = 4174;
const baseUrl = `http://${host}:${port}`;
const output = [];
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--host", host, "--port", String(port), "--strictPort"], { stdio: ["ignore", "pipe", "pipe"] });
for (const stream of [server.stdout, server.stderr]) {
  stream.setEncoding("utf8");
  stream.on("data", chunk => output.push(chunk));
}

async function waitForServer() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {}
    await delay(200);
  }
  throw new Error(`Time Trial preview did not start.\n${output.join("")}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.NEARER_TIME_TRIAL && window.NEARER_GAME_DATA));
  await page.waitForSelector(".nearer-time-trial-launch");
  await page.locator("[data-time-trial-open]").click();
  await page.waitForSelector("#nearerTimeTrialDialog[open]");
  await page.locator('[data-time-trial-start="practice"]').click();
  await page.waitForSelector("[data-time-trial-globe]");
  await page.locator("#timeTrialInput").fill("France");
  await page.waitForSelector("[data-time-trial-suggestions] button");
  await page.locator("[data-time-trial-suggestions] button").first().click();
  await page.locator("[data-time-trial-form] button[type=submit]").click();
  await page.waitForFunction(() => Number(document.querySelector("[data-time-trial-guesses]")?.textContent || 0) > 0);
  await page.locator("[data-time-trial-end]").click();
  await page.waitForSelector(".nearer-time-trial-results");
  assert(errors.length === 0, `Time Trial browser errors were raised:\n${errors.join("\n")}`);
  await context.close();
  console.log("Daily Time Trial browser smoke test passed.");
} finally {
  await browser?.close();
  if (server.exitCode === null) server.kill("SIGTERM");
}
