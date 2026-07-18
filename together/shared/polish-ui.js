(() => {
  "use strict";

  const path = location.pathname;
  const mode = path.includes("/cooperative/") ? "cooperative" : path.includes("/duel/") ? "duel" : path.includes("/race/") ? "race" : null;
  if (!mode) return;

  const config = {
    cooperative: { key: "nearer-cooperative-relay-v1", playerCard: ".mode-player-card", result: ".mode-result-stat" },
    duel: { key: "nearer-hidden-country-duel-v1", playerCard: ".mode-player-card", result: ".mode-result-stat" },
    race: { key: "nearer-pass-race-v2", playerCard: ".race-player-card", result: ".race-result-stat" }
  }[mode];

  const colours = ["var(--player-1)", "var(--player-2)", "var(--player-3)", "var(--player-4)", "var(--player-5)", "var(--player-6)"];
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lastFeedback = "";
  let lastDialogSignature = "";
  let refreshQueued = false;

  function state() {
    try { return JSON.parse(localStorage.getItem(config.key) || "null"); }
    catch { return null; }
  }

  function initials(name) {
    const words = String(name || "Player").trim().split(/\s+/).filter(Boolean);
    return (words.length > 1 ? words[0][0] + words.at(-1)[0] : words[0]?.slice(0, 2) || "P").toUpperCase();
  }

  function avatar(player, index) {
    const span = document.createElement("span");
    span.className = "player-avatar";
    span.style.setProperty("--player-colour", colours[index % colours.length]);
    span.textContent = initials(player?.name || `Player ${index + 1}`);
    span.setAttribute("aria-hidden", "true");
    return span;
  }

  function closest(guesses) {
    return guesses?.length ? [...guesses].sort((a, b) => a.distance - b.distance || a.order - b.order)[0] : null;
  }

  function distance(value, units = "km") {
    if (value === null || value === undefined) return "No signal";
    if (value === 0) return "Found";
    return units === "mi" ? `${Math.round(value * .621371).toLocaleString()} mi` : `${Math.round(value).toLocaleString()} km`;
  }

  function decoratePlayers() {
    const current = state();
    if (!current?.players) return;
    const cards = [...document.querySelectorAll(config.playerCard)];
    cards.forEach((card, index) => {
      const player = current.players[index];
      const top = card.querySelector(".mode-player-card-top,.race-player-card-top");
      card.style.setProperty("--player-colour", colours[index % colours.length]);
      if (top && !top.querySelector(".player-avatar")) top.prepend(avatar(player, index));
    });

    const rankable = current.players.map((player, index) => ({ index, best: closest(player.guesses || []) })).filter(item => item.best && item.best.distance > 0);
    const leaderIndex = (mode === "race" || mode === "duel") && rankable.length
      ? rankable.sort((a, b) => a.best.distance - b.best.distance)[0].index
      : -1;
    cards.forEach((card, index) => {
      card.classList.toggle("is-leading", index === leaderIndex);
      const top = card.querySelector(".mode-player-card-top,.race-player-card-top");
      const existing = top?.querySelector(".polish-status");
      if (index === leaderIndex && top) {
        if (!existing) {
          const badge = document.createElement("span");
          badge.className = "polish-status";
          badge.textContent = mode === "duel" ? "Closest hunt" : "Leading";
          top.append(badge);
        }
      } else if (existing) existing.remove();
    });

    document.querySelectorAll(".pass-standing").forEach((item, index) => {
      if (!current.players[index] || item.querySelector(".player-avatar")) return;
      item.classList.add("has-player");
      item.style.setProperty("--player-colour", colours[index % colours.length]);
      item.prepend(avatar(current.players[index], index));
    });

    document.querySelectorAll(config.result).forEach((item, index) => {
      if (!current.players[index] || item.querySelector(".player-avatar")) return;
      item.classList.add("has-player");
      item.style.setProperty("--player-colour", colours[index % colours.length]);
      item.prepend(avatar(current.players[index], index));
    });

    decorateHistory(current);
  }

  function decorateHistory(current) {
    const rows = [...document.querySelectorAll(".guess-row")];
    if (!rows.length) return;
    if (mode === "cooperative") {
      const guesses = [...(current.guesses || [])].reverse();
      rows.forEach((row, index) => {
        const playerIndex = guesses[index]?.playerIndex ?? 0;
        row.style.setProperty("--player-colour", colours[playerIndex % colours.length]);
      });
      return;
    }
    const playerIndex = current.currentPlayer || 0;
    rows.forEach(row => row.style.setProperty("--player-colour", colours[playerIndex % colours.length]));
  }

  function closerStreak(guesses) {
    let streak = 0;
    for (let index = guesses.length - 1; index > 0; index -= 1) {
      if (guesses[index].distance < guesses[index - 1].distance) streak += 1;
      else break;
    }
    return streak;
  }

  function updateMomentum() {
    if (mode !== "cooperative") return;
    const current = state();
    const scoreboard = document.getElementById("scoreboard");
    if (!current || !scoreboard) return;
    let banner = document.querySelector(".polish-momentum");
    if (!banner) {
      banner = document.createElement("div");
      banner.className = "polish-momentum";
      banner.innerHTML = '<span class="polish-momentum-dot" aria-hidden="true"></span><span></span>';
      scoreboard.before(banner);
    }
    const guesses = current.guesses || [];
    const best = closest(guesses);
    const streak = closerStreak(guesses);
    const text = !guesses.length
      ? "The first player will establish the team’s opening signal."
      : streak >= 2
        ? `<strong>${streak} closer moves in a row.</strong> Team best: ${distance(best.distance, current.units)}.`
        : `<strong>Team best: ${distance(best.distance, current.units)}.</strong> Every player is building the same route.`;
    const copy = banner.querySelector("span:last-child");
    if (copy.innerHTML !== text) copy.innerHTML = text;
  }

  function updatePassCopy() {
    const current = state();
    const pass = document.getElementById("passScreen");
    const copy = document.getElementById("passCopy");
    if (!current || !pass || pass.classList.contains("is-hidden") || !copy) return;
    if (mode === "cooperative") {
      const best = closest(current.guesses || []);
      if (best) {
        const next = `The shared route stays visible. The team is currently within ${distance(best.distance, current.units)} of the target.`;
        if (copy.textContent !== next) copy.textContent = next;
      }
    } else if (mode === "duel" && current.revealsComplete) {
      const opponent = current.players?.[1 - current.currentPlayer];
      const best = closest(opponent?.guesses || []);
      if (best) {
        const next = `The previous hunt is hidden. Your opponent has come within ${distance(best.distance, current.units)} of your country.`;
        if (copy.textContent !== next) copy.textContent = next;
      }
    } else if (mode === "race") {
      const ranked = (current.players || []).map(player => closest(player.guesses || [])).filter(Boolean).sort((a, b) => a.distance - b.distance);
      if (ranked[0]) {
        const next = `Private routes are hidden. The leading signal is ${distance(ranked[0].distance, current.units)} from the target.`;
        if (copy.textContent !== next) copy.textContent = next;
      }
    }
  }

  function biggestLeap(guesses) {
    let best = null;
    for (let index = 1; index < guesses.length; index += 1) {
      const closed = guesses[index - 1].distance - guesses[index].distance;
      if (closed > 0 && (!best || closed > best.closed)) best = { closed, guess: guesses[index], previous: guesses[index - 1] };
    }
    return best;
  }

  function highlight(label, value) {
    const item = document.createElement("div");
    item.className = "polish-highlight";
    item.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    return item;
  }

  function updateResultHighlights() {
    const dialog = document.getElementById("resultDialog");
    if (!dialog?.open) return;
    const current = state();
    if (!current) return;
    const signature = JSON.stringify([current.updatedAt, current.result, current.status]);
    if (signature === lastDialogSignature && dialog.querySelector(".polish-highlights")) return;
    lastDialogSignature = signature;
    dialog.querySelector(".polish-highlights")?.remove();
    const grid = document.createElement("div");
    grid.className = "polish-highlights";

    if (mode === "cooperative") {
      const guesses = current.guesses || [];
      const opening = guesses[0];
      const finisher = guesses.at(-1);
      const setup = guesses.length > 1 ? guesses.at(-2) : null;
      if (opening) grid.append(highlight("Opening clue", `${opening.name} · ${distance(opening.distance, current.units)}`));
      if (setup && finisher?.distance === 0) grid.append(highlight("Final setup", `${current.players[setup.playerIndex].name} left the team ${distance(setup.distance, current.units)} away`));
      if (finisher) grid.append(highlight("Finishing move", `${current.players[finisher.playerIndex].name} chose ${finisher.name}`));
      const streak = closerStreak(guesses);
      if (streak >= 2) grid.append(highlight("Team momentum", `${streak} consecutive closer moves`));
    } else if (mode === "duel") {
      current.players.forEach(player => {
        const leap = biggestLeap(player.guesses || []);
        if (leap) grid.append(highlight(`${player.name}’s best move`, `Closed ${distance(leap.closed, current.units)} with ${leap.guess.name}`));
        else {
          const best = closest(player.guesses || []);
          if (best) grid.append(highlight(`${player.name}’s closest`, `${best.name} · ${distance(best.distance, current.units)}`));
        }
      });
    } else {
      const sorted = (current.players || []).map((player, index) => ({ player, index, best: closest(player.guesses || []) })).filter(item => item.best).sort((a, b) => a.best.distance - b.best.distance);
      if (sorted[0]) grid.append(highlight("Strongest route", `${sorted[0].player.name} reached ${distance(sorted[0].best.distance, current.units)}`));
      if (sorted[1]) grid.append(highlight("Closest challenger", `${sorted[1].player.name} reached ${distance(sorted[1].best.distance, current.units)}`));
    }

    if (!grid.children.length) return;
    const buttons = dialog.querySelector(".dialog-button-row");
    if (buttons) buttons.before(grid); else dialog.append(grid);
    decoratePlayers();
  }

  function animateFeedback() {
    const panel = document.getElementById("feedbackPanel") || document.getElementById("raceFeedback");
    if (!panel) return;
    const signature = panel.textContent.trim();
    if (!signature || signature === lastFeedback) return;
    lastFeedback = signature;
    panel.classList.remove("is-polish-pop");
    void panel.offsetWidth;
    panel.classList.add("is-polish-pop");
    if (!reducedMotion && navigator.vibrate && (panel.classList.contains("is-warmer") || panel.classList.contains("is-success"))) {
      navigator.vibrate(panel.classList.contains("is-success") ? [35, 30, 55] : 25);
    }
  }

  function refresh() {
    decoratePlayers();
    updateMomentum();
    updatePassCopy();
    updateResultHighlights();
    animateFeedback();
  }

  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      refresh();
    });
  }

  const observer = new MutationObserver(queueRefresh);
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "open"] });
  window.addEventListener("storage", queueRefresh);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) queueRefresh(); });
  refresh();
  window.__NEARER_TOGETHER_POLISH_STARTED = true;
})();
