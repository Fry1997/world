import "./time-trial-challenge.css";
import { formatClock, localDateKey } from "./time-trial-data.js";
import { createFriendChallenge, loadFriendChallenge } from "./time-trial-service.js";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function challengeUrl(id) {
  const url = new URL("./", document.baseURI);
  url.searchParams.set("challenge", id);
  url.hash = "";
  return url.href;
}

function compare(challenge) {
  if (!challenge.viewer_has_result) return null;
  const creator = [
    Number(challenge.creator_countries_found || 0),
    -Number(challenge.creator_guess_count || 0),
    Number(challenge.creator_time_remaining_ms || 0)
  ];
  const viewer = [
    Number(challenge.viewer_countries_found || 0),
    -Number(challenge.viewer_guess_count || 0),
    Number(challenge.viewer_time_remaining_ms || 0)
  ];
  for (let index = 0; index < creator.length; index += 1) {
    if (viewer[index] > creator[index]) return "won";
    if (viewer[index] < creator[index]) return "lost";
  }
  return "tied";
}

function sharePanel(dialog, challenge, url, status) {
  dialog.querySelector("[data-time-trial-share-panel]")?.remove();
  const actions = dialog.querySelector(".nearer-time-trial-result-actions");
  if (!actions) return;
  const panel = document.createElement("section");
  panel.className = "nearer-time-trial-share-panel";
  panel.dataset.timeTrialSharePanel = "true";
  panel.innerHTML = `<div><p class="eyebrow">FRIEND CHALLENGE READY</p><h3>Can they beat ${challenge.countries_found}?</h3><p>${escapeHtml(status)}</p></div><label><span>Challenge link</span><input readonly value="${escapeHtml(url)}"></label><button type="button" class="secondary-button" data-time-trial-copy>Copy link</button>`;
  actions.before(panel);
  panel.querySelector("[data-time-trial-copy]")?.addEventListener("click", async event => {
    await navigator.clipboard.writeText(url);
    event.currentTarget.textContent = "Copied";
  });
}

export function bindFriendChallengeShare(dialog) {
  const button = dialog.querySelector("[data-time-trial-share]");
  if (!button) return;
  button.addEventListener("click", async () => {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Creating challenge…";
    try {
      const challenge = await createFriendChallenge();
      const url = challengeUrl(challenge.challenge_id);
      const text = `${challenge.creator_name} found ${challenge.countries_found} countr${challenge.countries_found === 1 ? "y" : "ies"} in Nearer's Daily Time Trial. Can you beat it?`;
      let shared = false;
      if (navigator.share) {
        try {
          await navigator.share({ title: "Nearer friend challenge", text, url });
          shared = true;
        } catch (error) {
          if (error?.name !== "AbortError") throw error;
        }
      }
      if (!shared && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        shared = true;
      }
      sharePanel(dialog, challenge, url, shared ? "The link is ready to send." : "Copy the link and send it to a friend.");
      button.textContent = shared ? "Challenge shared" : original;
    } catch (error) {
      sharePanel(dialog, { countries_found: "?" }, "", error.message || "The challenge link could not be created yet.");
      button.textContent = original;
    } finally {
      button.disabled = false;
    }
  });
}

export async function challengeFromLocation() {
  const id = new URLSearchParams(location.search).get("challenge");
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return null;
  try {
    const challenge = await loadFriendChallenge(id);
    return challenge ? { id, challenge } : { id, error: "This challenge is no longer available." };
  } catch (error) {
    return { id, error: error.message || "This challenge could not be loaded." };
  }
}

export function renderFriendChallengeInvitation(dialog, challengeState, handlers = {}) {
  dialog.querySelector("[data-time-trial-invitation]")?.remove();
  const shell = dialog.querySelector(".nearer-time-trial-shell");
  if (!shell || !challengeState) return;
  const section = document.createElement("section");
  section.className = "nearer-time-trial-invitation";
  section.dataset.timeTrialInvitation = "true";

  if (challengeState.error) {
    section.innerHTML = `<div><p class="eyebrow">FRIEND CHALLENGE</p><h2>Signal lost.</h2><p>${escapeHtml(challengeState.error)}</p></div><button type="button" data-challenge-dismiss aria-label="Dismiss">×</button>`;
  } else {
    const challenge = challengeState.challenge;
    const result = compare(challenge);
    const isToday = challenge.challenge_day === localDateKey();
    const signedIn = Boolean(window.NEARER_CLOUD?.session);
    const resultCopy = result === "won" ? `You beat ${challenge.creator_name}'s score.`
      : result === "lost" ? `${challenge.creator_name} leads this challenge.`
        : result === "tied" ? `You and ${challenge.creator_name} are level.`
          : `${challenge.creator_name} has set the score to beat.`;
    const action = challenge.viewer_has_result
      ? `<span class="nearer-time-trial-invitation-status">${escapeHtml(resultCopy)}</span>`
      : isToday && signedIn
        ? `<button type="button" class="primary-button" data-challenge-start>Take the challenge</button>`
        : isToday
          ? `<button type="button" class="primary-button" data-challenge-signin>Sign in to compete</button>`
          : `<span class="nearer-time-trial-invitation-status">This Daily sequence has closed.</span>`;
    section.innerHTML = `<div class="nearer-time-trial-invitation-copy"><p class="eyebrow">FRIEND CHALLENGE</p><h2>${escapeHtml(challenge.creator_name)} found ${challenge.creator_countries_found} countr${challenge.creator_countries_found === 1 ? "y" : "ies"}.</h2><p>${escapeHtml(resultCopy)} Their run used ${challenge.creator_guess_count} guesses with ${formatClock(challenge.creator_time_remaining_ms)} left.</p></div><div class="nearer-time-trial-invitation-score"><strong>${challenge.creator_countries_found}</strong><span>to beat</span></div><div class="nearer-time-trial-invitation-action">${action}<button type="button" data-challenge-dismiss>Not now</button></div>`;
  }

  const lobby = shell.querySelector(".nearer-time-trial-lobby");
  if (lobby) lobby.before(section);
  else shell.prepend(section);
  section.querySelector("[data-challenge-dismiss]")?.addEventListener("click", () => {
    const url = new URL(location.href);
    url.searchParams.delete("challenge");
    history.replaceState({}, "", url);
    section.remove();
  });
  section.querySelector("[data-challenge-start]")?.addEventListener("click", handlers.start || (() => {}));
  section.querySelector("[data-challenge-signin]")?.addEventListener("click", handlers.signIn || (() => {}));
}
