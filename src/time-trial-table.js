import { formatClock } from "./time-trial-data.js";

export function showCompetitionTable(dialog, rows = [], message = "") {
  dialog.querySelector("[data-time-trial-table]")?.remove();
  const shell = dialog.querySelector(".nearer-time-trial-shell");
  if (!shell) return;
  const section = document.createElement("section");
  section.className = "nearer-time-trial-table";
  section.dataset.timeTrialTable = "true";
  const entries = rows.length ? rows.slice(0, 20).map(row => `<li class="${row.is_current_user ? "is-current" : ""}"><span>${row.rank_position}</span><strong>${escapeHtml(row.display_name)}</strong><b>${row.countries_found}</b><small>${row.guess_count} guesses · ${formatClock(row.time_remaining_ms)} left</small></li>`).join("") : `<li class="is-empty">${escapeHtml(message || "No verified results have been posted yet.")}</li>`;
  section.innerHTML = `<div class="nearer-time-trial-table-heading"><div><p class="eyebrow">TODAY'S TABLE</p><h2>Verified Daily Time Trial</h2></div><span>Top 20</span></div><ol>${entries}</ol>`;
  const results = shell.querySelector(".nearer-time-trial-results");
  if (results) results.append(section);
  else shell.append(section);
}

export function showVerificationStatus(dialog, verified, message = "") {
  const results = dialog.querySelector(".nearer-time-trial-results");
  if (!results) return;
  const notice = document.createElement("div");
  notice.className = `nearer-time-trial-verification ${verified ? "is-verified" : "is-pending"}`;
  notice.innerHTML = `<strong>${verified ? "Verified result" : "Verification pending"}</strong><span>${escapeHtml(message || (verified ? "Your result is now included in today's table." : "Nearer will retry when the connection is available."))}</span>`;
  results.prepend(notice);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
