const MOBILE_BREAKPOINT = '(max-width: 720px)';

let installed = false;
let scheduled = false;
let soloModeObserver = null;

function activeSoloMode() {
  const randomButton = document.querySelector('.mode-button[data-mode="random"]');
  const query = new URLSearchParams(location.search);
  return randomButton?.classList.contains('is-active') || query.get('mode') === 'random'
    ? 'random'
    : 'daily';
}

function syncSoloHeader() {
  const header = document.querySelector('.nearer-native-header[data-screen="solo"]');
  if (!header) return;

  const mode = activeSoloMode();
  document.body.dataset.nearerMode = mode;

  const kicker = header.querySelector('.nearer-native-kicker');
  const title = header.querySelector('h1');
  const subtitle = header.querySelector('.nearer-native-subtitle');
  const dateChip = header.querySelector('.nearer-native-date');
  const actions = header.querySelector('.nearer-native-actions');
  const newGame = document.getElementById('newGameButton');

  if (mode === 'random') {
    kicker.textContent = 'RANDOM MODE';
    title.textContent = 'Random target';
    subtitle.textContent = 'Guess the hidden country';
    dateChip?.classList.add('is-hidden');
  } else {
    kicker.textContent = 'DAILY CHALLENGE';
    title.textContent = "Today's challenge";
    subtitle.textContent = 'Guess the hidden country';
    dateChip?.classList.remove('is-hidden');
  }

  if (newGame && actions && newGame.parentElement !== actions) actions.append(newGame);
}

function installSolo() {
  const gameLayout = document.querySelector('.game-layout');
  const oldHeading = document.querySelector('.game-heading');
  if (!gameLayout || !oldHeading) return false;

  document.body.classList.add('nearer-approved-layout', 'nearer-approved-solo');

  let header = document.querySelector('.nearer-native-header[data-screen="solo"]');
  if (!header) {
    header = document.createElement('header');
    header.className = 'nearer-native-header';
    header.dataset.screen = 'solo';
    header.innerHTML = `
      <div class="nearer-native-copy">
        <p class="nearer-native-kicker">DAILY CHALLENGE</p>
        <h1>Today's challenge</h1>
        <p class="nearer-native-subtitle">Guess the hidden country</p>
      </div>
      <div class="nearer-native-actions">
        <span class="nearer-native-date"></span>
      </div>`;
    oldHeading.before(header);

    const date = document.getElementById('dailyDate');
    if (date) header.querySelector('.nearer-native-date')?.append(date);
  }

  oldHeading.setAttribute('aria-hidden', 'true');
  syncSoloHeader();

  if (!soloModeObserver) {
    const modeSwitch = document.querySelector('.mode-switch');
    if (modeSwitch) {
      soloModeObserver = new MutationObserver(syncSoloHeader);
      soloModeObserver.observe(modeSwitch, {
        attributes: true,
        subtree: true,
        attributeFilter: ['class']
      });
      modeSwitch.addEventListener('click', () => setTimeout(syncSoloHeader, 0));
    }
  }

  return true;
}

function installAtlas() {
  const main = document.querySelector('.atlas-main');
  const search = document.querySelector('.atlas-search-bar');
  if (!main || !search) return false;

  document.body.classList.add('nearer-approved-layout', 'nearer-approved-atlas');

  if (!document.querySelector('.nearer-native-header[data-screen="atlas"]')) {
    const header = document.createElement('header');
    header.className = 'nearer-native-header nearer-atlas-native-header';
    header.dataset.screen = 'atlas';
    header.innerHTML = `
      <div class="nearer-native-copy">
        <p class="nearer-native-kicker">WORLD ATLAS</p>
        <h1>Atlas</h1>
        <p class="nearer-native-subtitle">Explore any country</p>
      </div>`;
    search.before(header);
  }

  return true;
}

function installTogether() {
  const main = document.querySelector('.together-main');
  const hero = document.querySelector('.together-hero-copy');
  if (!main || !hero) return false;

  document.body.classList.add('nearer-approved-layout', 'nearer-approved-together');

  if (!hero.dataset.nearerRewritten) {
    const eyebrow = hero.querySelector('.eyebrow');
    const title = hero.querySelector('h1');
    const intro = hero.querySelector('.together-intro');
    if (eyebrow) eyebrow.textContent = 'LOCAL MULTIPLAYER';
    if (title) title.textContent = 'Together';
    if (intro) intro.textContent = 'Pass and play on one device.';
    hero.dataset.nearerRewritten = 'true';
  }

  return true;
}

function installMastery() {
  if (!document.querySelector('.mastery-main')) return false;
  document.body.classList.add('nearer-approved-layout', 'nearer-approved-mastery');
  return true;
}

function installForRoute() {
  if (document.querySelector('.game-layout')) installSolo();
  if (document.querySelector('.mastery-main')) installMastery();
  if (document.querySelector('.atlas-main')) installAtlas();
  if (document.querySelector('.together-main')) installTogether();
}

function scheduleInstall() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    installForRoute();
  });
}

export function installApprovedMobileLayout() {
  if (installed) {
    scheduleInstall();
    return;
  }
  installed = true;

  installForRoute();

  const observer = new MutationObserver(scheduleInstall);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  addEventListener('pageshow', scheduleInstall);
  matchMedia(MOBILE_BREAKPOINT).addEventListener?.('change', scheduleInstall);
}
