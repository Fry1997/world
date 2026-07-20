import '../cloud.css';
import './service-worker-register.js';

window.__NEARER_PLATFORM_MODULE_PENDING = true;

if (!document.querySelector('link[data-nearer-cloud-style]')) {
  const bundledStyleMarker = document.createElement('link');
  bundledStyleMarker.rel = 'stylesheet';
  bundledStyleMarker.media = 'not all';
  bundledStyleMarker.dataset.nearerCloudStyle = 'bundled';
  document.head.append(bundledStyleMarker);
}

try {
  await import('../cloud.js');
  await import('../platform.js');
} finally {
  window.__NEARER_PLATFORM_MODULE_PENDING = false;
}
