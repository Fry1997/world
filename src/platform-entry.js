import "../cloud.css";

window.__NEARER_PLATFORM_MODULE_PENDING = true;
window.__NEARER_CLOUD_STYLES_BUNDLED = true;

try {
  await import("../cloud.js");
  await import("../platform.js");
} finally {
  window.__NEARER_PLATFORM_MODULE_PENDING = false;
}
