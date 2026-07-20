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

async function waitForRuntime(page, runtimeFlag = null, timeout = 30_000) {
  await page.waitForFunction(
    flag => document.documentElement.classList.contains("nearer-runtime-ready") && (!flag || Boolean(window[flag])),
    runtimeFlag,
    { timeout }
  );
}

async function assertCoreRuntime(page, label) {
  await waitForRuntime(page);
  await page.waitForSelector("#globeCanvas", { state: "attached" });
  await page.waitForSelector("#nearerAccountButton", { state: "attached" });

  const state = await page.evaluate(() => ({
    platform: Boolean(window.__NEARER_PLATFORM_STARTED),
    cloud: Boolean(window.__NEARER_CLOUD_STARTED),
    globe: Boolean(window.__NEARER_PREMIUM_GLOBE_V2_STARTED),
    failed: document.body.textContent.includes("The globe could not start")
  }));

  assert(state.platform, `${label}: the shared platform shell did not start.`);
  assert(state.cloud, `${label}: the account and cloud layer did not start.`);
  assert(state.globe, `${label}: the adaptive globe did not start.`);
  assert(!state.failed, `${label}: the solo failure surface was shown.`);
}

async function selectAndSubmitGuess(page, navigationSelector) {
  await page.locator(navigationSelector).click();
  await page.waitForFunction(() => document.querySelector('.platform-tabs [data-mode="random"]')?.classList.contains("is-active"));
  await page.locator("#countryInput").fill("France");
  await page.waitForFunction(() => {
    const suggestions = document.getElementById("suggestions");
    return Boolean(suggestions && !suggestions.classList.contains("is-hidden") && suggestions.children.length);
  });

  const suggestion = page.locator('#suggestions [role="option"], #suggestions > *').first();
  await suggestion.click();
  if (Number(await page.locator("#guessCount").textContent()) === 0) {
    await page.locator("#guessButton").click();
  }
  await page.waitForFunction(() => Number(document.getElementById("guessCount")?.textContent || 0) > 0);
  return Number(await page.locator("#guessCount").textContent());
}

async function exerciseAccountDialog(page) {
  await page.locator("#nearerAccountButton").click();
  await page.waitForSelector("#nearerAccountDialog[open]");
  await page.locator("[data-account-close]").click();
  await page.waitForFunction(() => !document.getElementById("nearerAccountDialog")?.hasAttribute("open"));
}

async function exerciseMastery(page, label) {
  await page.goto(`${baseUrl}/mastery/`, { waitUntil: "domcontentloaded" });
  await waitForRuntime(page, "__NEARER_MASTERY_STARTED");
  await page.waitForSelector("#regionGrid [data-region]");
  await page.waitForSelector(".platform-mobile-dock");
  await page.locator("#regionGrid [data-region]").first().click();
  await page.waitForFunction(() => !document.getElementById("masterySession")?.classList.contains("is-hidden"));
  await page.waitForSelector("#masteryGlobeCanvas", { state: "attached" });
  assert(
    Boolean(await page.evaluate(() => localStorage.getItem("nearer-mastery-session-v1"))),
    `${label}: Regional Mastery did not save its active session.`
  );
  await page.locator("#exitSessionButton").click();
  await page.waitForFunction(() => !document.getElementById("masteryDashboard")?.classList.contains("is-hidden"));
}

async function exerciseTogetherRoutes(page, label) {
  await page.goto(`${baseUrl}/together/`, { waitUntil: "domcontentloaded" });
  await waitForRuntime(page);
  await page.waitForSelector(".platform-mobile-dock");
  assert(await page.locator(".together-card").count() === 3, `${label}: Together did not expose all three game modes.`);

  const togetherModes = [
    ["race", "__NEARER_RACE_V2_STARTED", "Same Target Race"],
    ["cooperative", "__NEARER_COOPERATIVE_STARTED", "Cooperative Relay"],
    ["duel", "__NEARER_DUEL_STARTED", "Hidden Country Duel"]
  ];

  for (const [route, flag, name] of togetherModes) {
    await page.goto(`${baseUrl}/together/${route}/`, { waitUntil: "domcontentloaded" });
    await waitForRuntime(page, flag, 35_000);
    assert(
      !((await page.locator("body").textContent()) || "").includes("could not start"),
      `${label}: ${name} showed its failure surface.`
    );
  }
}

async function runMobileSuite(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await assertCoreRuntime(page, "Mobile");

    const savedGuessCount = await selectAndSubmitGuess(
      page,
      '.platform-mobile-dock [data-platform-section="random"]'
    );
    await exerciseAccountDialog(page);

    await page.reload({ waitUntil: "domcontentloaded" });
    await assertCoreRuntime(page, "Mobile reload");
    await page.waitForFunction(
      expected => Number(document.getElementById("guessCount")?.textContent || 0) >= expected,
      savedGuessCount
    );

    await exerciseMastery(page, "Mobile");
    await exerciseTogetherRoutes(page, "Mobile");
    assert(pageErrors.length === 0, `Mobile browser errors were raised:\n${pageErrors.join("\n")}`);
  } finally {
    await context.close();
  }
}

async function runDesktopSuite(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await assertCoreRuntime(page, "Desktop");
    assert(await page.locator(".platform-tabs").isVisible(), "Desktop: the primary navigation is not visible.");
    assert(await page.locator('.platform-tabs [data-mode="random"]').isVisible(), "Desktop: Random is not available in the primary navigation.");

    const playBox = await page.locator(".play-column").boundingBox();
    const resultsBox = await page.locator(".results-column").boundingBox();
    assert(playBox && resultsBox && resultsBox.x > playBox.x, "Desktop: the game columns collapsed into a mobile layout.");

    await selectAndSubmitGuess(page, '.platform-tabs [data-mode="random"]');
    await exerciseAccountDialog(page);

    await page.goto(`${baseUrl}/mastery/`, { waitUntil: "domcontentloaded" });
    await waitForRuntime(page, "__NEARER_MASTERY_STARTED");
    await page.waitForSelector("#regionGrid [data-region]");
    const firstRegion = await page.locator("#regionGrid [data-region]").nth(0).boundingBox();
    const secondRegion = await page.locator("#regionGrid [data-region]").nth(1).boundingBox();
    assert(
      firstRegion && secondRegion && secondRegion.x > firstRegion.x && Math.abs(secondRegion.y - firstRegion.y) < 10,
      "Desktop: the Regional Mastery cards collapsed into a single column."
    );
    await page.locator("#regionGrid [data-region]").first().click();
    await page.waitForFunction(() => !document.getElementById("masterySession")?.classList.contains("is-hidden"));
    await page.waitForSelector("#masteryGlobeCanvas", { state: "attached" });
    await page.locator("#exitSessionButton").click();
    await page.waitForFunction(() => !document.getElementById("masteryDashboard")?.classList.contains("is-hidden"));

    await page.goto(`${baseUrl}/together/`, { waitUntil: "domcontentloaded" });
    await waitForRuntime(page);
    const cards = page.locator(".together-card");
    assert(await cards.count() === 3, "Desktop: Together did not expose all three game modes.");
    const firstCard = await cards.nth(0).boundingBox();
    const secondCard = await cards.nth(1).boundingBox();
    const thirdCard = await cards.nth(2).boundingBox();
    assert(
      firstCard && secondCard && thirdCard
        && secondCard.x > firstCard.x
        && thirdCard.x > secondCard.x
        && Math.abs(secondCard.y - firstCard.y) < 10
        && Math.abs(thirdCard.y - firstCard.y) < 10,
      "Desktop: the Together cards are not presented as a three-column grid."
    );

    const togetherModes = [
      ["race", "__NEARER_RACE_V2_STARTED", "Same Target Race"],
      ["cooperative", "__NEARER_COOPERATIVE_STARTED", "Cooperative Relay"],
      ["duel", "__NEARER_DUEL_STARTED", "Hidden Country Duel"]
    ];
    for (const [route, flag, name] of togetherModes) {
      await page.goto(`${baseUrl}/together/${route}/`, { waitUntil: "domcontentloaded" });
      await waitForRuntime(page, flag, 35_000);
      assert(
        !((await page.locator("body").textContent()) || "").includes("could not start"),
        `Desktop: ${name} showed its failure surface.`
      );
    }

    assert(pageErrors.length === 0, `Desktop browser errors were raised:\n${pageErrors.join("\n")}`);
  } finally {
    await context.close();
  }
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  await runMobileSuite(browser);
  await runDesktopSuite(browser);
  console.log("Mobile and desktop browser smoke tests passed for every Nearer route.");
} finally {
  await browser?.close();
  if (server.exitCode === null) server.kill("SIGTERM");
}
