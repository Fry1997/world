const MIN_ZOOM = 0.78;
const MAX_ZOOM = 18;

function clampZoom(value) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

export function createAtlasGlobe({ d3, model, onSelect }) {
  const stage = document.getElementById('atlasGlobeStage');
  const canvas = document.getElementById('atlasGlobeCanvas');
  const zoomIn = document.getElementById('atlasZoomIn');
  const zoomOut = document.getElementById('atlasZoomOut');
  const zoomLabel = document.getElementById('atlasZoomLabel');
  const resetButton = document.getElementById('atlasResetButton');
  const focusButton = document.getElementById('atlasFocusButton');
  const context = canvas?.getContext('2d', { alpha: true, desynchronized: true });
  if (!stage || !canvas || !context) throw new Error('The Atlas globe surface is unavailable.');

  const projection = d3.geoOrthographic().clipAngle(90).precision(.38);
  const path = d3.geoPath(projection, context);
  const graticule = d3.geoGraticule10();
  const pointers = new Map();
  const initialRotation = [-12, -13, 0];
  let rotation = [...initialRotation];
  let zoom = 1;
  let selectedCode = null;
  let gesture = null;
  let queued = false;
  let animation = 0;
  let width = 0;
  let height = 0;
  let ratio = 1;

  function updateZoomLabel() {
    if (zoomLabel) zoomLabel.textContent = `${zoom.toFixed(1)}×`;
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(rect.width));
    const nextHeight = Math.max(1, Math.round(rect.height));
    const nextRatio = Math.min(devicePixelRatio || 1, matchMedia('(max-width:820px)').matches ? 2.15 : 2);
    if (nextWidth !== width || nextHeight !== height || Math.abs(nextRatio - ratio) > .01) {
      width = nextWidth;
      height = nextHeight;
      ratio = nextRatio;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
  }

  function visible(coordinate) {
    return d3.geoDistance([-rotation[0], -rotation[1]], coordinate) <= Math.PI / 2 + .015;
  }

  function drawPath(feature, fill, stroke, lineWidth = 1, alpha = 1) {
    context.save();
    context.globalAlpha = alpha;
    context.beginPath();
    path(feature);
    if (fill) {
      context.fillStyle = fill;
      context.fill('evenodd');
    }
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = lineWidth;
      context.stroke();
    }
    context.restore();
  }

  function featurePoint(feature) {
    const coordinate = feature.geometry.type === 'Point' ? feature.geometry.coordinates : d3.geoCentroid(feature);
    if (!visible(coordinate)) return null;
    return projection(coordinate);
  }

  function drawLabels() {
    if (zoom < 3.4) return;
    const occupied = new Set();
    const threshold = zoom < 5 ? 42 : zoom < 9 ? 24 : 12;
    const candidates = model.features
      .map(feature => {
        const point = featurePoint(feature);
        if (!point) return null;
        let size = 0;
        if (feature.geometry.type !== 'Point') {
          const bounds = path.bounds(feature);
          size = Math.max(bounds[1][0] - bounds[0][0], bounds[1][1] - bounds[0][1]);
        }
        return { feature, point, size };
      })
      .filter(Boolean)
      .sort((a, b) => (b.feature.properties.code === selectedCode) - (a.feature.properties.code === selectedCode) || b.size - a.size);

    context.save();
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (const item of candidates) {
      const selected = item.feature.properties.code === selectedCode;
      if (!selected && item.size < threshold && item.feature.geometry.type !== 'Point') continue;
      if (!selected && item.feature.geometry.type === 'Point' && zoom < 6.5) continue;
      const cell = `${Math.round(item.point[0] / 58)}:${Math.round(item.point[1] / 24)}`;
      if (!selected && occupied.has(cell)) continue;
      occupied.add(cell);
      context.font = `${selected ? 800 : 700} ${selected ? 12 : 10}px system-ui, sans-serif`;
      context.lineWidth = selected ? 4 : 3;
      context.strokeStyle = 'rgba(3,12,20,.82)';
      context.fillStyle = selected ? '#fff5df' : 'rgba(255,250,242,.78)';
      const name = item.feature.properties.name;
      context.strokeText(name, item.point[0], item.point[1]);
      context.fillText(name, item.point[0], item.point[1]);
    }
    context.restore();
  }

  function draw() {
    queued = false;
    if (document.hidden || !stage.isConnected) return;
    resize();
    const radius = Math.min(width, height) * .425 * zoom;
    projection
      .translate([width / 2, height / 2])
      .scale(radius)
      .rotate(rotation)
      .precision(Math.max(.045, .4 / Math.sqrt(zoom)));

    const x = width / 2;
    const y = height / 2;
    context.save();
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = '#020d16';
    context.shadowColor = 'rgba(0,5,10,.72)';
    context.shadowBlur = 28;
    context.shadowOffsetY = 15;
    context.fill();
    context.restore();

    context.save();
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.clip();
    const ocean = context.createRadialGradient(x + radius * .3, y - radius * .34, radius * .02, x, y, radius * 1.14);
    ocean.addColorStop(0, '#315f7d');
    ocean.addColorStop(.48, '#12374f');
    ocean.addColorStop(1, '#020b12');
    context.fillStyle = ocean;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    context.restore();

    context.save();
    context.beginPath();
    path(graticule);
    context.strokeStyle = 'rgba(212,235,247,.085)';
    context.lineWidth = .6;
    context.stroke();
    context.restore();

    const land = context.createLinearGradient(width * .18, height * .12, width * .82, height * .9);
    land.addColorStop(0, '#f2ebdf');
    land.addColorStop(.55, '#ded6ca');
    land.addColorStop(1, '#b8b1a8');
    drawPath(model.worldCollection, land, 'rgba(28,43,54,.62)', zoom > 7 ? .45 : .72);

    if (selectedCode) {
      const selected = model.featureByCode.get(selectedCode);
      if (selected?.geometry.type === 'Point') {
        const point = featurePoint(selected);
        if (point) {
          context.save();
          context.beginPath();
          context.arc(point[0], point[1], 6, 0, Math.PI * 2);
          context.fillStyle = '#ff8063';
          context.fill();
          context.strokeStyle = '#fff5e8';
          context.lineWidth = 2.2;
          context.stroke();
          context.restore();
        }
      } else if (selected) {
        drawPath(selected, '#e87a60', '#fff6e9', Math.max(1.5, 2.6 / Math.sqrt(zoom)), .95);
      }
    }

    if (zoom >= 4.5) {
      for (const feature of model.points) {
        if (feature.properties.code === selectedCode) continue;
        const point = featurePoint(feature);
        if (!point) continue;
        context.save();
        context.beginPath();
        context.arc(point[0], point[1], 2.7, 0, Math.PI * 2);
        context.fillStyle = 'rgba(246,239,229,.72)';
        context.fill();
        context.restore();
      }
    }

    drawLabels();
    context.save();
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.strokeStyle = 'rgba(222,240,250,.35)';
    context.lineWidth = 1.5;
    context.stroke();
    context.restore();
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(draw);
  }

  function hitCountry(clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    const local = [clientX - rect.left, clientY - rect.top];
    const translate = projection.translate();
    if (Math.hypot(local[0] - translate[0], local[1] - translate[1]) > projection.scale()) return null;
    for (const feature of model.points) {
      const point = featurePoint(feature);
      if (point && Math.hypot(point[0] - local[0], point[1] - local[1]) <= (zoom > 6 ? 14 : 10)) return feature.properties.code;
    }
    const coordinate = projection.invert(local);
    if (!coordinate) return null;
    return model.polygons.find(feature => d3.geoContains(feature, coordinate))?.properties.code || null;
  }

  function focusZoom(country) {
    const area = Number(country?.area) || 0;
    if (area < 1_000) return 14;
    if (area < 10_000) return 10;
    if (area < 100_000) return 6;
    if (area < 500_000) return 4;
    return 2.35;
  }

  function animateTo(targetRotation, targetZoom, duration = 700) {
    cancelAnimationFrame(animation);
    const startRotation = [...rotation];
    const startZoom = zoom;
    const start = performance.now();
    const difference = (from, to) => ((to - from + 540) % 360) - 180;
    const frame = now => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      rotation = startRotation.map((value, index) => value + difference(value, targetRotation[index]) * eased);
      zoom = startZoom + (targetZoom - startZoom) * eased;
      updateZoomLabel();
      queue();
      if (progress < 1) animation = requestAnimationFrame(frame);
      else animation = 0;
    };
    animation = requestAnimationFrame(frame);
  }

  function focusCountry(code, requestedZoom = null) {
    const country = model.countryByCode.get(code);
    const coordinate = model.coordinateFor(code);
    if (!country || !coordinate) return;
    animateTo([-coordinate[0], -coordinate[1], 0], clampZoom(requestedZoom || focusZoom(country)));
  }

  function setSelected(code, options = {}) {
    selectedCode = code || null;
    if (focusButton) focusButton.disabled = !selectedCode;
    if (selectedCode && options.focus) focusCountry(selectedCode, options.zoom);
    else queue();
  }

  function pointerDistance() {
    const values = [...pointers.values()];
    return values.length > 1 ? Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y) : 0;
  }

  stage.addEventListener('pointerdown', event => {
    if (event.target.closest('button')) return;
    event.preventDefault();
    stage.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    gesture = { x: event.clientX, y: event.clientY, rotation: [...rotation], zoom, distance: pointerDistance(), moved: false };
  }, { passive: false });

  stage.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size > 1) {
      const distance = pointerDistance();
      if (gesture.distance > 0) zoom = clampZoom(gesture.zoom * distance / gesture.distance);
      gesture.moved = true;
      updateZoomLabel();
      queue();
      return;
    }
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (Math.hypot(dx, dy) > 5) gesture.moved = true;
    const sensitivity = 190 / Math.max(330, Math.min(width, height) * Math.sqrt(zoom));
    rotation = [gesture.rotation[0] + dx * sensitivity, Math.max(-84, Math.min(84, gesture.rotation[1] - dy * sensitivity)), 0];
    queue();
  }, { passive: false });

  function release(event) {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault();
    const tap = pointers.size === 1 && gesture && !gesture.moved;
    pointers.delete(event.pointerId);
    if (tap) {
      const code = hitCountry(event.clientX, event.clientY);
      if (code) onSelect(code, { source: 'globe' });
    }
    if (!pointers.size) gesture = null;
  }

  stage.addEventListener('pointerup', release, { passive: false });
  stage.addEventListener('pointercancel', release, { passive: false });
  stage.addEventListener('wheel', event => {
    event.preventDefault();
    zoom = clampZoom(zoom * Math.exp(-event.deltaY * .00135));
    updateZoomLabel();
    queue();
  }, { passive: false });
  stage.addEventListener('dblclick', event => {
    const code = hitCountry(event.clientX, event.clientY);
    if (code) {
      onSelect(code, { source: 'globe' });
      focusCountry(code);
    }
  });
  stage.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') rotation[0] -= 7 / Math.sqrt(zoom);
    if (event.key === 'ArrowRight') rotation[0] += 7 / Math.sqrt(zoom);
    if (event.key === 'ArrowUp') rotation[1] = Math.min(84, rotation[1] + 6 / Math.sqrt(zoom));
    if (event.key === 'ArrowDown') rotation[1] = Math.max(-84, rotation[1] - 6 / Math.sqrt(zoom));
    if (event.key === '+' || event.key === '=') zoom = clampZoom(zoom * 1.32);
    if (event.key === '-') zoom = clampZoom(zoom / 1.32);
    updateZoomLabel();
    queue();
  });

  zoomIn?.addEventListener('click', () => { zoom = clampZoom(zoom * 1.42); updateZoomLabel(); queue(); });
  zoomOut?.addEventListener('click', () => { zoom = clampZoom(zoom / 1.42); updateZoomLabel(); queue(); });
  resetButton?.addEventListener('click', () => animateTo([...initialRotation], 1));
  focusButton?.addEventListener('click', () => selectedCode && focusCountry(selectedCode));
  new ResizeObserver(queue).observe(stage);

  updateZoomLabel();
  queue();
  return { setSelected, focusCountry, reset: () => animateTo([...initialRotation], 1), queue };
}
