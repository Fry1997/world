(() => {
  const VERSION = "20260718-svg3";
  const APP_PARTS = 9;
  const CSS_PARTS = 3;
  const paths = (folder, count) => Array.from({ length: count }, (_, index) => `${folder}/${String(index + 1).padStart(2, "0")}.txt?v=${VERSION}`);
  const getText = async path => {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load ${path}`);
    return response.text();
  };
  const start = async () => {
    if (window.__NEARER_SVG_PATCH_LOADING) return;
    window.__NEARER_SVG_PATCH_LOADING = true;
    const [css, app] = await Promise.all([
      Promise.all(paths("svg-patch/css", CSS_PARTS).map(getText)),
      Promise.all(paths("svg-patch/app", APP_PARTS).map(getText))
    ]);
    const style = document.createElement("style");
    style.dataset.nearerSvgPatch = VERSION;
    style.textContent = css.join("");
    document.head.appendChild(style);
    (0, eval)(app.join(""));
  };
  start().catch(error => console.error("Nearer SVG map patch failed", error));
})();
