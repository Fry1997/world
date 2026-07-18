(() => {
  "use strict";

  const gameData = window.NEARER_GAME_DATA;
  const input = document.getElementById("countryInput");
  const guessButton = document.getElementById("guessButton");
  const searchArea = document.querySelector(".search-area");
  const globeStage = document.getElementById("globeStage");

  if (!gameData || !input || !guessButton || !searchArea) return;

  const normalise = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  const entries = gameData.countries.flatMap(country => {
    const names = [country.name, country.code, ...(country.aliases || [])];
    return names.map(name => ({ country, normalised: normalise(name) }));
  });

  const exactByName = new Map(entries.map(entry => [entry.normalised, entry.country]));

  function damerauLevenshtein(a, b) {
    const rows = a.length + 1;
    const cols = b.length + 1;
    const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

    for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
    for (let column = 0; column < cols; column += 1) matrix[0][column] = column;

    for (let row = 1; row < rows; row += 1) {
      for (let column = 1; column < cols; column += 1) {
        const cost = a[row - 1] === b[column - 1] ? 0 : 1;
        matrix[row][column] = Math.min(
          matrix[row - 1][column] + 1,
          matrix[row][column - 1] + 1,
          matrix[row - 1][column - 1] + cost
        );

        if (
          row > 1 &&
          column > 1 &&
          a[row - 1] === b[column - 2] &&
          a[row - 2] === b[column - 1]
        ) {
          matrix[row][column] = Math.min(
            matrix[row][column],
            matrix[row - 2][column - 2] + 1
          );
        }
      }
    }

    return matrix[a.length][b.length];
  }

  function nearestCountry(value) {
    const query = normalise(value);
    if (query.length < 3) return null;

    let best = null;

    for (const entry of entries) {
      const distance = damerauLevenshtein(query, entry.normalised);
      const longest = Math.max(query.length, entry.normalised.length);
      const similarity = longest ? 1 - distance / longest : 1;

      if (
        !best ||
        similarity > best.similarity ||
        (similarity === best.similarity && distance < best.distance)
      ) {
        best = { country: entry.country, distance, similarity };
      }
    }

    if (!best) return null;

    const maximumDistance = query.length <= 6 ? 2 : query.length <= 11 ? 3 : 4;
    return best.distance <= maximumDistance && best.similarity >= 0.68
      ? best.country
      : null;
  }

  const style = document.createElement("style");
  style.dataset.nearerGuessRules = "20260718-name-only1";
  style.textContent = `
    .globe-country,
    .globe-country-point {
      pointer-events: none !important;
      cursor: grab !important;
    }

    .globe-tooltip,
    .globe-selection {
      display: none !important;
    }

    .did-you-mean {
      margin-top: 10px;
      padding: 12px 13px;
      border: 1px solid var(--line);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: var(--panel-strong);
      color: var(--ink-soft);
      font-size: .78rem;
    }

    .did-you-mean strong {
      color: var(--ink);
    }

    .did-you-mean-actions {
      display: flex;
      gap: 7px;
      flex: 0 0 auto;
    }

    .did-you-mean button {
      min-height: 34px;
      padding: 0 11px;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: var(--panel);
      color: var(--ink);
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    .did-you-mean button[data-accept] {
      border-color: var(--ink);
      background: var(--ink);
      color: var(--bg);
    }

    @media (max-width: 520px) {
      .did-you-mean {
        align-items: flex-start;
        flex-direction: column;
      }

      .did-you-mean-actions {
        width: 100%;
      }

      .did-you-mean button {
        flex: 1;
      }
    }
  `;
  document.head.appendChild(style);

  let promptNode = null;
  let bypassOnce = false;

  function clearPrompt() {
    promptNode?.remove();
    promptNode = null;
  }

  function showPrompt(country) {
    clearPrompt();

    promptNode = document.createElement("div");
    promptNode.className = "did-you-mean";
    promptNode.setAttribute("role", "status");
    promptNode.innerHTML = `
      <span>Did you mean <strong></strong>?</span>
      <span class="did-you-mean-actions">
        <button type="button" data-dismiss>Keep typing</button>
        <button type="button" data-accept>Use this name</button>
      </span>
    `;

    promptNode.querySelector("strong").textContent = country.name;
    promptNode.querySelector("[data-dismiss]").addEventListener("click", () => {
      clearPrompt();
      input.focus();
    });
    promptNode.querySelector("[data-accept]").addEventListener("click", () => {
      input.value = country.name;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      clearPrompt();
      bypassOnce = true;
      guessButton.click();
    });

    searchArea.appendChild(promptNode);
  }

  function shouldBlockGuess() {
    if (bypassOnce) {
      bypassOnce = false;
      return false;
    }

    const query = normalise(input.value);
    if (!query || exactByName.has(query)) {
      clearPrompt();
      return false;
    }

    const suggestion = nearestCountry(query);
    if (!suggestion) {
      clearPrompt();
      return false;
    }

    showPrompt(suggestion);
    return true;
  }

  guessButton.addEventListener("click", event => {
    if (!shouldBlockGuess()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener("keydown", event => {
    if (event.target !== input || event.key !== "Enter") return;
    if (!shouldBlockGuess()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  input.addEventListener("input", clearPrompt);

  if (globeStage) {
    globeStage.setAttribute(
      "aria-label",
      "Interactive 3D globe showing the results of named guesses. Drag to rotate and pinch or scroll to zoom. Countries cannot be selected from the globe."
    );
  }
})();
