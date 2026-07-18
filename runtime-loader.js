(() => {
  const appSource = window.NEARER_APP_SOURCE || "";
  const tailFiles = Array.from({ length: 9 }, (_, index) =>
    `chunks/runtime-tail-${String(index + 1).padStart(2, "0")}.js`
  );
  const fail = error => {
    console.error(error);
    document.body.innerHTML = "<p style=\"padding:2rem;font-family:system-ui\">The game could not load. Please refresh and check your connection.</p>";
  };
  const loadScript = source => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = source;
    script.onload = () => {
      script.remove();
      resolve();
    };
    script.onerror = () => reject(new Error(`Could not load ${source}`));
    document.head.appendChild(script);
  });
  const start = async () => {
    for (const file of tailFiles) await loadScript(file);
    const source = window.NEARER_RUNTIME_SOURCE || "";
    if (!source || !appSource) throw new Error("Nearer source chunks are missing.");
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    try {
      await import(url);
      (0, eval)(appSource);
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  start().catch(fail);
})();
