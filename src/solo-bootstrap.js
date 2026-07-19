import { initialiseGameRuntime } from "./game-runtime.js";

window.__NEARER_SVG_PATCH_STARTED = true;

function showFailure(error) {
  console.error(error);
  const panel = document.querySelector(".map-panel");
  if (panel) {
    panel.innerHTML = `
      <div style="min-height:360px;display:grid;place-items:center;padding:2rem;text-align:center;border:1px solid rgba(196,74,49,.3);border-radius:24px;background:rgba(196,74,49,.08);font-family:system-ui,sans-serif">
        <div>
          <strong style="display:block;font-size:1.1rem;margin-bottom:.5rem">The globe could not start.</strong>
          <span style="color:#6b7280">Please reload the page.</span>
        </div>
      </div>`;
    return;
  }
  document.body.innerHTML = '<p style="padding:2rem;font-family:system-ui">The game could not load. Please refresh and check your connection.</p>';
}

async function start() {
  const appSource = window.NEARER_APP_SOURCE || "";
  if (!appSource) throw new Error("Nearer application source modules are missing.");

  await initialiseGameRuntime();
  const safeAppSource = appSource.replace("initializeMap();", "");
  (0, eval)(safeAppSource);

  const importedD3 = window.NEARER_D3;
  const originalOrthographic = importedD3?.geoOrthographic;
  if (typeof originalOrthographic !== "function") {
    throw new Error("The globe projection factory is unavailable.");
  }

  window.NEARER_D3 = {
    ...importedD3,
    geoOrthographic: (...args) => {
      const projection = originalOrthographic(...args);
      window.__NEARER_GLOBE_PROJECTION = projection;
      return projection;
    }
  };

  await import("./solo-enhancements.js");
  document.documentElement.classList.add("nearer-runtime-ready");
  delete window.NEARER_APP_SOURCE;
}

start().catch(showFailure);
