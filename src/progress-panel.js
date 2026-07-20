import "./progress-panel.css";
import { getProgressSnapshot } from "./progress-data.js";
import { renderProgress } from "./progress-view.js";

let dialog;

function render() {
  if (!dialog) return;
  renderProgress(dialog, getProgressSnapshot());
  dialog.querySelector("[data-progress-close]")?.addEventListener("click", () => dialog.close());
  dialog.querySelectorAll("[data-progress-tab]").forEach(button => button.addEventListener("click", () => {
    dialog.dataset.tab = button.dataset.progressTab;
    render();
  }));
  dialog.querySelector("[data-progress-account]")?.addEventListener("click", () => {
    dialog.close();
    window.NEARER_CLOUD?.open?.();
  });
  dialog.querySelector("[data-progress-sync]")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Syncing…";
    try { await window.NEARER_CLOUD?.sync?.(); }
    finally { button.disabled = false; button.textContent = "Sync now"; render(); }
  });
}

function openProgress() {
  dialog.dataset.tab ||= "overview";
  render();
  dialog.showModal();
}

function initialise() {
  dialog = document.createElement("dialog");
  dialog.id = "nearerProgressDialog";
  dialog.className = "nearer-progress-dialog";
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  document.body.append(dialog);

  const actions = document.querySelector(".topbar-actions");
  if (actions && !document.getElementById("nearerProgressButton")) {
    const button = document.createElement("button");
    button.id = "nearerProgressButton";
    button.className = "icon-button nearer-progress-button";
    button.type = "button";
    button.setAttribute("aria-label", "Open progress and achievements");
    button.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 19V9M12 19V5M19 19v-7"/><path d="M3 19h18"/></svg>`;
    button.addEventListener("click", openProgress);
    actions.append(button);
  }

  addEventListener("storage", event => {
    if (dialog.open && (event.key === "nearer-game-v1" || event.key === "nearer-mastery-v1")) render();
  });
  window.NEARER_PROGRESS = { open: openProgress, refresh: render };
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise, { once: true });
else initialise();
