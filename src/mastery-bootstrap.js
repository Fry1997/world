import { initialiseGameRuntime } from "./game-runtime.js";

function showFailure(error) {
  console.error(error);
  const loading = document.getElementById("masteryLoading");
  if (loading) loading.textContent = "Regional Mastery could not start. Please reload the page.";
}

async function start() {
  await initialiseGameRuntime();
  await import("../mastery/mastery.js");

  if (!window.__NEARER_MASTERY_STARTED) {
    throw new Error("Regional Mastery did not initialise.");
  }

  document.documentElement.classList.add("nearer-runtime-ready");
}

start().catch(showFailure);
