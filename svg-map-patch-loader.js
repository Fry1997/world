(() => {
  const source = window.NEARER_SVG_PATCH_SOURCE || "";
  if (!source) return;
  try { (0, eval)(source); } catch (error) { console.error("Nearer SVG map could not start", error); }
})();
