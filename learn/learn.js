(() => {
  "use strict";
  if (window.__NEARER_MASTERY_STARTED) return;

  const d3 = window.NEARER_D3;
  const gameData = window.NEARER_GAME_DATA;
  const geoData = window.NEARER_COUNTRIES_GEOJSON;
  if (!d3 || !gameData || !geoData) throw new Error("Regional Mastery requires Nearer game data.");

  const STORAGE_KEY = "nearer-mastery-v1";
  const REGION_ORDER = ["Europe", "Africa", "Asia", "North America", "South America", "Oceania"];
  const REGION_DETAILS = {
    Europe: { symbol: "EU", accent: "#ff7659", description: "Dense borders, peninsulas and microstates make Europe the ideal place to build precise map memory." },
    Africa: { symbol: "AF", accent: "#e6a84e", description: "Learn the continent's broad regional patterns, from the Mediterranean coast to the Cape." },
    Asia: { symbol: "AS", accent: "#8c78d4", description: "The largest region rewards strong anchors across west, south, central and east Asia." },
    "North America": { symbol: "NA", accent: "#5f9fca", description: "Connect the continental mainland with Central America and the island nations of the Caribbean." },
    "South America": { symbol: "SA", accent: "#4fc394", description: "A distinctive continental outline makes this a fast region to begin and satisfying to perfect." },
    Oceania: { symbol: "OC", accent: "#d76d9e", description: "Build confidence across Australia, New Zealand and the widely separated Pacific island nations." }
  };

  const countryByCode = new Map(gameData.countries.map(country => [country.code, country]));
  const featureByCode = new Map(geoData.features.map(feature => [feature.properties.code, feature]));
  const regions = new Map(REGION_ORDER.map(region => [region, gameData.countries.filter(country => country.continent === region)]));
  const totalCountries = gameData.countries.length;

  const elements = {
    dashboard: document.getElementById("dashboardView"),
    session: document.getElementById("sessionView"),
    regionGrid: document.getElementById("regionGrid"),
    overallProgress: document.getElementById("overallProgress"),
    overallRing: document.getElementById("overallProgressRing"),
    countriesPlaced: document.getElementById("countriesPlacedStat"),
    confidence: document.getElementById("confidenceStat"),
    sessions: document.getElementById("sessionsStat"),
    regions: document.getElementById("regionsStat"),
    resume: document.getElementById("resumeLearningButton"),
    review: document.getElementById("reviewWeakButton"),
    shellProgress: document.getElementById("shellProgress"),
    modeDialog: document.getElementById("modeDialog"),
    modeDialogEyebrow: document.getElementById("modeDialogEyebrow"),
    modeDialogCopy: document.getElementById("modeDialogCopy"),
    startLearn: document.getElementById("startLearnButton"),
    startTest: document.getElementById("startTestButton"),
    exit: document.getElementById("exitSessionButton"),
    sessionEyebrow: document.getElementById("sessionEyebrow"),
    sessionTitle: document.getElementById("sessionTitle"),
    sessionProgressLabel: document.getElementById("sessionProgressLabel"),
    sessionScoreLabel: document.getElementById("sessionScoreLabel"),
    mapInstruction: document.getElementById("mapInstruction"),
    map: document.getElementById("masteryMap"),
    mapWrap: document.getElementById("masteryMapWrap"),
    mapFeedback: document.getElementById("mapFeedback"),
    missionIndex: document.getElementById("missionIndex"),
    missionMode: document.getElementById("missionMode"),
    targetCountry: document.getElementById("targetCountry"),
    targetMetadata: document.getElementById("targetMetadata"),
    progressBar: document.getElementById("sessionProgressBar"),
    attemptPanel: document.getElementById("attemptPanel"),
    skip: document.getElementById("skipCountryButton"),
    reveal: document.getElementById("revealCountryButton"),
    firstTryLive: document.getElementById("firstTryLive"),
    retryLive: document.getElementById("retryLive"),
    skippedLive: document.getElementById("skippedLive"),
    revealedLive: document.getElementById("revealedLive"),
    result: document.getElementById("resultDialog"),
    resultEyebrow: document.getElementById("resultEyebrow"),
    resultTitle: document.getElementById("resultTitle"),
    resultCopy: document.getElementById("resultCopy"),
    resultScore: document.getElementById("resultScore"),
    resultFirstTry: document.getElementById("resultFirstTry"),
    resultRetry: document.getElementById("resultRetry"),
    resultSkipped: document.getElementById("resultSkipped"),
    resultRevealed: document.getElementById("resultRevealed"),
    resultAgain: document.getElementById("resultAgainButton"),
    resultDashboard: document.getElementById("resultDashboardButton"),
    loading: document.getElementById("masteryLoading"),
    toast: document.getElementById("masteryToast")
  };

  let progress = loadProgress();
  let selectedRegion = progress.lastRegion || "Europe";
  let activeSession = null;
  let feedbackTimer = 0;
  let toastTimer = 0;

  function defaultProgress() {
    return { version: 1, countries: {}, regions: {}, lastRegion: "Europe", lastMode: "learn", updatedAt: Date.now() };
  }

  function loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return saved?.version === 1 ? saved : defaultProgress();
    } catch {
      return defaultProgress();
    }
  }

  function saveProgress() {
    progress.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }

  function countryProgress(code) {
    if (!progress.countries[code]) {
      progress.countries[code] = { seen: 0, correct: 0, firstTry: 0, retries: 0, misses: 0, skipped: 0, revealed: 0, lastSeen: null };
    }
    return progress.countries[code];
  }

  function regionProgress(region) {
    if (!progress.regions[region]) {
      progress.regions[region] = { sessions: 0, bestScore: 0, lastScore: 0, lastPlayed: null, learnSessions: 0, testSessions: 0 };
    }
    return progress.regions[region];
  }

  function shuffle(values) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
  }

  function formatArea(value) {
    if (!Number.isFinite(value)) return "Area unavailable";
    if (value < 1000) return `${Math.round(value).toLocaleString()} km²`;
    return `${Math.round(value).toLocaleString()} km²`;
  }

  function formatDistance(value) {
    if (!Number.isFinite(value)) return "an unknown distance";
    if (value === 0) return "a shared border";
    return `${Math.round(value).toLocaleString()} km`;
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2300);
  }

  function showMapFeedback(title, copy) {
    clearTimeout(feedbackTimer);
    elements.mapFeedback.querySelector("strong").textContent = title;
    elements.mapFeedback.querySelector("span").textContent = copy;
    elements.mapFeedback.classList.remove("is-hidden");
    feedbackTimer = setTimeout(() => elements.mapFeedback.classList.add("is-hidden"), 2400);
  }

  function totals() {
    const values = Object.values(progress.countries);
    const placed = values.filter(item => item.correct > 0).length;
    const confident = values.filter(item => item.firstTry > 0).length;
    const sessionCount = Object.values(progress.regions).reduce((sum, item) => sum + (item.sessions || 0), 0);
    const regionCount = REGION_ORDER.filter(region => {
      const codes = regions.get(region).map(country => country.code);
      return codes.some(code => progress.countries[code]?.seen > 0);
    }).length;
    return { placed, confident, sessionCount, regionCount };
  }

  function weakness(code) {
    const item = progress.countries[code];
    if (!item) return 0;
    return (item.correct ? 0 : 10) + item.revealed * 6 + item.skipped * 4 + item.misses * 2 - item.firstTry;
  }

  function weakCountryCodes(limit = 24) {
    return gameData.countries
      .map(country => ({ code: country.code, score: weakness(country.code), seen: progress.countries[country.code]?.seen || 0 }))
      .filter(item => item.seen > 0 && item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.code);
  }

  function regionMetrics(region) {
    const countries = regions.get(region) || [];
    const placed = countries.filter(country => progress.countries[country.code]?.correct > 0).length;
    const confident = countries.filter(country => progress.countries[country.code]?.firstTry > 0).length;
    const data = progress.regions[region] || {};
    return {
      total: countries.length,
      placed,
      confident,
      percent: countries.length ? Math.round(placed / countries.length * 100) : 0,
      confidence: countries.length ? Math.round(confident / countries.length * 100) : 0,
      sessions: data.sessions || 0,
      best: data.bestScore || 0
    };
  }

  function renderDashboard() {
    const summary = totals();
    const overall = totalCountries ? Math.round(summary.placed / totalCountries * 100) : 0;
    const confidence = totalCountries ? Math.round(summary.confident / totalCountries * 100) : 0;
    elements.overallProgress.textContent = `${overall}%`;
    elements.overallRing.style.strokeDashoffset = String(452.39 * (1 - overall / 100));
    elements.countriesPlaced.textContent = summary.placed.toLocaleString();
    elements.confidence.textContent = `${confidence}%`;
    elements.sessions.textContent = summary.sessionCount.toLocaleString();
    elements.regions.textContent = summary.regionCount.toLocaleString();
    elements.shellProgress.textContent = summary.placed ? `${summary.placed} countries placed` : "Progress saved locally";

    const lastRegion = REGION_ORDER.includes(progress.lastRegion) ? progress.lastRegion : "Europe";
    const lastMetrics = regionMetrics(lastRegion);
    elements.resume.textContent = lastMetrics.placed ? `Continue ${lastRegion}` : `Start with ${lastRegion}`;
    const weak = weakCountryCodes();
    elements.review.disabled = weak.length < 3;
    elements.review.textContent = weak.length >= 3 ? `Review ${weak.length} weak spots` : "Review weak spots";

    elements.regionGrid.innerHTML = REGION_ORDER.map(region => {
      const detail = REGION_DETAILS[region];
      const metrics = regionMetrics(region);
      const state = metrics.percent === 100 ? "Mapped" : metrics.placed ? "In progress" : "Not started";
      return `
        <article class="region-card" style="--region-accent:${detail.accent}" data-region="${escapeHtml(region)}">
          <div class="region-card-top"><span class="region-symbol" aria-hidden="true">${detail.symbol}</span><span class="region-state">${state}</span></div>
          <h3>${escapeHtml(region)}</h3>
          <p class="region-description">${escapeHtml(detail.description)}</p>
          <div class="region-progress-row"><strong>${metrics.percent}%</strong><span>${metrics.placed} of ${metrics.total} placed</span></div>
          <div class="region-progress-track"><span style="width:${metrics.percent}%"></span></div>
          <div class="region-meta"><span>${metrics.confidence}% first-try confidence</span><span>${metrics.best ? `Best test ${metrics.best}%` : `${metrics.total} countries`}</span></div>
          <div class="region-actions"><button class="region-start" type="button" data-region-start="${escapeHtml(region)}">${metrics.placed ? "Continue learning" : "Start region"}</button><button class="region-test" type="button" data-region-test="${escapeHtml(region)}" aria-label="Test ${escapeHtml(region)}" title="Test region">◇</button></div>
        </article>`;
    }).join("");
  }

  function openModeDialog(region) {
    selectedRegion = region;
    const metrics = regionMetrics(region);
    elements.modeDialogEyebrow.textContent = `${region.toUpperCase()} · ${metrics.total} COUNTRIES`;
    elements.modeDialogCopy.textContent = metrics.placed
      ? `You have placed ${metrics.placed} of ${metrics.total}. Learn mode prioritises gaps and weak countries; Test mode measures every first attempt.`
      : "Learn mode allows retries, skips and reveals. Test mode records one first attempt for every country.";
    elements.modeDialog.showModal();
  }

  function orderedLearnQueue(region) {
    const countries = regions.get(region) || [];
    const ranked = countries.map(country => {
      const item = progress.countries[country.code];
      const score = item ? weakness(country.code) : 12;
      return { code: country.code, score: score + Math.random() * 2 };
    });
    return ranked.sort((a, b) => b.score - a.score).map(item => item.code);
  }

  function startSession(region, mode, customCodes = null) {
    const codes = customCodes?.length
      ? [...customCodes]
      : mode === "learn" ? orderedLearnQueue(region) : shuffle((regions.get(region) || []).map(country => country.code));
    if (!codes.length) {
      showToast("There are no countries available for this session yet.");
      return;
    }
    elements.modeDialog.close();
    progress.lastRegion = REGION_ORDER.includes(region) ? region : progress.lastRegion;
    progress.lastMode = mode;
    saveProgress();
    activeSession = {
      region,
      mode,
      review: Boolean(customCodes),
      originalTotal: codes.length,
      queue: codes,
      resolved: [],
      skippedCodes: new Set(),
      currentAttempts: 0,
      locked: false,
      stats: { firstTry: 0, retry: 0, skipped: 0, revealed: 0 },
      lastWrongCode: null,
      currentResultClass: null
    };
    elements.dashboard.classList.add("is-hidden");
    elements.session.classList.remove("is-hidden");
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    renderSessionMap();
    presentCurrentCountry();
  }

  function sessionCountries() {
    const codes = [...new Set([...(activeSession?.queue || []), ...(activeSession?.resolved || [])])];
    return codes.map(code => countryByCode.get(code)).filter(Boolean);
  }

  function renderSessionMap() {
    elements.map.innerHTML = "";
    const sessionCountryList = sessionCountries();
    const codes = new Set(sessionCountryList.map(country => country.code));
    const features = sessionCountryList.map(country => featureByCode.get(country.code)).filter(Boolean);
    const polygons = features.filter(feature => feature.geometry.type !== "Point");
    const collection = { type: "FeatureCollection", features: polygons.length ? polygons : features };
    const projectionFactory = d3.geoNaturalEarth1 || d3.geoMercator;
    const projection = projectionFactory();
    if (collection.features.length) projection.fitExtent([[38, 38], [922, 580]], collection);
    const path = d3.geoPath(projection);

    const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    background.setAttribute("width", "960");
    background.setAttribute("height", "620");
    background.setAttribute("fill", "transparent");
    elements.map.append(background);

    polygons.forEach(feature => {
      const code = feature.properties.code;
      if (!codes.has(code)) return;
      const node = document.createElementNS("http://www.w3.org/2000/svg", "path");
      node.setAttribute("d", path(feature) || "");
      node.setAttribute("class", "mastery-country");
      node.dataset.code = code;
      node.setAttribute("tabindex", "0");
      node.setAttribute("role", "button");
      node.setAttribute("aria-label", "Select this country");
      node.addEventListener("click", () => handleCountrySelection(code));
      node.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handleCountrySelection(code); }
      });
      elements.map.append(node);
    });

    features.filter(feature => feature.geometry.type === "Point").forEach(feature => {
      const code = feature.properties.code;
      const point = projection(feature.geometry.coordinates);
      if (!point || !codes.has(code)) return;
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("class", "mastery-point");
      group.dataset.code = code;
      group.setAttribute("tabindex", "0");
      group.setAttribute("role", "button");
      group.setAttribute("aria-label", "Select this small country");
      const halo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      halo.setAttribute("cx", point[0]); halo.setAttribute("cy", point[1]); halo.setAttribute("r", "13"); halo.setAttribute("fill", "transparent");
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", point[0]); circle.setAttribute("cy", point[1]); circle.setAttribute("r", "6.5");
      group.append(halo, circle);
      group.addEventListener("click", () => handleCountrySelection(code));
      group.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handleCountrySelection(code); }
      });
      elements.map.append(group);
    });
    updateMapClasses();
  }

  function mapNodes(code) {
    return [...elements.map.querySelectorAll("[data-code]")].filter(node => node.dataset.code === code);
  }

  function updateMapClasses() {
    if (!activeSession) return;
    const resolved = new Set(activeSession.resolved);
    elements.map.querySelectorAll("[data-code]").forEach(node => {
      const code = node.dataset.code;
      node.classList.toggle("is-placed", resolved.includes(code));
      node.classList.toggle("is-wrong", code === activeSession.lastWrongCode);
      node.classList.toggle("is-revealed", code === activeSession.currentResultClass && activeSession.locked);
      node.classList.toggle("is-current-correct", code === activeSession.currentResultClass && activeSession.locked && activeSession.currentResultType === "correct");
    });
  }

  function currentCode() {
    return activeSession?.queue?.[0] || null;
  }

  function presentCurrentCountry() {
    if (!activeSession) return;
    const code = currentCode();
    if (!code) { finishSession(); return; }
    activeSession.currentAttempts = 0;
    activeSession.locked = false;
    activeSession.lastWrongCode = null;
    activeSession.currentResultClass = null;
    activeSession.currentResultType = null;
    const country = countryByCode.get(code);
    const complete = activeSession.resolved.length;
    const regionLabel = activeSession.review ? "Smart Review" : activeSession.region;
    elements.sessionEyebrow.textContent = `${regionLabel.toUpperCase()} · ${activeSession.mode === "test" ? "TEST MODE" : "LEARN MODE"}`;
    elements.sessionTitle.textContent = activeSession.review ? "Strengthen the countries that slipped." : `Master ${activeSession.region}.`;
    elements.sessionProgressLabel.textContent = `${complete} of ${activeSession.originalTotal}`;
    elements.sessionScoreLabel.textContent = `${activeSession.stats.firstTry} first try`;
    elements.mapInstruction.textContent = `Tap ${country.name}`;
    elements.missionIndex.textContent = `COUNTRY ${complete + 1} OF ${activeSession.originalTotal}`;
    elements.missionMode.textContent = activeSession.mode.toUpperCase();
    elements.targetCountry.textContent = country.name;
    elements.targetMetadata.innerHTML = `<span>${escapeHtml(country.continent)}</span><span>${escapeHtml(formatArea(country.area))}</span>`;
    elements.progressBar.style.width = `${Math.round(complete / activeSession.originalTotal * 100)}%`;
    elements.attemptPanel.className = "attempt-panel";
    elements.attemptPanel.querySelector("strong").textContent = "First attempt";
    elements.attemptPanel.querySelector("p").textContent = activeSession.mode === "test" ? "Your first tap is the scored answer." : "Tap the country you think is correct.";
    elements.skip.disabled = activeSession.mode === "test";
    elements.reveal.disabled = false;
    const stats = countryProgress(code);
    stats.seen += 1;
    stats.lastSeen = Date.now();
    saveProgress();
    updateLiveStats();
    updateMapClasses();
  }

  function handleCountrySelection(code) {
    if (!activeSession || activeSession.locked) return;
    const target = currentCode();
    if (!target || !countryByCode.has(code)) return;
    if (code === target) {
      resolveCorrect();
      return;
    }
    const item = countryProgress(target);
    item.misses += 1;
    item.lastSeen = Date.now();
    activeSession.currentAttempts += 1;
    activeSession.lastWrongCode = code;
    const selected = countryByCode.get(code);
    const targetCountry = countryByCode.get(target);
    const distance = gameData.distance(code, target);
    saveProgress();
    elements.attemptPanel.className = "attempt-panel is-wrong";
    elements.attemptPanel.querySelector("strong").textContent = `${selected.name} is not it.`;
    elements.attemptPanel.querySelector("p").textContent = distance === 0
      ? `${selected.name} shares a border with ${targetCountry.name}.`
      : `${selected.name} is ${formatDistance(distance)} from ${targetCountry.name}.`;
    showMapFeedback("Not there yet", distance === 0 ? "Very close — the countries share a border." : `${formatDistance(distance)} away from the target.`);
    updateMapClasses();
    setTimeout(() => {
      if (!activeSession || activeSession.locked) return;
      activeSession.lastWrongCode = null;
      updateMapClasses();
    }, 760);
    if (activeSession.mode === "test") {
      activeSession.locked = true;
      activeSession.currentResultClass = target;
      activeSession.currentResultType = "reveal";
      item.revealed += 1;
      activeSession.stats.revealed += 1;
      saveProgress();
      updateLiveStats();
      updateMapClasses();
      setTimeout(resolveCurrentAndAdvance, 1250);
    }
  }

  function resolveCorrect() {
    const code = currentCode();
    if (!activeSession || !code) return;
    activeSession.locked = true;
    activeSession.currentResultClass = code;
    activeSession.currentResultType = "correct";
    const item = countryProgress(code);
    item.correct += 1;
    item.lastSeen = Date.now();
    let category = "firstTry";
    if (activeSession.skippedCodes.has(code)) category = "skipped";
    else if (activeSession.currentAttempts > 0) category = "retry";
    if (category === "firstTry") item.firstTry += 1;
    if (category === "retry") item.retries += 1;
    activeSession.stats[category] += 1;
    saveProgress();
    const country = countryByCode.get(code);
    elements.attemptPanel.className = "attempt-panel is-correct";
    elements.attemptPanel.querySelector("strong").textContent = category === "firstTry" ? "Placed first try." : "Country placed.";
    elements.attemptPanel.querySelector("p").textContent = `${country.name} · ${country.continent} · ${formatArea(country.area)}`;
    showMapFeedback("Correct", `${country.name} is now attached to your regional map.`);
    updateLiveStats();
    updateMapClasses();
    setTimeout(resolveCurrentAndAdvance, 850);
  }

  function resolveCurrentAndAdvance() {
    if (!activeSession) return;
    const code = currentCode();
    if (!code) return;
    activeSession.resolved.push(code);
    activeSession.queue.shift();
    activeSession.locked = false;
    activeSession.currentResultClass = null;
    activeSession.currentResultType = null;
    updateMapClasses();
    if (!activeSession.queue.length) finishSession();
    else presentCurrentCountry();
  }

  function skipCurrent() {
    if (!activeSession || activeSession.locked || activeSession.mode === "test") return;
    const code = currentCode();
    if (!code) return;
    if (!activeSession.skippedCodes.has(code)) {
      activeSession.skippedCodes.add(code);
      countryProgress(code).skipped += 1;
      saveProgress();
    }
    activeSession.queue.push(activeSession.queue.shift());
    showToast(`${countryByCode.get(code).name} moved to the end of the session.`);
    presentCurrentCountry();
  }

  function revealCurrent() {
    if (!activeSession || activeSession.locked) return;
    const code = currentCode();
    if (!code) return;
    activeSession.locked = true;
    activeSession.currentResultClass = code;
    activeSession.currentResultType = "reveal";
    countryProgress(code).revealed += 1;
    activeSession.stats.revealed += 1;
    saveProgress();
    const country = countryByCode.get(code);
    elements.attemptPanel.className = "attempt-panel is-wrong";
    elements.attemptPanel.querySelector("strong").textContent = `${country.name} revealed.`;
    elements.attemptPanel.querySelector("p").textContent = "Study its position now; it will be prioritised in a future learning session.";
    showMapFeedback("Country revealed", `${country.name} has been highlighted on the map.`);
    updateLiveStats();
    updateMapClasses();
    setTimeout(resolveCurrentAndAdvance, 1450);
  }

  function updateLiveStats() {
    if (!activeSession) return;
    elements.firstTryLive.textContent = activeSession.stats.firstTry;
    elements.retryLive.textContent = activeSession.stats.retry;
    elements.skippedLive.textContent = activeSession.stats.skipped + activeSession.skippedCodes.size;
    elements.revealedLive.textContent = activeSession.stats.revealed;
    elements.sessionScoreLabel.textContent = `${activeSession.stats.firstTry} first try`;
  }

  function finishSession() {
    if (!activeSession) return;
    const session = activeSession;
    const score = Math.round(session.stats.firstTry / session.originalTotal * 100);
    if (!session.review && REGION_ORDER.includes(session.region)) {
      const data = regionProgress(session.region);
      data.sessions += 1;
      data.lastScore = score;
      data.bestScore = Math.max(data.bestScore || 0, score);
      data.lastPlayed = Date.now();
      if (session.mode === "test") data.testSessions += 1;
      else data.learnSessions += 1;
    } else {
      const reviewData = regionProgress("Smart Review");
      reviewData.sessions += 1;
      reviewData.lastScore = score;
      reviewData.bestScore = Math.max(reviewData.bestScore || 0, score);
      reviewData.lastPlayed = Date.now();
    }
    saveProgress();
    elements.progressBar.style.width = "100%";
    elements.resultEyebrow.textContent = `${session.review ? "SMART REVIEW" : session.region.toUpperCase()} COMPLETE`;
    elements.resultTitle.textContent = session.mode === "test" ? "Knowledge measured." : "Region mapped.";
    elements.resultCopy.textContent = session.mode === "test"
      ? "The score reflects only countries placed correctly on the first attempt."
      : "Completion and country-level learning signals have been saved for your next session.";
    elements.resultScore.textContent = `${score}%`;
    elements.resultFirstTry.textContent = session.stats.firstTry;
    elements.resultRetry.textContent = session.stats.retry;
    elements.resultSkipped.textContent = session.stats.skipped;
    elements.resultRevealed.textContent = session.stats.revealed;
    elements.result.showModal();
  }

  function returnToDashboard() {
    if (elements.result.open) elements.result.close();
    activeSession = null;
    elements.session.classList.add("is-hidden");
    elements.dashboard.classList.remove("is-hidden");
    renderDashboard();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  elements.regionGrid.addEventListener("click", event => {
    const learn = event.target.closest("[data-region-start]");
    const test = event.target.closest("[data-region-test]");
    if (learn) openModeDialog(learn.dataset.regionStart);
    if (test) startSession(test.dataset.regionTest, "test");
  });
  document.querySelector("[data-close-mode]").addEventListener("click", () => elements.modeDialog.close());
  elements.startLearn.addEventListener("click", () => startSession(selectedRegion, "learn"));
  elements.startTest.addEventListener("click", () => startSession(selectedRegion, "test"));
  elements.resume.addEventListener("click", () => openModeDialog(REGION_ORDER.includes(progress.lastRegion) ? progress.lastRegion : "Europe"));
  elements.review.addEventListener("click", () => startSession("Smart Review", "learn", weakCountryCodes()));
  elements.exit.addEventListener("click", () => {
    if (!activeSession || confirm("Exit this session? Your completed country results are already saved.")) returnToDashboard();
  });
  elements.skip.addEventListener("click", skipCurrent);
  elements.reveal.addEventListener("click", revealCurrent);
  elements.resultDashboard.addEventListener("click", returnToDashboard);
  elements.resultAgain.addEventListener("click", () => {
    const previous = activeSession;
    elements.result.close();
    if (previous?.review) startSession("Smart Review", "learn", weakCountryCodes());
    else startSession(previous?.region || progress.lastRegion || "Europe", previous?.mode || "learn");
  });

  renderDashboard();
  elements.loading.classList.add("is-hidden");
  setTimeout(() => elements.loading.remove(), 350);
  window.__NEARER_MASTERY_STARTED = true;
})();
