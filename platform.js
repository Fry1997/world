(() => {
  "use strict";
  if (window.__NEARER_PLATFORM_STARTED) return;

  const VERSION = "20260719-platform3";
  const path = location.pathname.replace(/\/index\.html$/, "/");
  const rootUrl = new URL("./", document.baseURI);
  rootUrl.search = "";
  rootUrl.hash = "";
  const rootPath = rootUrl.pathname.replace(/\/+$/, "/");
  const isRoot = path.replace(/\/+$/, "/") === rootPath;
  const isMastery = path.includes(`${rootPath}mastery/`);
  const isTogether = path.includes(`${rootPath}together/`);
  const isTogetherMatch = isTogether && path.replace(/\/+$/, "/") !== `${rootPath}together/`;
  const query = new URLSearchParams(location.search);
  const THEME_KEY = "nearer-together-theme";
  const savedTheme = localStorage.getItem(THEME_KEY) || localStorage.getItem("nearer-race-theme");

  document.body.classList.add("platform-shell-enabled");
  document.documentElement.dataset.platformVersion = VERSION;

  if (!document.documentElement.dataset.theme) {
    document.documentElement.dataset.theme = savedTheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }

  if (!isRoot) {
    const themeButton = document.getElementById("themeButton");
    themeButton?.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem(THEME_KEY, next);
    });
  }

  const sectionUrls = {
    daily: new URL("./", rootUrl),
    random: new URL("./?mode=random", rootUrl),
    mastery: new URL("mastery/", rootUrl),
    together: new URL("together/", rootUrl)
  };

  function currentSection() {
    if (isMastery) return "mastery";
    if (isTogether) return "together";
    if (isRoot) {
      const randomActive = document.querySelector('.platform-tabs .mode-button[data-mode="random"]')?.classList.contains("is-active");
      return randomActive || query.get("mode") === "random" ? "random" : "daily";
    }
    return "daily";
  }

  function activateRootMode(mode) {
    const button = document.querySelector(`.platform-tabs .mode-button[data-mode="${mode}"]`);
    if (!button) return false;
    button.click();
    const next = mode === "random" ? sectionUrls.random : sectionUrls.daily;
    history.replaceState({}, "", next.href);
    document.querySelector("main")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }

  function markActive(dock) {
    const activeSection = currentSection();
    dock.querySelectorAll("[data-platform-section]").forEach(item => {
      const active = item.dataset.platformSection === activeSection;
      item.classList.toggle("is-active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
  }

  function navigateFluidly(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const item = event.currentTarget;
    const section = item.dataset.platformSection;

    if (isRoot && (section === "daily" || section === "random")) {
      event.preventDefault();
      activateRootMode(section);
      markActive(item.closest(".platform-mobile-dock"));
      return;
    }

    if (section === currentSection() && !isTogetherMatch) {
      event.preventDefault();
      scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    event.preventDefault();
    document.body.classList.add("platform-is-leaving");
    setTimeout(() => location.assign(item.href), 115);
  }

  function addMobileDock() {
    if (document.querySelector(".platform-mobile-dock")) return;
    const dock = document.createElement("nav");
    dock.className = "platform-mobile-dock";
    dock.setAttribute("aria-label", "Nearer sections");
    dock.innerHTML = `
      <a href="${sectionUrls.daily.href}" data-platform-section="daily" aria-label="Play today's country">
        <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg><span>Today</span>
      </a>
      <a href="${sectionUrls.random.href}" data-platform-section="random" aria-label="Play a random country">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h3c4 0 5 10 9 10h4"/><path d="m17 14 3 3-3 3M4 17h3c1.5 0 2.6-1.4 3.6-3M14 7c.7 0 1.4-.2 2-.7L20 3"/><path d="m17 3 3 3-3 3"/></svg><span>Random</span>
      </a>
      <a href="${sectionUrls.mastery.href}" data-platform-section="mastery" aria-label="Open Regional Mastery">
        <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M4.7 9h14.6M4.7 15h14.6M12 4c2.1 2.2 3.2 4.9 3.2 8S14.1 17.8 12 20M12 4c-2.1 2.2-3.2 4.9-3.2 8s1.1 5.8 3.2 8"/></svg><span>Mastery</span>
      </a>
      <a href="${sectionUrls.together.href}" data-platform-section="together" aria-label="Open Together games">
        <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="8" cy="9" r="3"/><circle cx="16.5" cy="10" r="2.5"/><path d="M3 20c.4-4 2.1-6 5-6s4.6 2 5 6M13 15c3.7-.7 6.2 1 7 5"/></svg><span>Together</span>
      </a>`;

    dock.querySelectorAll("[data-platform-section]").forEach(item => item.addEventListener("click", navigateFluidly));
    document.body.append(dock);
    markActive(dock);

    const tabs = document.querySelector(".platform-tabs");
    if (tabs && isRoot) {
      new MutationObserver(() => markActive(dock)).observe(tabs, { attributes: true, subtree: true, attributeFilter: ["class"] });
    }
  }

  function addLaunchpad() {
    const main = document.querySelector("main");
    if (!main || document.querySelector(".platform-launchpad")) return;

    const launchpad = document.createElement("section");
    launchpad.className = "platform-launchpad";
    launchpad.setAttribute("aria-labelledby", "masteryLaunchTitle");
    launchpad.innerHTML = `
      <div class="platform-launch-visual" aria-hidden="true">
        <span class="platform-orbit platform-orbit-one"></span>
        <span class="platform-orbit platform-orbit-two"></span>
        <span class="platform-orbit-core">N</span>
        <i style="--angle:18deg"></i><i style="--angle:78deg"></i><i style="--angle:138deg"></i>
        <i style="--angle:198deg"></i><i style="--angle:258deg"></i><i style="--angle:318deg"></i>
      </div>
      <div class="platform-launch-copy">
        <div class="platform-launch-label"><span>NEW MODE</span><strong>Regional Mastery</strong></div>
        <h2 id="masteryLaunchTitle">Learn the world, not only the answer.</h2>
        <p>Nearer names a country. You place it on the globe, build strength by region and revisit the locations that need another look.</p>
        <div class="platform-launch-features" aria-label="Regional Mastery features">
          <span>6 regions</span><span>Practice + Test</span><span>Smart review</span>
        </div>
      </div>
      <a class="platform-launch-action" href="${sectionUrls.mastery.href}"><span>Explore Mastery</span><b aria-hidden="true">→</b></a>`;
    launchpad.querySelector("a")?.addEventListener("click", navigateFluidly);
    launchpad.querySelector("a")?.setAttribute("data-platform-section", "mastery");
    main.prepend(launchpad);
  }

  addMobileDock();
  if (isRoot) addLaunchpad();

  if (isRoot && query.get("mode") === "random") {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const ready = Boolean(window.__NEARER_CANVAS_GLOBE_STARTED || window.__NEARER_PREMIUM_GLOBE_STARTED);
      if (ready && activateRootMode("random")) clearInterval(timer);
      else if (attempts > 120) clearInterval(timer);
    }, 50);
  }

  addEventListener("pageshow", () => document.body.classList.remove("platform-is-leaving"));
  window.__NEARER_PLATFORM_STARTED = true;
})();