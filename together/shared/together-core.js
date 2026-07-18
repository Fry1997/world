(() => {
  "use strict";

  const d3 = window.NEARER_D3;
  const gameData = window.NEARER_GAME_DATA;
  const geoData = window.NEARER_COUNTRIES_GEOJSON;

  if (!d3 || !gameData || !geoData) {
    throw new Error("Nearer Together core requires game and map data.");
  }

  const countries = [...gameData.countries].sort((a, b) => a.name.localeCompare(b.name));
  const countryByCode = new Map(countries.map(country => [country.code, country]));
  const featureByCode = new Map(geoData.features.map(feature => [feature.properties.code, feature]));
  const polygonFeatures = geoData.features.filter(feature => feature.geometry.type !== "Point");
  const pointFeatures = geoData.features.filter(feature => feature.geometry.type === "Point");
  const polygonCollection = { type: "FeatureCollection", features: polygonFeatures };

  const normalise = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  const aliases = countries.flatMap(country =>
    [country.name, country.code, ...(country.aliases || [])]
      .map(name => ({ country, key: normalise(name) }))
  );
  const exactCountry = new Map(aliases.map(item => [item.key, item.country]));

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[character]);
  }

  function displayDistance(km, units = "km") {
    if (km === null || km === undefined) return "No signal";
    if (km === 0) return "Found";
    if (units === "mi") return `${Math.round(km * 0.621371).toLocaleString()} mi`;
    return `${Math.round(km).toLocaleString()} km`;
  }

  function heatColour(distance) {
    const closeness = 1 - Math.min(distance, 9000) / 9000;
    const eased = Math.pow(closeness, 0.72);
    const dark = document.documentElement.dataset.theme === "dark";
    return `hsl(${(218 - eased * 210).toFixed(0)} ${(58 + eased * 28).toFixed(0)}% ${(dark ? 45 + eased * 9 : 57 - eased * 5).toFixed(0)}%)`;
  }

  function closest(guesses) {
    if (!guesses?.length) return null;
    return [...guesses].sort((a, b) => a.distance - b.distance || a.order - b.order)[0];
  }

  function trend(guesses) {
    if (!guesses || guesses.length < 2) return null;
    const previous = guesses.at(-2).distance;
    const latest = guesses.at(-1).distance;
    return { delta: previous - latest, latest, previous };
  }

  function damerauLevenshtein(a, b) {
    const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let row = 0; row <= a.length; row += 1) matrix[row][0] = row;
    for (let column = 0; column <= b.length; column += 1) matrix[0][column] = column;
    for (let row = 1; row <= a.length; row += 1) {
      for (let column = 1; column <= b.length; column += 1) {
        const cost = a[row - 1] === b[column - 1] ? 0 : 1;
        matrix[row][column] = Math.min(
          matrix[row - 1][column] + 1,
          matrix[row][column - 1] + 1,
          matrix[row - 1][column - 1] + cost
        );
        if (row > 1 && column > 1 && a[row - 1] === b[column - 2] && a[row - 2] === b[column - 1]) {
          matrix[row][column] = Math.min(matrix[row][column], matrix[row - 2][column - 2] + 1);
        }
      }
    }
    return matrix[a.length][b.length];
  }

  function nearestCountry(value) {
    const query = normalise(value);
    if (query.length < 3) return null;
    let best = null;
    for (const item of aliases) {
      const distance = damerauLevenshtein(query, item.key);
      const longest = Math.max(query.length, item.key.length);
      const similarity = longest ? 1 - distance / longest : 1;
      if (!best || similarity > best.similarity || (similarity === best.similarity && distance < best.distance)) {
        best = { country: item.country, distance, similarity };
      }
    }
    const maximumDistance = query.length <= 6 ? 2 : query.length <= 11 ? 3 : 4;
    return best && best.distance <= maximumDistance && best.similarity >= .68 ? best.country : null;
  }

  function matchingCountries(value) {
    const query = normalise(value);
    if (!query) return [];
    const scores = new Map();
    for (const item of aliases) {
      let score = Infinity;
      if (item.key === query) score = 0;
      else if (item.key.startsWith(query)) score = 1 + item.key.length / 100;
      else if (item.key.includes(query)) score = 3 + item.key.indexOf(query) / 100;
      if (score < Infinity && (!scores.has(item.country.code) || score < scores.get(item.country.code).score)) {
        scores.set(item.country.code, { country: item.country, score });
      }
    }
    return [...scores.values()]
      .sort((a, b) => a.score - b.score || a.country.name.localeCompare(b.country.name))
      .slice(0, 6)
      .map(item => item.country);
  }

  function createAutocomplete({ input, clearButton, suggestions, submitButton, onSubmit, onFeedback, isDisabled = () => false }) {
    let selectedCountry = null;
    let activeSuggestion = -1;
    let pendingTypo = null;

    function hideSuggestions() {
      suggestions.classList.add("is-hidden");
      suggestions.innerHTML = "";
      input.setAttribute("aria-expanded", "false");
      activeSuggestion = -1;
    }

    function reset() {
      selectedCountry = null;
      pendingTypo = null;
      input.value = "";
      clearButton.classList.add("is-hidden");
      hideSuggestions();
    }

    function renderSuggestions() {
      if (isDisabled()) return;
      const matches = matchingCountries(input.value);
      activeSuggestion = -1;
      if (!matches.length) {
        hideSuggestions();
        return;
      }
      suggestions.innerHTML = matches.map((country, index) => `
        <button class="suggestion-button" type="button" role="option" data-code="${country.code}" data-index="${index}">
          <span>${escapeHtml(country.name)}</span><small>${country.code}</small>
        </button>`).join("");
      suggestions.classList.remove("is-hidden");
      input.setAttribute("aria-expanded", "true");
    }

    function choose(country) {
      if (!country) return;
      selectedCountry = country;
      pendingTypo = null;
      input.value = country.name;
      clearButton.classList.remove("is-hidden");
      hideSuggestions();
    }

    function attempt() {
      if (isDisabled()) return;
      const query = normalise(input.value);
      const exact = selectedCountry || exactCountry.get(query);
      if (exact) {
        onSubmit(exact);
        return;
      }
      const suggestion = nearestCountry(query);
      if (suggestion && pendingTypo?.code === suggestion.code) {
        onSubmit(suggestion);
        return;
      }
      if (suggestion) {
        pendingTypo = suggestion;
        input.value = suggestion.name;
        onFeedback(`Did you mean ${suggestion.name}?`, "Press Make guess again to confirm, or keep typing.");
        return;
      }
      onFeedback("Country not recognised.", "Choose a country from the suggestions before submitting.", "colder");
    }

    function moveSuggestion(direction) {
      const buttons = [...suggestions.querySelectorAll("button")];
      if (!buttons.length) return;
      activeSuggestion = (activeSuggestion + direction + buttons.length) % buttons.length;
      buttons.forEach((button, index) => button.classList.toggle("is-active", index === activeSuggestion));
      buttons[activeSuggestion].scrollIntoView({ block: "nearest" });
    }

    input.addEventListener("input", () => {
      selectedCountry = null;
      pendingTypo = null;
      clearButton.classList.toggle("is-hidden", !input.value);
      renderSuggestions();
    });
    input.addEventListener("keydown", event => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveSuggestion(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveSuggestion(-1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const buttons = [...suggestions.querySelectorAll("button")];
        if (activeSuggestion >= 0 && buttons[activeSuggestion]) buttons[activeSuggestion].click();
        else attempt();
      } else if (event.key === "Escape") {
        hideSuggestions();
      }
    });
    suggestions.addEventListener("click", event => {
      const button = event.target.closest("button[data-code]");
      if (button) choose(countryByCode.get(button.dataset.code));
    });
    clearButton.addEventListener("click", () => {
      reset();
      input.focus();
    });
    submitButton.addEventListener("click", attempt);
    document.addEventListener("click", event => {
      if (!event.target.closest(".search-area")) hideSuggestions();
    });

    return {
      reset,
      setDisabled(disabled) {
        input.disabled = disabled;
        clearButton.disabled = disabled;
        submitButton.disabled = disabled;
        if (disabled) hideSuggestions();
      },
      focus() { input.focus(); }
    };
  }

  function createGlobe({ stage, canvas, resetButton, zoomInButton, zoomOutButton, chip, getView }) {
    const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
    const projection = d3.geoOrthographic().clipAngle(90).precision(.45);
    const path = d3.geoPath(projection, context);
    const graticule = d3.geoGraticule10();
    const initialRotation = [-12, -13, 0];
    const pointers = new Map();
    let rotation = [...initialRotation];
    let currentZoom = 1;
    let renderQueued = false;
    let animation = 0;
    let gesture = null;
    let lastWidth = 0;
    let lastHeight = 0;
    let lastRatio = 0;
    let tap = null;

    function colours() {
      const css = getComputedStyle(document.documentElement);
      const get = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
      return {
        oceanHighlight: get("--globe-ocean-highlight", "#88abc0"),
        ocean: get("--globe-ocean", "#537a92"),
        oceanShadow: get("--globe-ocean-shadow", "#29495f"),
        land: get("--globe-land", "#d8d7ce"),
        border: get("--globe-border", "rgba(23,39,49,.34)"),
        grid: get("--globe-grid", "rgba(255,255,255,.16)"),
        rim: get("--globe-rim", "rgba(224,242,250,.82)"),
        ink: get("--ink", "#111820")
      };
    }

    function ratio() {
      return Math.min(window.devicePixelRatio || 1, matchMedia("(max-width:680px)").matches ? 1.25 : 1.6);
    }

    function resize(rect) {
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const pixelRatio = ratio();
      if (width !== lastWidth || height !== lastHeight || Math.abs(pixelRatio - lastRatio) > .01) {
        lastWidth = width;
        lastHeight = height;
        lastRatio = pixelRatio;
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      return { width, height };
    }

    function interacting() {
      return pointers.size > 0 || Boolean(animation);
    }

    function drawPath(feature, fill, stroke, width, shadow = false) {
      context.save();
      context.beginPath();
      path(feature);
      if (fill) {
        context.fillStyle = fill;
        context.fill("evenodd");
      }
      if (stroke) {
        context.strokeStyle = stroke;
        context.lineWidth = width;
        if (shadow && !interacting()) {
          context.shadowColor = "rgba(255,255,255,.72)";
          context.shadowBlur = 4;
        }
        context.stroke();
      }
      context.restore();
    }

    function visible(coordinate) {
      return d3.geoDistance([-rotation[0], -rotation[1]], coordinate) <= Math.PI / 2 + .015;
    }

    function drawPoint(feature, colour, latest, answer, theme) {
      const coordinate = feature.geometry.coordinates;
      if (!visible(coordinate)) return;
      const point = projection(coordinate);
      if (!point) return;
      context.save();
      context.beginPath();
      context.arc(point[0], point[1], latest || answer ? 5 : 4, 0, Math.PI * 2);
      context.fillStyle = colour;
      context.fill();
      context.strokeStyle = latest || answer ? "#fff" : theme.ink;
      context.lineWidth = latest || answer ? 2.2 : 1.15;
      context.stroke();
      context.restore();
    }

    function draw() {
      renderQueued = false;
      const rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const { width, height } = resize(rect);
      const theme = colours();
      const radius = Math.min(width, height) * .43 * currentZoom;
      projection.translate([width / 2, height / 2]).scale(radius).rotate(rotation).precision(interacting() ? 1.15 : .45);

      context.save();
      context.beginPath();
      context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
      context.fillStyle = theme.oceanShadow;
      if (!interacting()) {
        context.shadowColor = "rgba(8,19,29,.28)";
        context.shadowBlur = 22;
        context.shadowOffsetY = 13;
      }
      context.fill();
      context.restore();

      context.save();
      context.beginPath();
      context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
      context.clip();
      const gradient = context.createRadialGradient(width / 2 - radius * .34, height / 2 - radius * .3, radius * .05, width / 2, height / 2, radius * 1.05);
      gradient.addColorStop(0, theme.oceanHighlight);
      gradient.addColorStop(.58, theme.ocean);
      gradient.addColorStop(1, theme.oceanShadow);
      context.fillStyle = gradient;
      context.fillRect(width / 2 - radius, height / 2 - radius, radius * 2, radius * 2);
      context.restore();

      context.save();
      context.beginPath();
      path(graticule);
      context.strokeStyle = theme.grid;
      context.lineWidth = interacting() ? .45 : .7;
      context.stroke();
      context.restore();

      drawPath(polygonCollection, theme.land, theme.border, interacting() ? .45 : .68);

      const view = getView() || {};
      const guesses = view.guesses || [];
      const latestCode = guesses.at(-1)?.code || null;
      for (const guess of guesses) {
        const feature = featureByCode.get(guess.code);
        if (!feature || feature.geometry.type === "Point") continue;
        const latest = guess.code === latestCode;
        drawPath(feature, heatColour(guess.distance), latest ? theme.ink : "rgba(255,255,255,.78)", latest ? 2.25 : 1.15, latest);
      }

      if (view.finished && view.answerCode) {
        const answer = featureByCode.get(view.answerCode);
        if (answer && answer.geometry.type !== "Point") drawPath(answer, "#16845b", "#fff", 2.6, true);
      }

      for (const feature of pointFeatures) {
        const code = feature.properties.code;
        const guess = guesses.find(item => item.code === code);
        const answer = Boolean(view.finished && view.answerCode === code);
        if (!guess && !answer) continue;
        drawPoint(feature, answer ? "#16845b" : heatColour(guess.distance), code === latestCode, answer, theme);
      }

      context.save();
      context.beginPath();
      context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
      context.strokeStyle = theme.rim;
      context.lineWidth = 1.4;
      context.stroke();
      context.restore();
    }

    function queueRender() {
      if (renderQueued) return;
      renderQueued = true;
      requestAnimationFrame(draw);
    }

    function clampZoom(value) {
      return Math.max(.72, Math.min(4.8, value));
    }

    function shortestLongitude(from, to) {
      let delta = to - from;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      return from + delta;
    }

    function stopAnimation() {
      if (animation) cancelAnimationFrame(animation);
      animation = 0;
    }

    function animateView(targetRotation, targetZoom, duration = 420) {
      stopAnimation();
      const startRotation = [...rotation];
      const finalRotation = [shortestLongitude(rotation[0], targetRotation[0]), Math.max(-82, Math.min(82, targetRotation[1])), 0];
      const startZoom = currentZoom;
      const finalZoom = clampZoom(targetZoom);
      const started = performance.now();
      const tick = now => {
        const progress = Math.min(1, (now - started) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        rotation = [
          startRotation[0] + (finalRotation[0] - startRotation[0]) * eased,
          startRotation[1] + (finalRotation[1] - startRotation[1]) * eased,
          0
        ];
        currentZoom = startZoom + (finalZoom - startZoom) * eased;
        queueRender();
        if (progress < 1) animation = requestAnimationFrame(tick);
        else animation = 0;
      };
      animation = requestAnimationFrame(tick);
    }

    function focusCountry(code, targetZoom = 1.48, duration = 420) {
      const feature = featureByCode.get(code);
      if (!feature) return;
      const centroid = feature.geometry.type === "Point" ? feature.geometry.coordinates : d3.geoCentroid(feature);
      if (!centroid || !Number.isFinite(centroid[0])) return;
      animateView([-centroid[0], -centroid[1], 0], targetZoom, duration);
    }

    function pointerDistance(values) {
      const [a, b] = values;
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function guessedAt(clientX, clientY) {
      const view = getView() || {};
      const guesses = [...(view.guesses || [])].reverse();
      const rect = stage.getBoundingClientRect();
      const point = [clientX - rect.left, clientY - rect.top];
      const translate = projection.translate();
      const radius = projection.scale();
      if (Math.hypot(point[0] - translate[0], point[1] - translate[1]) > radius) return null;
      for (const guess of guesses) {
        const feature = featureByCode.get(guess.code);
        if (!feature || feature.geometry.type !== "Point" || !visible(feature.geometry.coordinates)) continue;
        const projected = projection(feature.geometry.coordinates);
        if (projected && Math.hypot(projected[0] - point[0], projected[1] - point[1]) <= 16) return guess;
      }
      const coordinate = projection.invert(point);
      if (!coordinate) return null;
      for (const guess of guesses) {
        const feature = featureByCode.get(guess.code);
        if (feature && feature.geometry.type !== "Point" && d3.geoContains(feature, coordinate)) return guess;
      }
      return null;
    }

    stage.addEventListener("pointerdown", event => {
      if (event.target.closest("button")) return;
      stopAnimation();
      stage.setPointerCapture?.(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) {
        gesture = { type: "rotate", startX: event.clientX, startY: event.clientY, rotation: [...rotation] };
        tap = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      } else if (pointers.size === 2) {
        gesture = { type: "pinch", distance: pointerDistance([...pointers.values()]), zoom: currentZoom };
        tap = null;
      }
    });

    stage.addEventListener("pointermove", event => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (tap && tap.id === event.pointerId && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 8) tap.moved = true;
      if (pointers.size >= 2) {
        const distance = pointerDistance([...pointers.values()].slice(0, 2));
        if (gesture?.type !== "pinch") gesture = { type: "pinch", distance, zoom: currentZoom };
        if (gesture.distance > 0) currentZoom = clampZoom(gesture.zoom * distance / gesture.distance);
        queueRender();
        return;
      }
      if (gesture?.type === "rotate") {
        const dx = event.clientX - gesture.startX;
        const dy = event.clientY - gesture.startY;
        const rect = stage.getBoundingClientRect();
        const sensitivity = 180 / Math.max(300, Math.min(rect.width, rect.height) * currentZoom);
        rotation = [gesture.rotation[0] + dx * sensitivity, Math.max(-82, Math.min(82, gesture.rotation[1] - dy * sensitivity)), 0];
        queueRender();
      }
    });

    const finishPointer = event => {
      const shouldTap = tap && tap.id === event.pointerId && !tap.moved && pointers.size === 1;
      const tapPoint = shouldTap ? { x: event.clientX, y: event.clientY } : null;
      pointers.delete(event.pointerId);
      if (pointers.size === 1) {
        const remaining = [...pointers.values()][0];
        gesture = { type: "rotate", startX: remaining.x, startY: remaining.y, rotation: [...rotation] };
      } else if (!pointers.size) {
        gesture = null;
        queueRender();
        if (tapPoint && chip) {
          const guess = guessedAt(tapPoint.x, tapPoint.y);
          chip.classList.toggle("is-hidden", !guess);
          const name = chip.querySelector("strong");
          if (name) name.textContent = guess?.name || countryByCode.get(guess?.code)?.name || "";
        }
      }
      tap = null;
    };

    stage.addEventListener("pointerup", finishPointer);
    stage.addEventListener("pointercancel", event => {
      pointers.delete(event.pointerId);
      gesture = null;
      tap = null;
    });
    stage.addEventListener("wheel", event => {
      event.preventDefault();
      stopAnimation();
      currentZoom = clampZoom(currentZoom * Math.exp(-event.deltaY * .0012));
      queueRender();
    }, { passive: false });
    zoomInButton?.addEventListener("click", () => { currentZoom = clampZoom(currentZoom * 1.25); queueRender(); });
    zoomOutButton?.addEventListener("click", () => { currentZoom = clampZoom(currentZoom / 1.25); queueRender(); });
    resetButton?.addEventListener("click", () => animateView(initialRotation, 1));
    new ResizeObserver(queueRender).observe(stage);

    return {
      queueRender,
      focusCountry,
      zoom: () => currentZoom,
      reset: () => animateView(initialRotation, 1)
    };
  }

  window.NEARER_TOGETHER_CORE = {
    d3,
    gameData,
    countries,
    countryByCode,
    featureByCode,
    normalise,
    escapeHtml,
    displayDistance,
    heatColour,
    closest,
    trend,
    createAutocomplete,
    createGlobe
  };
})();
