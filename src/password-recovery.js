import "./password-recovery.css";

(() => {
  "use strict";
  if (window.__NEARER_PASSWORD_RECOVERY_STARTED) return;
  window.__NEARER_PASSWORD_RECOVERY_STARTED = true;

  const RECOVERY_PARAM = "recovery";
  let passwordDialog = null;
  let recoveryOpening = false;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function recoveryRedirectUrl() {
    const url = new URL(location.origin + location.pathname);
    url.searchParams.set(RECOVERY_PARAM, "1");
    return url.toString();
  }

  function cleanRecoveryUrl() {
    const url = new URL(location.href);
    url.searchParams.delete(RECOVERY_PARAM);
    url.searchParams.delete("code");
    url.hash = "";
    const query = url.searchParams.toString();
    history.replaceState({}, document.title, `${url.pathname}${query ? `?${query}` : ""}`);
  }

  async function getCloudClient() {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      if (typeof window.NEARER_CLOUD?.client === "function") return window.NEARER_CLOUD.client();
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error("The account service is still starting. Please try again.");
  }

  function createPasswordDialog() {
    if (passwordDialog) return passwordDialog;
    passwordDialog = document.createElement("dialog");
    passwordDialog.id = "nearerPasswordDialog";
    passwordDialog.className = "nearer-password-dialog";
    passwordDialog.addEventListener("click", event => {
      if (event.target === passwordDialog) passwordDialog.close();
    });
    document.body.append(passwordDialog);
    return passwordDialog;
  }

  function renderPasswordDialog({ message = "", recovery = false, success = false } = {}) {
    const dialog = createPasswordDialog();
    if (success) {
      dialog.innerHTML = `<button class="nearer-account-close" type="button" data-password-close aria-label="Close">×</button>
        <div class="nearer-password-hero"><span aria-hidden="true">✓</span><div><p class="eyebrow">PASSWORD SAVED</p><h2>You can sign in anywhere.</h2><p>Your Nearer account now has a password. Open the Home Screen app and sign in with your email address and this password.</p></div></div>
        <button class="primary-button nearer-password-done" type="button" data-password-close>Done</button>`;
    } else {
      dialog.innerHTML = `<button class="nearer-account-close" type="button" data-password-close aria-label="Close">×</button>
        <div class="nearer-password-hero"><span aria-hidden="true">N</span><div><p class="eyebrow">${recovery ? "RESET PASSWORD" : "PASSWORD ACCESS"}</p><h2>${recovery ? "Choose a new password." : "Sign in without an email link."}</h2><p>${recovery ? "This password will work in Safari and in Nearer added to your iPhone Home Screen." : "Set or change your password so every Nearer installation can use ordinary email and password sign-in."}</p></div></div>
        <form class="nearer-password-form" data-password-form>
          <label><span>New password</span><input name="password" type="password" autocomplete="new-password" minlength="8" required placeholder="At least 8 characters"></label>
          <label><span>Confirm password</span><input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="Enter it again"></label>
          <p class="nearer-auth-message" data-password-message>${escapeHtml(message)}</p>
          <button class="primary-button" type="submit">Save password</button>
        </form>`;
    }
    dialog.querySelectorAll("[data-password-close]").forEach(button => button.addEventListener("click", () => dialog.close()));
    dialog.querySelector("[data-password-form]")?.addEventListener("submit", savePassword);
    return dialog;
  }

  function openPasswordDialog(options = {}) {
    const dialog = renderPasswordDialog(options);
    if (!dialog.open) dialog.showModal();
    if (!options.success) setTimeout(() => dialog.querySelector('input[name="password"]')?.focus(), 80);
  }

  function setPasswordBusy(busy, message = "") {
    passwordDialog?.querySelectorAll("button,input").forEach(element => { element.disabled = busy; });
    const node = passwordDialog?.querySelector("[data-password-message]");
    if (node) node.textContent = message;
  }

  async function savePassword(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") || "");
    const confirmation = String(data.get("confirmPassword") || "");
    if (password.length < 8) return setPasswordBusy(false, "Use at least 8 characters.");
    if (password !== confirmation) return setPasswordBusy(false, "The two passwords do not match.");

    setPasswordBusy(true, "Saving your password…");
    try {
      const client = await getCloudClient();
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      cleanRecoveryUrl();
      openPasswordDialog({ success: true });
    } catch (error) {
      setPasswordBusy(false, error?.message || "Could not update your password. Request a new reset email and try again.");
    }
  }

  function setAccountMessage(message) {
    const node = document.querySelector("#nearerAccountDialog [data-auth-message]");
    if (node) node.textContent = message;
  }

  function setAccountBusy(busy) {
    document.querySelectorAll("#nearerAccountDialog button,#nearerAccountDialog input").forEach(element => { element.disabled = busy; });
  }

  async function requestPasswordReset() {
    const accountDialog = document.getElementById("nearerAccountDialog");
    const emailInput = accountDialog?.querySelector('input[name="email"]');
    const email = String(emailInput?.value || "").trim();
    if (!email) {
      setAccountMessage("Enter your email address first, then choose reset password.");
      emailInput?.focus();
      return;
    }

    setAccountBusy(true);
    setAccountMessage("Sending your password reset email…");
    try {
      const client = await getCloudClient();
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: recoveryRedirectUrl() });
      if (error) throw error;
      setAccountBusy(false);
      setAccountMessage("Check your email. Open the reset link, choose a password, then use it in the Home Screen app.");
    } catch (error) {
      setAccountBusy(false);
      setAccountMessage(error?.message || "Could not send the reset email.");
    }
  }

  function injectAccountControls() {
    const accountDialog = document.getElementById("nearerAccountDialog");
    if (!accountDialog) return;
    const authForm = accountDialog.querySelector("[data-auth-form]");
    if (authForm && !authForm.querySelector("[data-forgot-password]")) {
      const button = document.createElement("button");
      button.className = "nearer-forgot-password";
      button.type = "button";
      button.dataset.forgotPassword = "";
      button.textContent = "Forgot or never set a password?";
      button.addEventListener("click", requestPasswordReset);
      const magicLink = authForm.querySelector("[data-magic-link]");
      if (magicLink) magicLink.insertAdjacentElement("afterend", button);
      else authForm.append(button);
    }

    if (window.NEARER_CLOUD?.session && !accountDialog.querySelector("[data-password-settings]")) {
      const section = document.createElement("section");
      section.className = "nearer-password-settings";
      section.dataset.passwordSettings = "";
      section.innerHTML = `<div><p class="eyebrow">PASSWORD ACCESS</p><h3>Use Nearer from your Home Screen</h3><p>Set a password so the standalone iPhone app can sign in without sharing Safari’s email-link session.</p></div><button class="secondary-button" type="button" data-set-password>Set or change password</button>`;
      section.querySelector("[data-set-password]")?.addEventListener("click", () => openPasswordDialog());
      const achievements = accountDialog.querySelector(".nearer-achievements");
      if (achievements) achievements.insertAdjacentElement("beforebegin", section);
      else accountDialog.querySelector(".nearer-account-actions")?.insertAdjacentElement("beforebegin", section);
    }
  }

  async function openRecoveryFromUrl() {
    if (recoveryOpening) return;
    const url = new URL(location.href);
    if (url.searchParams.get(RECOVERY_PARAM) !== "1" && !location.hash.includes("type=recovery")) return;
    recoveryOpening = true;
    try {
      const client = await getCloudClient();
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (!data.session) {
        openPasswordDialog({ recovery: true, message: "This reset link is no longer valid. Return to sign in and request a new one." });
        passwordDialog?.querySelector("button[type='submit']")?.setAttribute("disabled", "");
        return;
      }
      openPasswordDialog({ recovery: true });
    } catch (error) {
      openPasswordDialog({ recovery: true, message: error?.message || "Could not verify this reset link." });
    } finally {
      recoveryOpening = false;
    }
  }

  async function initialisePasswordRecovery() {
    createPasswordDialog();
    new MutationObserver(injectAccountControls).observe(document.body, { childList: true, subtree: true });
    injectAccountControls();
    try {
      const client = await getCloudClient();
      client.auth.onAuthStateChange(event => {
        if (event === "PASSWORD_RECOVERY") openPasswordDialog({ recovery: true });
        setTimeout(injectAccountControls, 0);
      });
      await openRecoveryFromUrl();
    } catch (error) {
      console.error("Nearer password recovery:", error);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialisePasswordRecovery, { once: true });
  else initialisePasswordRecovery();

  window.NEARER_PASSWORD_RECOVERY = { open: () => openPasswordDialog(), request: requestPasswordReset };
})();
