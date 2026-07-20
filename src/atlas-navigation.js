import './atlas-navigation.css';

let observer = null;

function rootUrl() {
  const value = new URL('./', document.baseURI);
  value.search = '';
  value.hash = '';
  return value;
}

function isAtlasPath() {
  const root = rootUrl().pathname.replace(/\/+$/, '/');
  return location.pathname.replace(/\/index\.html$/, '/').includes(`${root}atlas/`);
}

function atlasIcon() {
  return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5.5 9 3l6 2.5L20 3v15.5L15 21l-6-2.5L4 21Z"/><path d="M9 3v15.5M15 5.5V21"/></svg>';
}

function markAtlasActive(container) {
  if (!container || !isAtlasPath()) return;
  container.querySelectorAll('.is-active').forEach(item => item.classList.remove('is-active'));
  container.querySelectorAll('[aria-current="page"]').forEach(item => item.removeAttribute('aria-current'));
  const atlas = container.querySelector('[data-platform-section="atlas"]');
  atlas?.classList.add('is-active');
  atlas?.setAttribute('aria-current', 'page');
}

function installDesktopTab() {
  const tabs = document.querySelector('.platform-tabs');
  if (!tabs) return;
  let atlas = tabs.querySelector('[data-platform-section="atlas"]');
  if (!atlas) {
    atlas = document.createElement('a');
    atlas.className = 'mode-button';
    atlas.dataset.platformSection = 'atlas';
    atlas.href = new URL('atlas/', rootUrl()).href;
    atlas.textContent = 'Atlas';
    atlas.setAttribute('aria-label', 'Open Nearer Atlas');
    const together = [...tabs.children].find(item => item.textContent.trim() === 'Together');
    tabs.insertBefore(atlas, together || null);
  }
  markAtlasActive(tabs);
}

function installMobileTab() {
  const dock = document.querySelector('.platform-mobile-dock');
  if (!dock) return;
  let atlas = dock.querySelector('[data-platform-section="atlas"]');
  if (!atlas) {
    atlas = document.createElement('a');
    atlas.dataset.platformSection = 'atlas';
    atlas.href = new URL('atlas/', rootUrl()).href;
    atlas.setAttribute('aria-label', 'Open Nearer Atlas');
    atlas.innerHTML = `${atlasIcon()}<span>Atlas</span>`;
    const together = dock.querySelector('[data-platform-section="together"]');
    dock.insertBefore(atlas, together || null);
  }
  markAtlasActive(dock);
}

function installNow() {
  installDesktopTab();
  installMobileTab();
}

export function installAtlasNavigation() {
  installNow();
  if (observer) return;
  observer = new MutationObserver(() => requestAnimationFrame(installNow));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('pageshow', installNow);
}
