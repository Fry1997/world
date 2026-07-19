(() => {
  "use strict";
  if (window.__NEARER_CLOUD_STARTED) return;
  window.__NEARER_CLOUD_STARTED = true;

  const SUPABASE_URL = "https://gxtrcjuhlgkpanqndtwy.supabase.co";
  const SUPABASE_KEY = "sb_publishable_r6oXUe1FpQdCxTzbOd-uYA_p0Ntv6rS";
  const SUPABASE_MODULE = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
  const META_KEY = "nearer-cloud-meta-v1";
  const DEVICE_KEY = "nearer-device-id-v1";
  const BOOTSTRAP_PREFIX = "nearer-cloud-ready:";
  const TRACKED = {
    solo: "nearer-game-v1",
    mastery: "nearer-mastery-v1",
    mastery_session: "nearer-mastery-session-v1"
  };
  const STORAGE_TO_NAMESPACE = new Map(Object.entries(TRACKED).map(([namespace, key]) => [key, namespace]));

  let supabase = null;
  let session = null;
  let clientPromise = null;
  let syncTimer = 0;
  let syncing = false;
  let applyingRemote = false;
  let definitions = [];
  let achievements = [];
  let profile = null;
  let dialog = null;
  let accountButton = null;
  let statusText = "Saved on this device";

  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;

  function safeParse(value, fallback = null) {
    try { return JSON.parse(value); } catch { return fallback; }
  }

  function readMeta() {
    return safeParse(localStorage.getItem(META_KEY), {}) || {};
  }

  function writeMeta(meta) {
    originalSetItem.call(localStorage, META_KEY, JSON.stringify(meta));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function deviceId() {
    let value = localStorage.getItem(DEVICE_KEY);
    if (value) return value;
    value = crypto.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    originalSetItem.call(localStorage, DEVICE_KEY, value);
    return value;
  }

  function touchNamespace(namespace) {
    const meta = readMeta();
    meta[namespace] = nowIso();
    writeMeta(meta);
  }

  function readLocal(namespace) {
    const key = TRACKED[namespace];
    const raw = key ? localStorage.getItem(key) : null;
    return raw === null ? null : safeParse(raw, null);
  }

  function writeLocal(namespace, payload, timestamp) {
    const key = TRACKED[namespace];
    if (!key) return;
    applyingRemote = true;
    try {
      if (payload === null || payload === undefined) originalRemoveItem.call(localStorage, key);
      else originalSetItem.call(localStorage, key, JSON.stringify(payload));
      const meta = readMeta();
      meta[namespace] = timestamp || nowIso();
      writeMeta(meta);
    } finally {
      applyingRemote = false;
    }
  }

  function scheduleSync(delay = 900) {
    if (!session || applyingRemote) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncAll({ initial: false }).catch(reportError), delay);
    setStatus("Waiting to sync…");
  }

  Storage.prototype.setItem = function patchedSetItem(key, value) {
    originalSetItem.call(this, key, value);
    if (this === localStorage && !applyingRemote && STORAGE_TO_NAMESPACE.has(key)) {
      touchNamespace(STORAGE_TO_NAMESPACE.get(key));
      scheduleSync();
    }
  };

  Storage.prototype.removeItem = function patchedRemoveItem(key) {
    originalRemoveItem.call(this, key);
    if (this === localStorage && !applyingRemote && STORAGE_TO_NAMESPACE.has(key)) {
      touchNamespace(STORAGE_TO_NAMESPACE.get(key));
      scheduleSync();
    }
  };

  function hasExistingAuthToken() {
    return Object.keys(localStorage).some(key => key.startsWith("sb-gxtrcjuhlgkpanqndtwy-auth-token"));
  }

  async function getClient() {
    if (supabase) return supabase;
    if (!clientPromise) {
      clientPromise = import(SUPABASE_MODULE).then(({ createClient }) => {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        supabase.auth.onAuthStateChange((event, nextSession) => {
          session = nextSession;
          updateAccountButton();
          if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
            if (session) syncAll({ initial: true }).catch(reportError);
          }
          if (event === "SIGNED_OUT") {
            profile = null;
            achievements = [];
            setStatus("Saved on this device");
            renderDialog();
          }
        });
        return supabase;
      });
    }
    return clientPromise;
  }

  function meaningfulSolo(value) {
    if (!value || typeof value !== "object") return false;
    if ((value.stats?.played || 0) > 0 || (value.stats?.wins || 0) > 0) return true;
    if (Object.values(value.dailyGames || {}).some(game => game?.guesses?.length || game?.complete)) return true;
    return Boolean(value.randomGame?.guesses?.length || value.randomGame?.complete);
  }

  function meaningfulMastery(value) {
    return Boolean(value && (Object.keys(value.countries || {}).length || (value.totals?.sessions || 0) > 0));
  }

  function meaningful(namespace, value) {
    if (namespace === "solo") return meaningfulSolo(value);
    if (namespace === "mastery") return meaningfulMastery(value);
    if (namespace === "mastery_session") return Boolean(value?.version);
    return value !== null && value !== undefined;
  }

  function chooseGame(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    if (Boolean(a.complete) !== Boolean(b.complete)) return a.complete ? a : b;
    if (a.complete && b.complete) return (a.guesses?.length || Infinity) <= (b.guesses?.length || Infinity) ? a : b;
    if ((a.guesses?.length || 0) !== (b.guesses?.length || 0)) return (a.guesses?.length || 0) >= (b.guesses?.length || 0) ? a : b;
    return (a.startedAt || 0) >= (b.startedAt || 0) ? a : b;
  }

  function mergeSolo(local, remote) {
    const a = local || {};
    const b = remote || {};
    const dailyGames = { ...(b.dailyGames || {}) };
    for (const [date, game] of Object.entries(a.dailyGames || {})) dailyGames[date] = chooseGame(game, dailyGames[date]);
    const latestDaily = [a, b].sort((x, y) => String(y.stats?.lastDailyWin || "").localeCompare(String(x.stats?.lastDailyWin || "")))[0];
    return {
      ...b,
      ...a,
      stats: {
        played: Math.max(a.stats?.played || 0, b.stats?.played || 0),
        wins: Math.max(a.stats?.wins || 0, b.stats?.wins || 0),
        streak: latestDaily.stats?.streak || Math.max(a.stats?.streak || 0, b.stats?.streak || 0),
        lastDailyWin: latestDaily.stats?.lastDailyWin || null
      },
      dailyGames,
      randomGame: chooseGame(a.randomGame, b.randomGame)
    };
  }

  function maxRecord(a = {}, b = {}) {
    const fields = ["attempts", "correct", "firstCorrect", "misses", "reveals", "skips"];
    const result = { ...b, ...a };
    for (const field of fields) result[field] = Math.max(a[field] || 0, b[field] || 0);
    result.lastSeen = [a.lastSeen, b.lastSeen].filter(Boolean).sort().at(-1) || null;
    return result;
  }

  function mergeMastery(local, remote) {
    const a = local || {};
    const b = remote || {};
    const countries = { ...(b.countries || {}) };
    for (const [code, record] of Object.entries(a.countries || {})) countries[code] = maxRecord(record, countries[code]);
    const regions = { ...(b.regions || {}) };
    for (const [key, record] of Object.entries(a.regions || {})) {
      const old = regions[key] || {};
      regions[key] = { ...old, ...record, sessions: Math.max(record.sessions || 0, old.sessions || 0), best: Math.max(record.best || 0, old.best || 0) || null };
    }
    const totals = Object.values(countries).reduce((sum, record) => {
      sum.firstCorrect += record.firstCorrect || 0;
      sum.answered += record.correct || 0;
      return sum;
    }, { sessions: Math.max(a.totals?.sessions || 0, b.totals?.sessions || 0), firstCorrect: 0, answered: 0 });
    return { ...b, ...a, countries, regions, totals };
  }

  function mergePayload(namespace, local, remote) {
    if (namespace === "solo") return mergeSolo(local, remote);
    if (namespace === "mastery") return mergeMastery(local, remote);
    if (namespace === "mastery_session") {
      if (!local) return remote;
      if (!remote) return local;
      return (local.startedAt || 0) >= (remote.startedAt || 0) ? local : remote;
    }
    return local ?? remote;
  }

  function payloadEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  async function loadAccountData() {
    if (!session) return;
    const client = await getClient();
    const [{ data: profileData }, { data: definitionData }, { data: achievementData }] = await Promise.all([
      client.from("profiles").select("id,display_name,avatar_seed,updated_at").eq("id", session.user.id).maybeSingle(),
      client.from("achievement_definitions").select("key,name,description,icon,category,threshold,sort_order").order("sort_order"),
      client.from("user_achievements").select("achievement_key,progress,unlocked_at,updated_at").eq("user_id", session.user.id)
    ]);
    profile = profileData || null;
    definitions = definitionData || [];
    achievements = achievementData || [];
  }

  function strength(record = {}) {
    const seen = record.correct || 0;
    const first = record.firstCorrect || 0;
    const misses = record.misses || 0;
    return Math.max(0, Math.min(100, Math.round(first * 34 + Math.max(0, seen - first) * 18 - misses * 7)));
  }

  function achievementValues() {
    const solo = readLocal("solo") || {};
    const mastery = readLocal("mastery") || {};
    const played = solo.stats?.played || 0;
    const wins = solo.stats?.wins || 0;
    const streak = solo.stats?.streak || 0;
    const records = Object.values(mastery.countries || {});
    const mastered = records.filter(record => strength(record) >= 70).length;
    const regionsStarted = Object.values(mastery.regions || {}).filter(region => (region.sessions || 0) > 0).length;
    return {
      first_find: wins,
      five_games: played,
      twenty_five_games: played,
      hundred_games: played,
      ten_wins: wins,
      daily_streak_3: streak,
      daily_streak_7: streak,
      mastery_started: records.filter(record => (record.attempts || 0) > 0).length,
      mastery_first: mastered,
      mastery_ten: mastered,
      mastery_fifty: mastered,
      all_regions_started: regionsStarted
    };
  }

  async function syncAchievements() {
    if (!session) return;
    const client = await getClient();
    if (!definitions.length) await loadAccountData();
    const existing = new Map(achievements.map(item => [item.achievement_key, item]));
    const values = achievementValues();
    const unlockedNow = [];
    const rows = definitions.map(definition => {
      const old = existing.get(definition.key);
      const progress = Math.max(Number(old?.progress || 0), Number(values[definition.key] || 0));
      const unlocked = progress >= Number(definition.threshold || 1);
      if (unlocked && !old?.unlocked_at) unlockedNow.push(definition);
      return {
        user_id: session.user.id,
        achievement_key: definition.key,
        progress,
        unlocked_at: old?.unlocked_at || (unlocked ? nowIso() : null)
      };
    });
    if (rows.length) {
      const { error } = await client.from("user_achievements").upsert(rows, { onConflict: "user_id,achievement_key" });
      if (error) throw error;
    }
    await loadAccountData();
    for (const definition of unlockedNow.slice(0, 3)) showAchievementToast(definition);
  }

  async function syncAll({ initial = false } = {}) {
    if (!session || syncing) return;
    syncing = true;
    setStatus("Syncing…");
    try {
      const client = await getClient();
      const { data: rows, error } = await client.from("user_state").select("namespace,payload,client_updated_at,updated_at,device_id").eq("user_id", session.user.id);
      if (error) throw error;
      const remoteByNamespace = new Map((rows || []).map(row => [row.namespace, row]));
      const meta = readMeta();
      const bootstrappedKey = `${BOOTSTRAP_PREFIX}${session.user.id}`;
      const firstDeviceSync = !localStorage.getItem(bootstrappedKey);
      let appliedRemote = false;
      const upserts = [];

      for (const namespace of Object.keys(TRACKED)) {
        const local = readLocal(namespace);
        const remote = remoteByNamespace.get(namespace);
        const localUseful = meaningful(namespace, local);
        const remoteUseful = meaningful(namespace, remote?.payload);
        let resolved = local;
        let resolvedTime = meta[namespace] || nowIso();

        if ((initial || firstDeviceSync) && remoteUseful) {
          if (!localUseful) {
            resolved = remote.payload;
            resolvedTime = remote.client_updated_at || remote.updated_at;
          } else {
            resolved = mergePayload(namespace, local, remote.payload);
            resolvedTime = nowIso();
          }
        } else if (remote) {
          const remoteTime = Date.parse(remote.client_updated_at || remote.updated_at || 0);
          const localTime = Date.parse(meta[namespace] || 0);
          if (remoteTime > localTime + 1500) {
            resolved = remote.payload;
            resolvedTime = remote.client_updated_at || remote.updated_at;
          }
        }

        if (!payloadEqual(local, resolved)) {
          writeLocal(namespace, resolved, resolvedTime);
          appliedRemote = true;
        }

        if (meaningful(namespace, resolved)) {
          upserts.push({
            user_id: session.user.id,
            namespace,
            payload: resolved,
            client_updated_at: resolvedTime,
            device_id: deviceId()
          });
        }
      }

      if (upserts.length) {
        const { error: upsertError } = await client.from("user_state").upsert(upserts, { onConflict: "user_id,namespace" });
        if (upsertError) throw upsertError;
      }
      originalSetItem.call(localStorage, bootstrappedKey, nowIso());
      await loadAccountData();
      await syncAchievements();
      setStatus(`Synced ${new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date())}`);
      renderDialog();
      if (appliedRemote) {
        showCloudToast("Cloud progress restored", "Reloading Nearer with your latest progress…");
        setTimeout(() => location.reload(), 700);
      }
    } finally {
      syncing = false;
    }
  }

  function setStatus(value) {
    statusText = value;
    accountButton?.classList.toggle("is-synced", Boolean(session) && value.startsWith("Synced"));
    const node = dialog?.querySelector("[data-cloud-status]");
    if (node) node.textContent = value;
  }

  function reportError(error) {
    console.error("Nearer cloud:", error);
    setStatus("Cloud sync needs attention");
    renderDialog(error?.message || "Something went wrong. Your progress is still saved on this device.");
  }

  function initials() {
    const value = profile?.display_name || session?.user?.email || "N";
    return value.split(/\s+|@/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  }

  function updateAccountButton() {
    if (!accountButton) return;
    accountButton.classList.toggle("is-signed-in", Boolean(session));
    accountButton.setAttribute("aria-label", session ? "Open account and cloud progress" : "Sign in to save progress");
    const label = accountButton.querySelector("strong");
    if (label) label.textContent = session ? initials() : "";
  }

  function createAccountButton() {
    if (document.getElementById("nearerAccountButton")) return;
    const actions = document.querySelector(".topbar-actions");
    if (!actions) return;
    accountButton = document.createElement("button");
    accountButton.id = "nearerAccountButton";
    accountButton.className = "icon-button nearer-account-button";
    accountButton.type = "button";
    accountButton.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 20c.5-4.2 2.7-6.3 6.5-6.3s6 2.1 6.5 6.3"/></svg><strong aria-hidden="true"></strong><i aria-hidden="true"></i>`;
    accountButton.addEventListener("click", openAccount);
    actions.append(accountButton);
    updateAccountButton();
  }

  function createDialog() {
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "nearerAccountDialog";
    dialog.className = "nearer-account-dialog";
    dialog.addEventListener("click", event => {
      if (event.target === dialog) dialog.close();
    });
    document.body.append(dialog);
    return dialog;
  }

  function signedOutMarkup(message = "") {
    return `<button class="nearer-account-close" type="button" data-account-close aria-label="Close">×</button>
      <div class="nearer-account-hero"><span class="nearer-account-orbit" aria-hidden="true">N</span><div><p class="eyebrow">NEARER ACCOUNT</p><h2>Keep your world with you.</h2><p>Sign in to protect Daily and Regional Mastery progress and continue on any device.</p></div></div>
      <form class="nearer-auth-form" data-auth-form>
        <label><span>Email address</span><input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label>
        <label><span>Password</span><input name="password" type="password" autocomplete="current-password" minlength="8" required placeholder="At least 8 characters"></label>
        <p class="nearer-auth-message" data-auth-message>${message}</p>
        <div class="nearer-auth-actions"><button class="primary-button" type="submit">Sign in</button><button class="secondary-button" type="button" data-create-account>Create account</button></div>
        <button class="nearer-magic-link" type="button" data-magic-link>Email me a sign-in link instead</button>
      </form>
      <p class="nearer-account-footnote">Playing without an account still works. Nothing is uploaded until you sign in.</p>`;
  }

  function signedInMarkup(message = "") {
    const solo = readLocal("solo") || {};
    const mastery = readLocal("mastery") || {};
    const mastered = Object.values(mastery.countries || {}).filter(record => strength(record) >= 70).length;
    const unlocked = achievements.filter(item => item.unlocked_at).length;
    const achievementByKey = new Map(achievements.map(item => [item.achievement_key, item]));
    return `<button class="nearer-account-close" type="button" data-account-close aria-label="Close">×</button>
      <div class="nearer-profile-head"><span class="nearer-profile-avatar">${initials()}</span><div><p class="eyebrow">CLOUD PROFILE</p><h2>${escapeHtml(profile?.display_name || session.user.email.split("@")[0])}</h2><p>${escapeHtml(session.user.email || "Signed in")}</p></div><span class="nearer-sync-pill" data-cloud-status>${escapeHtml(statusText)}</span></div>
      <section class="nearer-cloud-stats" aria-label="Account progress"><article><span>Played</span><strong>${solo.stats?.played || 0}</strong></article><article><span>Wins</span><strong>${solo.stats?.wins || 0}</strong></article><article><span>Mastered</span><strong>${mastered}</strong></article><article><span>Achievements</span><strong>${unlocked}/${definitions.length || 12}</strong></article></section>
      <section class="nearer-profile-edit"><label><span>Display name</span><input data-display-name maxlength="32" value="${escapeHtml(profile?.display_name || "")}" placeholder="Explorer"></label><button class="secondary-button" type="button" data-save-profile>Save name</button></section>
      <section class="nearer-achievements"><div class="nearer-account-section-title"><div><p class="eyebrow">ACHIEVEMENTS</p><h3>Your map milestones</h3></div><span>${unlocked} unlocked</span></div><div class="nearer-achievement-grid">${definitions.map(definition => {
        const earned = achievementByKey.get(definition.key);
        const progress = Math.min(Number(earned?.progress || 0), Number(definition.threshold || 1));
        const percentage = Math.min(100, Math.round(progress / Number(definition.threshold || 1) * 100));
        return `<article class="nearer-achievement ${earned?.unlocked_at ? "is-unlocked" : ""}"><span class="nearer-achievement-icon">${escapeHtml(definition.icon)}</span><div><strong>${escapeHtml(definition.name)}</strong><p>${escapeHtml(definition.description)}</p><i><b style="width:${percentage}%"></b></i><small>${earned?.unlocked_at ? "Unlocked" : `${progress}/${definition.threshold}`}</small></div></article>`;
      }).join("")}</div></section>
      <p class="nearer-auth-message" data-auth-message>${escapeHtml(message)}</p>
      <div class="nearer-account-actions"><button class="primary-button" type="button" data-sync-now>Sync now</button><button class="secondary-button" type="button" data-sign-out>Sign out</button></div>`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function renderDialog(message = "") {
    if (!dialog) return;
    dialog.innerHTML = session ? signedInMarkup(message) : signedOutMarkup(message);
    dialog.querySelector("[data-account-close]")?.addEventListener("click", () => dialog.close());
    dialog.querySelector("[data-auth-form]")?.addEventListener("submit", signInWithPassword);
    dialog.querySelector("[data-create-account]")?.addEventListener("click", createAccount);
    dialog.querySelector("[data-magic-link]")?.addEventListener("click", sendMagicLink);
    dialog.querySelector("[data-sync-now]")?.addEventListener("click", () => syncAll({ initial: false }).catch(reportError));
    dialog.querySelector("[data-sign-out]")?.addEventListener("click", signOut);
    dialog.querySelector("[data-save-profile]")?.addEventListener("click", saveProfile);
  }

  function authValues() {
    const form = dialog?.querySelector("[data-auth-form]");
    const data = form ? new FormData(form) : null;
    return { email: String(data?.get("email") || "").trim(), password: String(data?.get("password") || "") };
  }

  function setAuthBusy(busy, message = "") {
    dialog?.querySelectorAll("button,input").forEach(element => { element.disabled = busy; });
    const node = dialog?.querySelector("[data-auth-message]");
    if (node) node.textContent = message;
  }

  async function signInWithPassword(event) {
    event.preventDefault();
    const { email, password } = authValues();
    if (!email || !password) return;
    setAuthBusy(true, "Signing in…");
    try {
      const client = await getClient();
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setAuthBusy(false, "Signed in. Restoring your progress…");
    } catch (error) {
      setAuthBusy(false, error.message || "Could not sign in.");
    }
  }

  async function createAccount() {
    const { email, password } = authValues();
    if (!email || password.length < 8) {
      setAuthBusy(false, "Enter an email address and a password of at least 8 characters.");
      return;
    }
    setAuthBusy(true, "Creating your account…");
    try {
      const client = await getClient();
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}${location.pathname}` }
      });
      if (error) throw error;
      if (data.session) setAuthBusy(false, "Account created. Syncing your progress…");
      else setAuthBusy(false, "Check your email to confirm your account, then return here to sign in.");
    } catch (error) {
      setAuthBusy(false, error.message || "Could not create the account.");
    }
  }

  async function sendMagicLink() {
    const { email } = authValues();
    if (!email) {
      setAuthBusy(false, "Enter your email address first.");
      return;
    }
    setAuthBusy(true, "Sending your secure sign-in link…");
    try {
      const client = await getClient();
      const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}${location.pathname}` } });
      if (error) throw error;
      setAuthBusy(false, "Check your email and open the sign-in link on this device.");
    } catch (error) {
      setAuthBusy(false, error.message || "Could not send the sign-in link.");
    }
  }

  async function signOut() {
    setAuthBusy(true, "Signing out…");
    try {
      const client = await getClient();
      await client.auth.signOut();
      session = null;
      renderDialog("Signed out. Your local progress remains on this device.");
      updateAccountButton();
    } catch (error) {
      renderDialog(error.message || "Could not sign out.");
    }
  }

  async function saveProfile() {
    const name = String(dialog?.querySelector("[data-display-name]")?.value || "").trim();
    if (!session || !name) return;
    setAuthBusy(true, "Saving…");
    try {
      const client = await getClient();
      const { error } = await client.from("profiles").upsert({ id: session.user.id, display_name: name }, { onConflict: "id" });
      if (error) throw error;
      await loadAccountData();
      updateAccountButton();
      renderDialog("Display name updated.");
    } catch (error) {
      renderDialog(error.message || "Could not update your profile.");
    }
  }

  async function openAccount() {
    createDialog();
    renderDialog("Loading your account…");
    dialog.showModal();
    try {
      const client = await getClient();
      const { data } = await client.auth.getSession();
      session = data.session;
      if (session) {
        await loadAccountData();
        await syncAll({ initial: true });
      }
      renderDialog();
      updateAccountButton();
    } catch (error) {
      reportError(error);
    }
  }

  function showCloudToast(title, copy) {
    let toast = document.getElementById("nearerCloudToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "nearerCloudToast";
      toast.className = "nearer-cloud-toast";
      document.body.append(toast);
    }
    toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(copy)}</span>`;
    toast.classList.add("is-visible");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove("is-visible"), 4200);
  }

  function showAchievementToast(definition) {
    showCloudToast(`Achievement unlocked · ${definition.name}`, definition.description);
  }

  async function initialise() {
    createAccountButton();
    createDialog();
    if (location.hash.includes("access_token") || location.search.includes("code=") || hasExistingAuthToken()) {
      try {
        const client = await getClient();
        const { data } = await client.auth.getSession();
        session = data.session;
        if (session) {
          await loadAccountData();
          await syncAll({ initial: true });
          if (location.hash.includes("access_token")) history.replaceState({}, document.title, location.pathname + location.search);
        }
      } catch (error) {
        reportError(error);
      }
    }
    updateAccountButton();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise, { once: true });
  else initialise();

  window.NEARER_CLOUD = { open: openAccount, sync: () => syncAll({ initial: false }), get session() { return session; } };
})();