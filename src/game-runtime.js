import * as d3 from "d3";
import { feature as topoFeature } from "topojson-client";
import world from "world-atlas/countries-110m.json";

const externalImports = /^import \* as d3 from "[^"]+";\nimport \{ feature as topoFeature \} from "[^"]+";\nimport world from "[^"]+";\n\n/;
const metadataMarker = "const COUNTRY_METADATA =";

export async function initialiseGameRuntime() {
  if (window.NEARER_GAME_DATA && window.NEARER_COUNTRIES_GEOJSON && window.NEARER_D3) return;

  const rawSource = window.NEARER_RUNTIME_SOURCE || "";
  if (!rawSource) throw new Error("Nearer runtime source modules are missing.");
  if (!externalImports.test(rawSource)) {
    throw new Error("Nearer runtime dependencies have an unexpected format.");
  }

  const runtimeBody = rawSource.replace(externalImports, "");
  if (!runtimeBody.includes(metadataMarker)) {
    throw new Error("Nearer runtime has an unexpected format.");
  }

  window.__NEARER_D3_MODULE = d3;
  window.__NEARER_TOPO_FEATURE_MODULE = topoFeature;
  window.__NEARER_WORLD_TOPOLOGY_MODULE = world;

  const dependencyPrelude = [
    "const d3 = window.__NEARER_D3_MODULE;",
    "const topoFeature = window.__NEARER_TOPO_FEATURE_MODULE;",
    "const world = window.__NEARER_WORLD_TOPOLOGY_MODULE;",
    ""
  ].join("\n");

  const source = dependencyPrelude + runtimeBody.replace(
    metadataMarker,
    "window.NEARER_D3 = d3;\nwindow.NEARER_TOPO_FEATURE = topoFeature;\nwindow.NEARER_WORLD_TOPOLOGY = world;\nconst COUNTRY_METADATA ="
  );

  const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    await import(url);
    if (!window.NEARER_GAME_DATA || !window.NEARER_COUNTRIES_GEOJSON || !window.NEARER_D3) {
      throw new Error("Nearer game data did not initialise.");
    }
  } finally {
    URL.revokeObjectURL(url);
    delete window.NEARER_RUNTIME_SOURCE;
    delete window.__NEARER_D3_MODULE;
    delete window.__NEARER_TOPO_FEATURE_MODULE;
    delete window.__NEARER_WORLD_TOPOLOGY_MODULE;
  }
}
