(() => {
  "use strict";
  if (window.__NEARER_EXPERIENCE10_STARTED) return;

  const body = document.body;
  body.classList.add("experience-ten");
  document.documentElement.dataset.nearerExperience = "10";

  const resultDialog = document.getElementById("resultDialog");
  const syncResultState = () => body.classList.toggle("result-open", Boolean(resultDialog?.open));
  if (resultDialog) {
    new MutationObserver(syncResultState).observe(resultDialog, { attributes: true, attributeFilter: ["open"] });
    syncResultState();
  }

  if (location.pathname.includes("/together/duel/")) {
    const reset = document.getElementById("globeReset");
    if (reset) {
      reset.setAttribute("aria-label", "Centre on your defended country");
      reset.title = "Centre on your defended country";
      reset.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';
    }

    const hint = document.querySelector(".globe-hint");
    if (hint) hint.textContent = "Distance colours: your route · graphite: opponent route · coral: your country";

    const renameLegend = (selector, label) => {
      const node = document.querySelector(selector);
      if (!node) return;
      const marker = node.querySelector("i");
      node.replaceChildren();
      if (marker) node.append(marker);
      node.append(document.createTextNode(label));
    };
    renameLegend(".duel-route-legend .you", "Your distance route");
    renameLegend(".duel-route-legend .opponent", "Opponent route");
  }

  window.__NEARER_EXPERIENCE10_STARTED = true;
})();
