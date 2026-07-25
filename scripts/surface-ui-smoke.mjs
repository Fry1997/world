import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const host = "127.0.0.1";
const port = 4174;
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

async function waitForRuntime(page, flag = null) {
  await page.waitForFunction(
    runtimeFlag => document.documentElement.classList.contains("nearer-runtime-ready") && (!runtimeFlag || Boolean(window[runtimeFlag])),
    flag,
    { timeout: 35_000 }
  );
}

async function assertTextTone(page, label, checks) {
  const results = await page.evaluate(entries => {
    const parse = value => {
      const match = String(value).match(/rgba?\(([^)]+)\)/i);
      if (!match) return null;
      const numbers = match[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      if (numbers.length < 3 || numbers.slice(0, 3).some(value => !Number.isFinite(value))) return null;
      return { r: numbers[0], g: numbers[1], b: numbers[2], a: Number.isFinite(numbers[3]) ? numbers[3] : 1 };
    };
    const channel = value => {
      const normalised = value / 255;
      return normalised <= 0.04045 ? normalised / 12.92 : ((normalised + 0.055) / 1.055) ** 2.4;
    };
    const luminance = colour => 0.2126 * channel(colour.r) + 0.7152 * channel(colour.g) + 0.0722 * channel(colour.b);

    return entries.map(entry => {
      const element = document.querySelector(entry.selector);
      if (!element) return { ...entry, missing: true };
      const style = getComputedStyle(element);
      const colour = parse(style.color);
      return {
        ...entry,
        missing: false,
        colour: style.color,
        opacity: Number(style.opacity),
        luminance: colour ? luminance(colour) : null
      };
    });
  }, checks);

  const failures = results.filter(result => {
    if (result.missing || result.luminance === null || result.opacity < 0.7) return true;
    return result.tone === "light" ? result.luminance < 0.55 : result.luminance > 0.32;
  });
  assert(
    failures.length === 0,
    `${label}: incorrect foreground tone detected:\n${failures.map(result => {
      if (result.missing) return `  - ${result.selector}: element missing`;
      return `  - ${result.selector}: ${result.colour}, luminance ${result.luminance?.toFixed(3)}, opacity ${result.opacity}; expected ${result.tone} text`;
    }).join("\n")}`
  );
}

async function assertMobileScoreboardFits(page) {
  const result = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const cards = Array.from(document.querySelectorAll(".mode-scoreboard .mode-player-card")).map(card => {
      const rect = card.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    });
    return {
      viewport,
      scrollWidth: document.documentElement.scrollWidth,
      cards
    };
  });
  assert(result.cards.length >= 2, "Cooperative Relay: player scoreboard did not render.");
  assert(result.scrollWidth <= result.viewport + 2, `Cooperative Relay: page overflows horizontally (${result.scrollWidth}px in ${result.viewport}px viewport).`);
  for (const [index, card] of result.cards.entries()) {
    assert(card.left >= -1 && card.right <= result.viewport + 1, `Cooperative Relay: player card ${index + 1} is clipped outside the viewport.`);
    assert(card.width <= result.viewport + 1, `Cooperative Relay: player card ${index + 1} is wider than the viewport.`);
  }
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
  await context.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("nearer-together-theme", "dark");
    localStorage.setItem("nearer-race-theme", "dark");
    localStorage.setItem("nearer-game-v1", JSON.stringify({ theme: "dark" }));
  });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await waitForRuntime(page, "__NEARER_PREMIUM_GLOBE_V2_STARTED");
  await page.evaluate(() => {
    const dialog = document.getElementById("winDialog");
    if (dialog && !dialog.open) dialog.showModal();
  });
  await page.waitForSelector("#winDialog[open]");
  await assertTextTone(page, "Solo result dialog", [
    { selector: "#winDialog h2", tone: "dark" },
    { selector: "#winSummary", tone: "dark" },
    { selector: "#winDialog .win-stats span", tone: "dark" },
    { selector: "#winNextButton", tone: "dark" }
  ]);

  await page.goto(`${baseUrl}/together/cooperative/`, { waitUntil: "domcontentloaded" });
  await waitForRuntime(page, "__NEARER_COOPERATIVE_STARTED");
  await page.waitForFunction(() => Array.from(document.styleSheets).some(sheet => sheet.href?.includes("experience11-clarity.css")));
  await assertTextTone(page, "Cooperative setup", [
    { selector: ".mode-setup-card .mode-note", tone: "dark" },
    { selector: ".mode-setup-card label span", tone: "dark" },
    { selector: "#playerCount", tone: "dark" },
    { selector: "#startGameButton", tone: "light" }
  ]);

  await page.locator("#startGameButton").click();
  await page.waitForSelector("#passScreen:not(.is-hidden)");
  await assertTextTone(page, "Cooperative pass screen", [
    { selector: "#passTitle", tone: "dark" },
    { selector: "#passCopy", tone: "dark" },
    { selector: ".pass-standing span", tone: "light" },
    { selector: ".pass-standing strong", tone: "light" },
    { selector: "#beginTurnButton", tone: "light" }
  ]);

  await page.locator("#beginTurnButton").click();
  await page.waitForSelector("#gameView:not(.is-hidden)");
  await page.waitForSelector(".mode-scoreboard .mode-player-card");
  await assertMobileScoreboardFits(page);
  await assertTextTone(page, "Cooperative active game", [
    { selector: ".mode-player-card strong", tone: "light" },
    { selector: ".mode-player-detail", tone: "light" },
    { selector: ".mode-player-metrics > span", tone: "light" },
    { selector: ".mode-player-metrics > span b", tone: "light" },
    { selector: ".globe-toolbar #globeStatus", tone: "light" },
    { selector: ".mode-history-card h2", tone: "dark" },
    { selector: ".mode-history-card .history-header p", tone: "dark" },
    { selector: ".mode-rules-card h2", tone: "light" },
    { selector: ".mode-rules-card p:last-child", tone: "light" }
  ]);

  await context.close();
  console.log("Solo result and Together setup, pass screen, scoreboard, globe toolbar, history and rules contrast checks passed.");
} finally {
  await browser?.close();
  if (server.exitCode === null) server.kill("SIGTERM");
}
