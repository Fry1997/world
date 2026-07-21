import '../cloud.css';
import '../mobile-polish.css';
import './product-direction.css';
import { installAtlasNavigation } from './atlas-navigation.js';
import { installApprovedMobileLayout } from './approved-mobile-layout.js';

window.__NEARER_PLATFORM_MODULE_PENDING = true;
installAtlasNavigation();
installApprovedMobileLayout();

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
  installApprovedMobileLayout();
  await import('./progress-panel.js');
} finally {
  window.__NEARER_PLATFORM_MODULE_PENDING = false;
}
