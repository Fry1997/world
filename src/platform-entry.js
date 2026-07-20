import '../cloud.css';
import '../mobile-polish.css';
import { installAtlasNavigation } from './atlas-navigation.js';

window.__NEARER_PLATFORM_MODULE_PENDING = true;
installAtlasNavigation();

if (!document.querySelector('link[data-nearer-cloud-style]')) {
  const bundledStyleMarker = document.createElement('link');
  bundledStyleMarker.rel = 'stylesheet';
  bundledStyleMarker.media = 'not all';
  bundledStyleMarker.dataset.nearerCloudStyle = 'bundled';
  document.head.appendChild(bundledStyleMarker);
}

try {
  await import('../cloud.js');
  await import('./password-recovery.js');
  await import('../platform.js');
  installAtlasNavigation();
  await import('./progress-panel.js');
} finally {
  window.__NEARER_PLATFORM_MODULE_PENDING = false;
}
