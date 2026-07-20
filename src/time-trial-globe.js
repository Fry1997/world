function mix(first, second, amount) {
  const a = first.match(/\w\w/g).map(value => parseInt(value, 16));
  const b = second.match(/\w\w/g).map(value => parseInt(value, 16));
  return `rgb(${a.map((value, index) => Math.round(value + (b[index] - value) * amount)).join(" ")})`;
}

function heat(distance) {
  const closeness = 1 - Math.min(Math.max(Number(distance || 0), 0), 9000) / 9000;
  const eased = Math.pow(closeness, .72);
  return eased < .58 ? mix("54748d", "c37458", eased / .58) : mix("c37458", "e7ad4e", (eased - .58) / .42);
}

export function createTimeTrialGlobe(canvas, gameData, geoData, d3) {
  const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
  const countries = new Map(gameData.countries.map(country => [country.code, country]));
  const features = geoData.features.filter(feature => countries.has(feature.properties.code));
  const projection = d3.geoOrthographic().clipAngle(90).precision(.5);
  const path = d3.geoPath(projection, context);
  const sphere = { type: "Sphere" };
  const graticule = d3.geoGraticule10();
  const state = { guesses: [], rotation: [-12, -13, 0], dragging: null, queued: false };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, matchMedia("(max-width:700px)").matches ? 1.7 : 2);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    projection.translate([width / 2, height / 2]).scale(Math.min(width, height) * .43).rotate(state.rotation);
    return { width, height };
  }

  function drawFeature(feature, fill, stroke = "rgba(24,39,50,.58)", width = .65) {
    context.beginPath();
    path(feature);
    context.fillStyle = fill;
    context.fill("evenodd");
    context.strokeStyle = stroke;
    context.lineWidth = width;
    context.stroke();
  }

  function draw() {
    state.queued = false;
    if (!canvas.isConnected || document.hidden) return;
    const { width, height } = resize();
    context.clearRect(0, 0, width, height);
    const radius = Math.min(width, height) * .43;
    const ocean = context.createRadialGradient(width * .62, height * .28, radius * .04, width / 2, height / 2, radius * 1.05);
    ocean.addColorStop(0, "#315a74");
    ocean.addColorStop(.5, "#12364f");
    ocean.addColorStop(1, "#020d16");
    context.save();
    context.beginPath();
    context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    context.shadowColor = "rgba(0,5,10,.7)";
    context.shadowBlur = 28;
    context.shadowOffsetY = 14;
    context.fillStyle = ocean;
    context.fill();
    context.restore();

    context.beginPath();
    path(graticule);
    context.strokeStyle = "rgba(216,238,247,.08)";
    context.lineWidth = .55;
    context.stroke();

    const byCode = new Map(state.guesses.map(guess => [guess.code, guess]));
    for (const feature of features) {
      const guess = byCode.get(feature.properties.code);
      drawFeature(feature, guess ? heat(guess.distance) : "#ded7cb");
    }

    context.beginPath();
    path(sphere);
    context.strokeStyle = "rgba(224,241,249,.34)";
    context.lineWidth = 1.2;
    context.stroke();
  }

  function queue() {
    if (state.queued) return;
    state.queued = true;
    requestAnimationFrame(draw);
  }

  function pointerDown(event) {
    canvas.setPointerCapture(event.pointerId);
    state.dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, rotation: [...state.rotation] };
  }

  function pointerMove(event) {
    if (!state.dragging || state.dragging.id !== event.pointerId) return;
    const dx = event.clientX - state.dragging.x;
    const dy = event.clientY - state.dragging.y;
    state.rotation = [state.dragging.rotation[0] + dx * .28, Math.max(-80, Math.min(80, state.dragging.rotation[1] - dy * .24)), 0];
    queue();
  }

  function pointerUp(event) {
    if (state.dragging?.id === event.pointerId) state.dragging = null;
  }

  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);
  const observer = new ResizeObserver(queue);
  observer.observe(canvas);
  queue();

  return {
    setGuesses(guesses) { state.guesses = guesses || []; queue(); },
    focusCode(code) {
      const country = countries.get(code);
      if (!country?.fallback) return;
      state.rotation = [-country.fallback[0], -country.fallback[1], 0];
      queue();
    },
    destroy() { observer.disconnect(); }
  };
}
