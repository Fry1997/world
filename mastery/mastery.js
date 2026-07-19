(() => {
  "use strict";
  if (window.__NEARER_MASTERY_STARTED) return;

  const d3 = window.NEARER_D3;
  const gameData = window.NEARER_GAME_DATA;
  const geoData = window.NEARER_COUNTRIES_GEOJSON;
  if (!d3 || !gameData || !geoData) throw new Error("Regional Mastery requires Nearer map data.");

  const STORAGE_KEY = "nearer-mastery-v1";
  const SESSION_KEY = "nearer-mastery-session-v1";
  const THEME_KEY = "nearer-together-theme";
  const normalise = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  const countries = [...gameData.countries].sort((a, b) => a.name.localeCompare(b.name));
  const countryByCode = new Map(countries.map(country => [country.code, country]));
  const countryByName = new Map(countries.map(country => [normalise(country.name), country]));
  for (const country of countries) for (const alias of country.aliases || []) countryByName.set(normalise(alias), country);
  const featureByCode = new Map(geoData.features.map(feature => [feature.properties.code, feature]));
  const polygonFeatures = geoData.features.filter(feature => feature.geometry.type !== "Point" && countryByCode.has(feature.properties.code));
  const pointFeatures = geoData.features.filter(feature => feature.geometry.type === "Point" && countryByCode.has(feature.properties.code));
  const worldCollection = { type: "FeatureCollection", features: polygonFeatures };

  const REGION_DEFINITIONS = [
    { id: "europe", name: "Europe", symbol: "EU", glow: "rgba(93,139,192,.28)", centre: [14, 52], zoom: 1.65, names: ["Albania","Andorra","Austria","Belarus","Belgium","Bosnia and Herzegovina","Bulgaria","Croatia","Cyprus","Czechia","Denmark","Estonia","Finland","France","Germany","Greece","Hungary","Iceland","Ireland","Italy","Kosovo","Latvia","Liechtenstein","Lithuania","Luxembourg","Malta","Moldova","Monaco","Montenegro","Netherlands","North Macedonia","Norway","Poland","Portugal","Romania","Russia","San Marino","Serbia","Slovakia","Slovenia","Spain","Sweden","Switzerland","Ukraine","United Kingdom","Vatican City"] },
    { id: "africa", name: "Africa", symbol: "AF", glow: "rgba(231,173,79,.28)", centre: [18, 2], zoom: 1.18, names: ["Algeria","Angola","Benin","Botswana","Burkina Faso","Burundi","Cabo Verde","Cameroon","Central African Republic","Chad","Comoros","Democratic Republic of the Congo","Republic of the Congo","Cote d'Ivoire","Djibouti","Egypt","Equatorial Guinea","Eritrea","Eswatini","Ethiopia","Gabon","Gambia","Ghana","Guinea","Guinea-Bissau","Kenya","Lesotho","Liberia","Libya","Madagascar","Malawi","Mali","Mauritania","Mauritius","Morocco","Mozambique","Namibia","Niger","Nigeria","Rwanda","Sao Tome and Principe","Senegal","Seychelles","Sierra Leone","Somalia","South Africa","South Sudan","Sudan","Tanzania","Togo","Tunisia","Uganda","Zambia","Zimbabwe"] },
    { id: "asia", name: "Asia", symbol: "AS", glow: "rgba(204,104,88,.26)", centre: [88, 34], zoom: 1.02, names: ["Afghanistan","Armenia","Azerbaijan","Bahrain","Bangladesh","Bhutan","Brunei","Cambodia","China","Georgia","India","Indonesia","Iran","Iraq","Israel","Japan","Jordan","Kazakhstan","Kuwait","Kyrgyzstan","Laos","Lebanon","Malaysia","Maldives","Mongolia","Myanmar","Nepal","North Korea","Oman","Pakistan","Palestine","Philippines","Qatar","Saudi Arabia","Singapore","South Korea","Sri Lanka","Syria","Taiwan","Tajikistan","Thailand","Timor-Leste","Turkey","Turkmenistan","United Arab Emirates","Uzbekistan","Vietnam","Yemen"] },
    { id: "north-america", name: "North America", symbol: "NA", glow: "rgba(72,160,150,.25)", centre: [-98, 35], zoom: 1.18, names: ["Antigua and Barbuda","Bahamas","Barbados","Belize","Canada","Costa Rica","Cuba","Dominica","Dominican Republic","El Salvador","Grenada","Guatemala","Haiti","Honduras","Jamaica","Mexico","Nicaragua","Panama","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Trinidad and Tobago","United States"] },
    { id: "south-america", name: "South America", symbol: "SA", glow: "rgba(114,176,104,.25)", centre: [-61, -17], zoom: 1.25, names: ["Argentina","Bolivia","Brazil","Chile","Colombia","Ecuador","Guyana","Paraguay","Peru","Suriname","Uruguay","Venezuela"] },
    { id: "oceania", name: "Oceania", symbol: "OC", glow: "rgba(144,112,205,.28)", centre: [151, -18], zoom: 1.15, names: ["Australia","Fiji","Kiribati","Marshall Islands","Micronesia","Nauru","New Zealand","Palau","Papua New Guinea","Samoa","Solomon Islands","Tonga","Tuvalu","Vanuatu"] }
  ];

  const regions = REGION_DEFINITIONS.map(region => {
    const mapped = region.names.map(name => countryByName.get(normalise(name))).filter(Boolean);
    return { ...region, countries: [...new Map(mapped.map(country => [country.code, country])).values()] };
  }).filter(region => region.countries.length);
  const regionById = new Map(regions.map(region => [region.id, region]));
  const allRegionCodes = new Set(regions.flatMap(region => region.countries.map(country => country.code)));

  const elements = {
    dashboard: document.getElementById("masteryDashboard"), session: document.getElementById("masterySession"), grid: document.getElementById("regionGrid"),
    overall: document.getElementById("overallMastery"), overallCopy: document.getElementById("overallCopy"), overallBar: document.getElementById("overallProgressBar"),
    placed: document.getElementById("countriesPlacedStat"), placedCopy: document.getElementById("countriesPlacedCopy"), accuracy: document.getElementById("accuracyStat"), sessions: document.getElementById("sessionsStat"), review: document.getElementById("reviewStat"),
    weakest: document.getElementById("weakestCountries"), reviewBadge: document.getElementById("reviewBadge"), reviewWeak: document.getElementById("reviewWeakButton"), continueButton: document.getElementById("continueMasteryButton"), modeCopy: document.getElementById("learningModeCopy"),
    sessionEyebrow: document.getElementById("sessionEyebrow"), targetName: document.getElementById("targetCountryName"), instruction: document.getElementById("sessionInstruction"), exit: document.getElementById("exitSessionButton"),
    progressLabel: document.getElementById("sessionProgressLabel"), progressPercent: document.getElementById("sessionProgressPercent"), progressBar: document.getElementById("sessionProgressBar"), firstCorrect: document.getElementById("firstCorrectCount"), recovered: document.getElementById("recoveredCount"), skipped: document.getElementById("skippedCount"),
    mapPrompt: document.getElementById("mapPrompt"), canvas: document.getElementById("masteryGlobeCanvas"), stage: document.getElementById("masteryGlobeStage"), reset: document.getElementById("resetMasteryGlobe"), zoomIn: document.getElementById("masteryZoomIn"), zoomOut: document.getElementById("masteryZoomOut"),
    feedback: document.getElementById("masteryFeedback"), skip: document.getElementById("skipCountryButton"), reveal: document.getElementById("revealCountryButton"), currentRegion: document.getElementById("currentRegionLabel"), currentCountry: document.getElementById("currentCountryLarge"), attemptCopy: document.getElementById("countryAttemptCopy"), remaining: document.getElementById("remainingCount"), currentRun: document.getElementById("currentRun"), liveAccuracy: document.getElementById("liveAccuracy"), hintTitle: document.getElementById("locationHintTitle"), hintCopy: document.getElementById("locationHintCopy"),
    result: document.getElementById("masteryResultDialog"), resultTitle: document.getElementById("resultRegionTitle"), resultSummary: document.getElementById("resultSummary"), resultScore: document.getElementById("resultKnowledgeScore"), resultFirst: document.getElementById("resultFirstCorrect"), resultRecovered: document.getElementById("resultRecovered"), resultReview: document.getElementById("resultReviewList"), repeat: document.getElementById("repeatRegionButton"), closeResult: document.getElementById("closeMasteryResultButton"), loading: document.getElementById("masteryLoading")
  };

  const defaultProgress = () => ({ version: 1, mode: "practice", countries: {}, regions: {}, totals: { sessions: 0, firstCorrect: 0, answered: 0 } });
  function loadProgress() { try { return { ...defaultProgress(), ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || {}) }; } catch { return defaultProgress(); } }
  function saveProgress() { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); }
  function loadSession() { try { const value = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); return value?.version === 1 ? value : null; } catch { return null; } }
  function saveSession() { if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session)); else localStorage.removeItem(SESSION_KEY); }
  function shuffle(values) { const copy = [...values]; for (let i = copy.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; }
  function strengthFor(record = {}) { const seen = record.correct || 0; const first = record.firstCorrect || 0; const misses = record.misses || 0; return Math.max(0, Math.min(100, Math.round(first * 34 + Math.max(0, seen - first) * 18 - misses * 7))); }
  function countryRecord(code) { return progress.countries[code] || { attempts: 0, correct: 0, firstCorrect: 0, misses: 0, reveals: 0, skips: 0, lastSeen: null }; }
  function masteredCodes() { return new Set(Object.entries(progress.countries).filter(([, record]) => strengthFor(record) >= 70).map(([code]) => code)); }
  function studiedCodes() { return Object.keys(progress.countries).filter(code => allRegionCodes.has(code)); }
  function weakCountries(limit = 8) { return Object.entries(progress.countries).filter(([code, record]) => allRegionCodes.has(code) && (record.attempts || 0) > 0 && strengthFor(record) < 70).map(([code, record]) => ({ country: countryByCode.get(code), strength: strengthFor(record), record })).filter(item => item.country).sort((a, b) => a.strength - b.strength || (b.record.misses || 0) - (a.record.misses || 0)).slice(0, limit); }

  let progress = loadProgress();
  let session = loadSession();
  let selectedMode = progress.mode || "practice";
  let feedbackTimer = 0;
  let flashCode = null;
  let revealCode = null;

  function regionStats(region) {
    const records = region.countries.map(country => countryRecord(country.code));
    const mastered = records.filter(record => strengthFor(record) >= 70).length;
    const studied = records.filter(record => (record.attempts || 0) > 0).length;
    const first = records.reduce((sum, record) => sum + (record.firstCorrect || 0), 0);
    const answered = records.reduce((sum, record) => sum + (record.correct || 0), 0);
    const saved = progress.regions[region.id] || {};
    return { mastered, studied, first, answered, accuracy: answered ? Math.round(first / answered * 100) : null, sessions: saved.sessions || 0, best: saved.best || null };
  }

  function renderDashboard() {
    const mastered = masteredCodes();
    const studied = studiedCodes();
    const total = allRegionCodes.size;
    const overallPercent = total ? Math.round(mastered.size / total * 100) : 0;
    elements.overall.textContent = `${overallPercent}%`;
    elements.overallBar.style.width = `${overallPercent}%`;
    elements.overallCopy.textContent = mastered.size ? `${mastered.size} countries have reached mastered strength.` : "Start a region to build your map memory.";
    elements.placed.textContent = String(studied.length);
    elements.placedCopy.textContent = `of ${total} countries studied`;
    elements.accuracy.textContent = progress.totals.answered ? `${Math.round(progress.totals.firstCorrect / progress.totals.answered * 100)}%` : "—";
    elements.sessions.textContent = String(progress.totals.sessions || 0);
    const weak = weakCountries();
    elements.review.textContent = String(weak.length);
    elements.reviewBadge.textContent = weak.length ? `${weak.length} to revisit` : "No review due";
    elements.continueButton.classList.toggle("is-hidden", !session);
    elements.reviewWeak.disabled = !weak.length;

    elements.grid.innerHTML = regions.map((region, index) => {
      const stats = regionStats(region);
      const completion = Math.round(stats.mastered / region.countries.length * 100);
      const status = completion === 100 ? "Mastered" : stats.studied ? "In progress" : index === 0 ? "Recommended" : "Ready";
      return `<article class="region-card" style="--region-glow:${region.glow}">
        <div class="region-card-top"><span class="region-symbol">${region.symbol}</span><span class="region-status">${status}</span></div>
        <h3>${region.name}</h3><p>Place every country in this ${region.countries.length}-country learning set. Missed locations return until they are resolved.</p>
        <div class="region-card-progress"><i style="width:${completion}%"></i></div>
        <div class="region-card-meta"><span>${stats.mastered}/${region.countries.length} mastered</span><span>${stats.accuracy === null ? "No score" : `${stats.accuracy}% first time`}</span></div>
        <button type="button" data-region="${region.id}">${stats.studied ? "Continue learning" : `Start ${region.name}`}</button>
      </article>`;
    }).join("");

    elements.weakest.innerHTML = weak.length ? weak.slice(0, 5).map(item => `<div class="weak-country"><strong>${item.country.name}</strong><span>${item.strength}% strength</span></div>`).join("") : "<p>Complete a learning round and Nearer will find the places that need another look.</p>";
  }

  function updateMode(mode) {
    selectedMode = mode;
    progress.mode = mode;
    saveProgress();
    document.querySelectorAll("[data-learning-mode]").forEach(button => button.classList.toggle("is-active", button.dataset.learningMode === mode));
    elements.modeCopy.textContent = mode === "practice" ? "Practice shows the name of a country you tap incorrectly and keeps missed countries in the queue." : "Test records mistakes without naming the country you tapped. Hints remain hidden until you reveal the answer.";
  }

  function createSession(region, codes = null) {
    const queue = codes?.length ? shuffle(codes) : shuffle(region.countries.map(country => country.code));
    return { version: 1, regionId: region.id, mode: selectedMode, queue, initialTotal: queue.length, current: queue[0], currentMisses: 0, currentFirstAvailable: true, completed: [], results: [], firstCorrect: 0, recovered: 0, skipped: 0, revealed: 0, startedAt: Date.now(), updatedAt: Date.now() };
  }

  function startRegion(regionId, codes = null) {
    const region = regionById.get(regionId);
    if (!region) return;
    session = createSession(region, codes);
    saveSession();
    showSession();
  }

  function showSession() {
    if (!session || !regionById.has(session.regionId)) { session = null; saveSession(); renderDashboard(); return; }
    elements.dashboard.classList.add("is-hidden");
    elements.session.classList.remove("is-hidden");
    document.body.classList.add("mastery-session-active");
    globe.setRegion(regionById.get(session.regionId));
    renderSession();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function leaveSession() {
    elements.session.classList.add("is-hidden");
    elements.dashboard.classList.remove("is-hidden");
    document.body.classList.remove("mastery-session-active");
    renderDashboard();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function currentCountry() { return countryByCode.get(session?.current); }
  function currentRegion() { return regionById.get(session?.regionId); }
  function liveAccuracy() { const resolved = session.firstCorrect + session.recovered; return resolved ? Math.round(session.firstCorrect / resolved * 100) : null; }

  function renderSession() {
    const country = currentCountry();
    const region = currentRegion();
    if (!country || !region) return;
    const done = session.completed.length;
    const percent = session.initialTotal ? Math.round(done / session.initialTotal * 100) : 0;
    elements.sessionEyebrow.textContent = `${region.name.toUpperCase()} · ${session.mode.toUpperCase()}`;
    elements.targetName.textContent = `Find ${country.name}.`;
    elements.instruction.textContent = session.mode === "practice" ? "Tap the named country. Incorrect choices become learning clues." : "Tap the named country. Test mode keeps wrong choices anonymous.";
    elements.progressLabel.textContent = `${Math.min(done + 1, session.initialTotal)} of ${session.initialTotal}`;
    elements.progressPercent.textContent = `${percent}%`;
    elements.progressBar.style.width = `${percent}%`;
    elements.firstCorrect.textContent = String(session.firstCorrect);
    elements.recovered.textContent = String(session.recovered);
    elements.skipped.textContent = String(session.skipped);
    elements.currentRegion.textContent = region.name;
    elements.currentCountry.textContent = country.name;
    elements.attemptCopy.textContent = session.currentFirstAvailable ? "A first-time placement is still available." : `${session.currentMisses} ${session.currentMisses === 1 ? "miss" : "misses"} on this country. It can still be recovered.`;
    elements.remaining.textContent = String(session.queue.length);
    elements.currentRun.textContent = String(session.completed.length);
    elements.liveAccuracy.textContent = liveAccuracy() === null ? "—" : `${liveAccuracy()}%`;
    elements.mapPrompt.textContent = `${country.name} · tap its location`;
    if (session.currentMisses < 2 || session.mode === "test") {
      elements.hintTitle.textContent = "No hint used.";
      elements.hintCopy.textContent = session.mode === "practice" ? "After two misses, Practice mode offers a directional clue without revealing the answer." : "Test mode keeps directional clues hidden unless you reveal the answer.";
    } else {
      const feature = featureByCode.get(country.code);
      const centroid = feature?.geometry.type === "Point" ? feature.geometry.coordinates : feature ? d3.geoCentroid(feature) : null;
      const horizontal = centroid ? (centroid[0] < 0 ? "western" : "eastern") : "central";
      const vertical = centroid ? (centroid[1] > 20 ? "northern" : centroid[1] < -10 ? "southern" : "central") : "central";
      elements.hintTitle.textContent = `${vertical[0].toUpperCase() + vertical.slice(1)} ${horizontal} ${region.name}`;
      elements.hintCopy.textContent = "Use this broad location clue, then keep searching without losing the country from your queue.";
    }
    globe.queueRender();
  }

  function setFeedback(kind, title, copy) {
    clearTimeout(feedbackTimer);
    elements.feedback.className = `mastery-feedback is-${kind}`;
    elements.feedback.querySelector("strong").textContent = title;
    elements.feedback.querySelector("p").textContent = copy;
  }

  function updateCountryProgress(code, outcome, misses) {
    const record = { ...countryRecord(code) };
    record.attempts = (record.attempts || 0) + 1;
    record.lastSeen = Date.now();
    record.misses = (record.misses || 0) + (misses || 0);
    if (outcome === "first") { record.correct = (record.correct || 0) + 1; record.firstCorrect = (record.firstCorrect || 0) + 1; }
    if (outcome === "recovered") record.correct = (record.correct || 0) + 1;
    if (outcome === "revealed") record.reveals = (record.reveals || 0) + 1;
    if (outcome === "skipped") record.skips = (record.skips || 0) + 1;
    progress.countries[code] = record;
  }

  function resolveCurrent(outcome) {
    const code = session.current;
    const country = countryByCode.get(code);
    if (!country) return;
    session.results.push({ code, outcome, misses: session.currentMisses });
    if (outcome === "first") session.firstCorrect += 1;
    else if (outcome === "recovered") session.recovered += 1;
    else if (outcome === "revealed") session.revealed += 1;
    session.completed.push(code);
    session.queue.shift();
    updateCountryProgress(code, outcome, session.currentMisses);
    progress.totals.answered = (progress.totals.answered || 0) + (outcome === "first" || outcome === "recovered" ? 1 : 0);
    if (outcome === "first") progress.totals.firstCorrect = (progress.totals.firstCorrect || 0) + 1;
    saveProgress();
    if (!session.queue.length) { finishSession(); return; }
    session.current = session.queue[0];
    session.currentMisses = 0;
    session.currentFirstAvailable = true;
    session.updatedAt = Date.now();
    saveSession();
    setTimeout(() => { setFeedback("neutral", "Place the next country.", "Your first answer determines first-attempt accuracy."); renderSession(); }, 520);
  }

  function answerCountry(code) {
    if (!session || !session.current || flashCode || revealCode) return;
    const tapped = countryByCode.get(code);
    const target = currentCountry();
    if (!tapped || !target) return;
    if (code === target.code) {
      const outcome = session.currentFirstAvailable ? "first" : "recovered";
      flashCode = code;
      setFeedback("correct", `${target.name} placed.`, outcome === "first" ? "Correct on the first attempt. This adds the strongest mastery gain." : "Recovered after a miss. The location is now reinforced.");
      globe.queueRender();
      setTimeout(() => { flashCode = null; resolveCurrent(outcome); }, 650);
      return;
    }
    session.currentMisses += 1;
    session.currentFirstAvailable = false;
    session.updatedAt = Date.now();
    saveSession();
    flashCode = code;
    const copy = session.mode === "practice" ? `That was ${tapped.name}. Keep ${target.name} in mind and try again.` : `That location is not ${target.name}. Try again.`;
    setFeedback("wrong", "Not quite.", copy);
    globe.queueRender();
    setTimeout(() => { flashCode = null; renderSession(); }, 620);
  }

  function skipCurrent() {
    if (!session || session.queue.length < 2) return;
    const code = session.queue.shift();
    session.queue.push(code);
    session.results.push({ code, outcome: "skipped", misses: session.currentMisses });
    session.skipped += 1;
    updateCountryProgress(code, "skipped", session.currentMisses);
    session.current = session.queue[0];
    session.currentMisses = 0;
    session.currentFirstAvailable = true;
    session.updatedAt = Date.now();
    saveProgress(); saveSession();
    setFeedback("neutral", "Moved to the back of the queue.", "You will see that country again before the session can finish.");
    renderSession();
  }

  function revealCurrent() {
    if (!session || revealCode) return;
    revealCode = session.current;
    session.currentFirstAvailable = false;
    session.currentMisses += 1;
    setFeedback("wrong", `${currentCountry().name} revealed.`, "The country is highlighted now. It will be recorded as revealed rather than placed.");
    globe.focusCountry(revealCode);
    globe.queueRender();
    setTimeout(() => { revealCode = null; resolveCurrent("revealed"); }, 1500);
  }

  function finishSession() {
    const region = currentRegion();
    const total = session.initialTotal;
    const score = total ? Math.round(session.firstCorrect / total * 100) : 0;
    const regionRecord = { ...(progress.regions[region.id] || {}) };
    regionRecord.sessions = (regionRecord.sessions || 0) + 1;
    regionRecord.best = Math.max(regionRecord.best || 0, score);
    regionRecord.lastPlayed = Date.now();
    progress.regions[region.id] = regionRecord;
    progress.totals.sessions = (progress.totals.sessions || 0) + 1;
    saveProgress();
    const resultSnapshot = { ...session };
    session = null; saveSession();
    elements.resultTitle.textContent = `${region.name} mapped.`;
    elements.resultSummary.textContent = `${resultSnapshot.firstCorrect} of ${total} countries were placed correctly on the first attempt. Your per-country strength map has been updated.`;
    elements.resultScore.textContent = `${score}%`;
    elements.resultFirst.textContent = String(resultSnapshot.firstCorrect);
    elements.resultRecovered.textContent = String(resultSnapshot.recovered);
    const review = resultSnapshot.results.filter(item => item.outcome !== "first").slice(0, 8);
    elements.resultReview.innerHTML = review.length ? review.map(item => `<div class="result-review-item"><strong>${countryByCode.get(item.code)?.name || item.code}</strong><span>${item.outcome === "recovered" ? "Recovered" : item.outcome === "revealed" ? "Revealed" : "Needs review"}</span></div>`).join("") : '<div class="result-review-item"><strong>Perfect first-time round</strong><span>No review list</span></div>';
    elements.repeat.onclick = () => { elements.result.close(); startRegion(region.id); };
    elements.result.showModal();
  }

  const context = elements.canvas.getContext("2d", { alpha: true, desynchronized: true });
  const projection = d3.geoOrthographic().clipAngle(90).precision(.45);
  const path = d3.geoPath(projection, context);
  const graticule = d3.geoGraticule10();
  const initialRotation = [-12, -13, 0];
  let rotation = [...initialRotation], zoom = 1, queued = false, interaction = null, activeRegion = regions[0], pointers = new Map(), width = 0, height = 0, ratio = 1;

  function resizeCanvas() {
    const rect = elements.stage.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(rect.width));
    const nextHeight = Math.max(1, Math.round(rect.height));
    const nextRatio = Math.min(devicePixelRatio || 1, matchMedia("(max-width:820px)").matches ? 2.2 : 2);
    if (nextWidth !== width || nextHeight !== height || nextRatio !== ratio) {
      width = nextWidth; height = nextHeight; ratio = nextRatio;
      elements.canvas.width = Math.round(width * ratio); elements.canvas.height = Math.round(height * ratio);
      elements.canvas.style.width = `${width}px`; elements.canvas.style.height = `${height}px`;
    }
    context.setTransform(1,0,0,1,0,0); context.clearRect(0,0,elements.canvas.width,elements.canvas.height); context.setTransform(ratio,0,0,ratio,0,0);
  }

  function drawFeature(feature, fill, stroke, lineWidth = 1, alpha = 1, dash = []) {
    context.save(); context.globalAlpha = alpha; context.beginPath(); path(feature); if (fill) { context.fillStyle = fill; context.fill("evenodd"); } if (stroke) { context.strokeStyle = stroke; context.lineWidth = lineWidth; context.setLineDash(dash); context.stroke(); } context.restore();
  }

  function visible(coordinate) { return d3.geoDistance([-rotation[0], -rotation[1]], coordinate) <= Math.PI / 2 + .015; }
  function drawPoint(feature, fill, stroke, radiusValue = 5) { const coordinate = feature.geometry.coordinates; if (!visible(coordinate)) return; const point = projection(coordinate); if (!point) return; context.save(); context.beginPath(); context.arc(point[0], point[1], radiusValue, 0, Math.PI * 2); context.fillStyle = fill; context.fill(); context.strokeStyle = stroke; context.lineWidth = 1.7; context.stroke(); context.restore(); }

  function draw() {
    queued = false; if (document.hidden || !elements.stage.isConnected) return; resizeCanvas();
    const radius = Math.min(width, height) * .425 * zoom;
    projection.translate([width / 2, height / 2]).scale(radius).rotate(rotation).precision(interaction ? .8 : .45);
    const x = width / 2, y = height / 2;
    context.save(); context.beginPath(); context.arc(x,y,radius,0,Math.PI*2); context.fillStyle = "#03101a"; context.shadowColor = "rgba(0,5,10,.7)"; context.shadowBlur = interaction ? 14 : 28; context.shadowOffsetY = interaction ? 8 : 16; context.fill(); context.restore();
    context.save(); context.beginPath(); context.arc(x,y,radius,0,Math.PI*2); context.clip(); const ocean = context.createRadialGradient(x+radius*.28,y-radius*.33,radius*.03,x,y,radius*1.12); ocean.addColorStop(0,"#315a74"); ocean.addColorStop(.48,"#12364f"); ocean.addColorStop(1,"#020d16"); context.fillStyle=ocean; context.fillRect(x-radius,y-radius,radius*2,radius*2); context.restore();
    context.save(); context.beginPath(); path(graticule); context.strokeStyle="rgba(212,235,247,.09)"; context.lineWidth=.65; context.stroke(); context.restore();
    const land = context.createLinearGradient(width*.18,height*.12,width*.78,height*.9); land.addColorStop(0,"#f2ebdf"); land.addColorStop(.54,"#e5dccf"); land.addColorStop(1,"#bfb8ad"); drawFeature(worldCollection,land,"rgba(31,45,55,.55)",.7);
    const regionCodes = new Set(activeRegion.countries.map(country => country.code));
    for (const code of regionCodes) { const feature = featureByCode.get(code); if (!feature || feature.geometry.type === "Point") continue; drawFeature(feature,"rgba(82,126,153,.18)","rgba(221,236,244,.42)",.9); }
    for (const code of session?.completed || []) { const feature = featureByCode.get(code); if (!feature || feature.geometry.type === "Point") continue; drawFeature(feature,"#4c9e7f","rgba(244,250,245,.82)",1.3,.82); }
    if (flashCode) { const feature = featureByCode.get(flashCode); if (feature && feature.geometry.type !== "Point") drawFeature(feature, flashCode === session?.current ? "#55c996" : "#d96751", "#fff5eb", 2.5, .95); }
    if (revealCode) { const feature = featureByCode.get(revealCode); if (feature && feature.geometry.type !== "Point") drawFeature(feature,"#e7ad4f","#fff6dc",3,.96); }
    for (const feature of pointFeatures) { const code = feature.properties.code; if ((session?.completed || []).includes(code)) drawPoint(feature,"#4c9e7f","#fff6ed",4.6); else if (flashCode === code) drawPoint(feature,code === session?.current ? "#55c996" : "#d96751","#fff6ed",6); else if (revealCode === code) drawPoint(feature,"#e7ad4f","#fff6ed",6); else if (regionCodes.has(code)) drawPoint(feature,"#8aa8ba","rgba(255,255,255,.76)",3.8); }
    context.save(); context.beginPath(); context.arc(x,y,radius,0,Math.PI*2); context.strokeStyle="rgba(222,240,250,.34)"; context.lineWidth=1.5; context.stroke(); context.restore();
  }

  function queueRender() { if (queued) return; queued = true; requestAnimationFrame(draw); }
  function setRegion(region) { activeRegion = region; rotation = [-region.centre[0], -region.centre[1], 0]; zoom = region.zoom; queueRender(); }
  function focusCountry(code) { const feature = featureByCode.get(code); if (!feature) return; const coordinate = feature.geometry.type === "Point" ? feature.geometry.coordinates : d3.geoCentroid(feature); rotation = [-coordinate[0], -coordinate[1], 0]; zoom = Math.max(1.4, Math.min(2.2, zoom)); queueRender(); }
  function hitCountry(clientX, clientY) { const rect = elements.stage.getBoundingClientRect(); const point = [clientX - rect.left, clientY - rect.top]; const translate = projection.translate(); const radiusValue = projection.scale(); if (Math.hypot(point[0]-translate[0],point[1]-translate[1]) > radiusValue) return null; for (const feature of pointFeatures) { const projected = projection(feature.geometry.coordinates); if (projected && visible(feature.geometry.coordinates) && Math.hypot(projected[0]-point[0],projected[1]-point[1]) <= 17) return feature.properties.code; } const coordinate = projection.invert(point); if (!coordinate) return null; const feature = polygonFeatures.find(item => d3.geoContains(item, coordinate)); return feature?.properties.code || null; }
  function clampZoom(value) { return Math.max(.78, Math.min(4.5, value)); }
  function pointerDistance(values) { const [a,b] = values; return Math.hypot(a.x-b.x,a.y-b.y); }

  elements.stage.addEventListener("pointerdown", event => { if (event.target.closest("button")) return; event.preventDefault(); elements.stage.setPointerCapture?.(event.pointerId); pointers.set(event.pointerId,{x:event.clientX,y:event.clientY}); if (pointers.size===1) interaction={type:"rotate",x:event.clientX,y:event.clientY,rotation:[...rotation],moved:false}; else interaction={type:"pinch",distance:pointerDistance([...pointers.values()].slice(0,2)),zoom,moved:true}; queueRender(); },{passive:false});
  elements.stage.addEventListener("pointermove", event => { if (!pointers.has(event.pointerId)||!interaction) return; event.preventDefault(); pointers.set(event.pointerId,{x:event.clientX,y:event.clientY}); if (pointers.size>=2) { const distance=pointerDistance([...pointers.values()].slice(0,2)); if(interaction.type!=="pinch") interaction={type:"pinch",distance,zoom,moved:true}; if(interaction.distance>0) zoom=clampZoom(interaction.zoom*distance/interaction.distance); interaction.moved=true; queueRender(); return; } const dx=event.clientX-interaction.x,dy=event.clientY-interaction.y; if(Math.hypot(dx,dy)>5) interaction.moved=true; const sensitivity=180/Math.max(300,Math.min(width,height)*zoom); rotation=[interaction.rotation[0]+dx*sensitivity,Math.max(-82,Math.min(82,interaction.rotation[1]-dy*sensitivity)),0]; queueRender(); },{passive:false});
  const finishPointer = event => { if(!pointers.has(event.pointerId)) return; event.preventDefault(); const tap=pointers.size===1&&interaction?.type==="rotate"&&!interaction.moved; pointers.delete(event.pointerId); if(!pointers.size){interaction=null;if(tap){const code=hitCountry(event.clientX,event.clientY);if(code)answerCountry(code);}} queueRender(); };
  elements.stage.addEventListener("pointerup",finishPointer,{passive:false}); elements.stage.addEventListener("pointercancel",finishPointer,{passive:false});
  elements.stage.addEventListener("wheel",event=>{event.preventDefault();zoom=clampZoom(zoom*Math.exp(-event.deltaY*.0012));queueRender();},{passive:false});
  elements.zoomIn.addEventListener("click",()=>{zoom=clampZoom(zoom*1.25);queueRender();}); elements.zoomOut.addEventListener("click",()=>{zoom=clampZoom(zoom/1.25);queueRender();}); elements.reset.addEventListener("click",()=>setRegion(activeRegion));
  new ResizeObserver(queueRender).observe(elements.stage);
  const globe = { queueRender, setRegion, focusCountry };

  elements.grid.addEventListener("click", event => { const button = event.target.closest("button[data-region]"); if (button) startRegion(button.dataset.region); });
  document.querySelectorAll("[data-learning-mode]").forEach(button => button.addEventListener("click", () => updateMode(button.dataset.learningMode)));
  elements.continueButton.addEventListener("click", showSession);
  elements.reviewWeak.addEventListener("click", () => { const weak = weakCountries(20); if (!weak.length) return; const grouped = new Map(); for (const item of weak) { const region = regions.find(value => value.countries.some(country => country.code === item.country.code)); if (!region) continue; if (!grouped.has(region.id)) grouped.set(region.id, []); grouped.get(region.id).push(item.country.code); } const [regionId, codes] = [...grouped.entries()].sort((a,b)=>b[1].length-a[1].length)[0] || []; if (regionId) startRegion(regionId,codes); });
  elements.exit.addEventListener("click", leaveSession); elements.skip.addEventListener("click", skipCurrent); elements.reveal.addEventListener("click", revealCurrent);
  elements.closeResult.addEventListener("click", () => { elements.result.close(); leaveSession(); });
  elements.result.addEventListener("close", () => { if (!session) leaveSession(); });

  updateMode(selectedMode);
  renderDashboard();
  elements.loading.classList.add("is-hidden");
  window.__NEARER_MASTERY_STARTED = true;
})();