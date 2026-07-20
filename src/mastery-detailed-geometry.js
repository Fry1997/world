import { preparePrecisionGeometry } from "./precision-geometry.js";
import "./mastery-detailed-geometry.css";

export async function prepareDetailedMasteryGeometry() {
  const detail = await preparePrecisionGeometry();
  window.__NEARER_MASTERY_DETAILED_GEOMETRY = detail;
  return detail;
}

export function installDetailedMasteryControls() {
  const stage = document.getElementById("masteryGlobeStage");
  const hint = stage?.querySelector(".mastery-globe-hint");
  const zoomIn = document.getElementById("masteryZoomIn");
  const zoomOut = document.getElementById("masteryZoomOut");
  if (!stage || !zoomIn || !zoomOut) return;

  stage.dataset.detailedGeometry = "true";
  if (hint) hint.textContent = "Drag to move · pinch or use + to zoom from country level to microstate detail";
  zoomIn.title = "Zoom further into the map";
  zoomOut.title = "Zoom out";

  const existing = stage.querySelector(".mastery-map-detail-badge");
  const badge = existing || document.createElement("div");
  badge.className = "mastery-map-detail-badge";
  badge.setAttribute("aria-hidden", "true");
  badge.innerHTML = "<span>10m borders</span><small>900× zoom</small>";
  if (!existing) stage.append(badge);
}
