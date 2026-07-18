(() => {
  "use strict";

  const path = location.pathname;
  const isTogether = path.includes("/together/") && !path.endsWith("/together/");
  const mode = path.includes("/cooperative/") ? "relay" : path.includes("/duel/") ? "duel" : path.includes("/race/") ? "race" : "solo";
  const body = document.body;
  const mobileQuery = matchMedia("(max-width: 820px)");
  const viewport = window.visualViewport;

  body.classList.add(isTogether ? "together-experience" : "solo-experience", `mode-${mode}`, "experience-three");
  body.classList.remove("composer-active", "keyboard-open", "composer-scroll-locked");
  body.style.top = "";
  document.documentElement.dataset.nearerExperience = "3";

  const input = document.getElementById("countryInput");
  const panel = document.querySelector(".race-guess-panel,.mode-guess-panel,.guess-panel");

  const syncViewport = () => {
    const height = viewport?.height || window.innerHeight;
    document.documentElement.style.setProperty("--experience3-visual-height", `${Math.round(height)}px`);
  };

  if (input && panel) {
    input.addEventListener("focus", () => {
      if (!mobileQuery.matches) return;
      body.classList.add("country-input-focused");
      syncViewport();
    });

    input.addEventListener("blur", () => {
      setTimeout(() => {
        if (panel.contains(document.activeElement)) return;
        body.classList.remove("country-input-focused");
      }, 140);
    });
  }

  document.querySelectorAll(".globe-hint").forEach(hint => {
    hint.textContent = mobileQuery.matches
      ? "Swipe vertically to scroll · drag sideways to rotate"
      : "Drag to rotate · scroll or pinch to zoom";
  });

  /* Let vertical swipes over the globe remain page-scroll gestures. The globe's
     own pointer handlers still receive horizontal drags and two-finger pinches. */
  const gestures = new Map();

  document.addEventListener("pointerdown", event => {
    if (!mobileQuery.matches || event.pointerType !== "touch") return;
    const stage = event.target.closest(".globe-stage");
    if (!stage || event.target.closest("button")) return;
    gestures.set(event.pointerId, {
      stage,
      x: event.clientX,
      y: event.clientY,
      intent: "pending"
    });
  }, true);

  document.addEventListener("pointermove", event => {
    const gesture = gestures.get(event.pointerId);
    if (!gesture) return;

    const activeOnStage = [...gestures.values()].filter(item => item.stage === gesture.stage).length;
    if (activeOnStage >= 2) {
      gesture.intent = "globe";
      return;
    }

    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (gesture.intent === "pending" && Math.hypot(dx, dy) >= 9) {
      gesture.intent = Math.abs(dy) > Math.abs(dx) * 1.12 ? "scroll" : "globe";
    }

    if (gesture.intent === "scroll") {
      event.stopPropagation();
    }
  }, true);

  const clearGesture = event => gestures.delete(event.pointerId);
  document.addEventListener("pointerup", clearGesture, true);
  document.addEventListener("pointercancel", clearGesture, true);

  viewport?.addEventListener("resize", syncViewport);
  window.addEventListener("resize", syncViewport);
  window.addEventListener("orientationchange", () => setTimeout(syncViewport, 180));

  syncViewport();
  window.__NEARER_EXPERIENCE3_STARTED = true;
})();
