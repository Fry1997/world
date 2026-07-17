(() => {
  const source = window.NEARER_RUNTIME_SOURCE || "";
  const appSource = window.NEARER_APP_SOURCE || "";
  const fail = error => {
    console.error(error);
    document.body.innerHTML = "<p style=\"padding:2rem;font-family:system-ui\">The game could not load. Please refresh and check your connection.</p>";
  };
  if (!source || !appSource) {
    fail(new Error("Nearer source chunks are missing."));
    return;
  }
  const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  import(url).then(() => {
    URL.revokeObjectURL(url);
    (0, eval)(appSource);
  }).catch(fail);
})();
