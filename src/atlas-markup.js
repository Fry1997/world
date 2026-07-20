export function renderAtlasShell(root) {
  root.innerHTML = `
    <section class="atlas-hero">
      <div><p class="eyebrow">NEARER ATLAS · 197 COUNTRIES</p><h1>Open the world.</h1><p>Turn the detailed globe, zoom into real borders and follow the geographic relationships between countries.</p></div>
      <div class="atlas-hero-actions"><button id="atlasRandomButton" class="secondary-button" type="button">Surprise me</button><button id="atlasShareButton" class="secondary-button" type="button" disabled>Share place</button></div>
    </section>
    <section class="atlas-search-bar" aria-label="Find a country">
      <label for="atlasSearch">Find a country</label>
      <div class="atlas-search-control"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input id="atlasSearch" type="search" autocomplete="off" spellcheck="false" placeholder="Search countries, codes or familiar names…" aria-controls="atlasSuggestions" aria-expanded="false"><button id="atlasSearchClear" type="button" aria-label="Clear search">×</button></div>
      <div id="atlasSuggestions" class="atlas-suggestions is-hidden" role="listbox" aria-label="Country suggestions"></div>
    </section>
    <div class="atlas-layout">
      <section class="atlas-globe-panel" aria-labelledby="atlasGlobeTitle">
        <div class="atlas-globe-toolbar"><div><span class="atlas-signal" aria-hidden="true"></span><span id="atlasGlobeTitle">Detailed world view</span></div><div class="atlas-globe-actions"><button id="atlasFocusButton" type="button" aria-label="Focus selected country" title="Focus selected country" disabled><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg></button><button id="atlasResetButton" type="button" aria-label="Reset globe view" title="Reset globe view"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.34 5.66"/><path d="M20 4v7h-7"/></svg></button></div></div>
        <div id="atlasGlobeStage" class="atlas-globe-stage" role="application" tabindex="0" aria-label="Detailed interactive world globe. Drag to rotate, pinch or scroll to zoom, and tap a country to open its Atlas entry.">
          <canvas id="atlasGlobeCanvas" aria-hidden="true"></canvas>
          <div class="atlas-zoom" aria-label="Zoom controls"><button id="atlasZoomIn" type="button" aria-label="Zoom in">+</button><span id="atlasZoomLabel">1.0×</span><button id="atlasZoomOut" type="button" aria-label="Zoom out">−</button></div>
          <div class="atlas-globe-hint">Tap a country · drag to rotate · pinch to zoom right in</div>
        </div>
      </section>
      <aside id="atlasProfile" class="atlas-profile" aria-live="polite">
        <div id="atlasProfileEmpty" class="atlas-profile-empty"><span class="atlas-compass" aria-hidden="true"><i></i></span><p class="eyebrow">COUNTRY ENTRY</p><h2>Choose anywhere.</h2><p>Tap the globe, search by name or open one of the curated Atlas trails below.</p></div>
        <div id="atlasProfileContent" class="atlas-profile-content is-hidden">
          <div class="atlas-profile-heading"><div><p id="atlasCountryContinent" class="eyebrow"></p><h2 id="atlasCountryName"></h2><span id="atlasCountryCode"></span></div><button id="atlasFavouriteButton" type="button" aria-pressed="false"><span aria-hidden="true">☆</span><b>Save</b></button></div>
          <p id="atlasCountrySummary" class="atlas-country-summary"></p>
          <div class="atlas-stat-grid"><article><span>Area</span><strong id="atlasCountryArea">—</strong><small id="atlasAreaComparison">—</small></article><article><span>World size rank</span><strong id="atlasCountryRank">—</strong><small id="atlasSizeBand">—</small></article><article><span>Map centre</span><strong id="atlasCountryCoordinates">—</strong><small>geographic centroid</small></article><article><span>Your mastery</span><strong id="atlasCountryMastery">New</strong><small id="atlasMasteryCopy">Not studied yet</small></article></div>
          <section class="atlas-nearby-section"><div><p class="eyebrow">GEOGRAPHIC CONNECTIONS</p><h3>Nearest countries</h3></div><div id="atlasNearbyCountries" class="atlas-nearby-list"></div></section>
          <div class="atlas-profile-actions"><a id="atlasMasteryLink" class="primary-button" href="/mastery/">Learn this region</a><button id="atlasCopyLinkButton" class="secondary-button" type="button">Copy Atlas link</button></div>
        </div>
      </aside>
    </div>
    <section class="atlas-library" aria-labelledby="atlasLibraryTitle"><div class="atlas-section-heading"><div><p class="eyebrow">ATLAS TRAILS</p><h2 id="atlasLibraryTitle">Look at the world another way.</h2></div><div id="atlasTrailTabs" class="atlas-trail-tabs" role="tablist" aria-label="Atlas trails"><button class="is-active" type="button" data-atlas-trail="smallest" role="tab">Smallest</button><button type="button" data-atlas-trail="largest" role="tab">Largest</button><button type="button" data-atlas-trail="favourites" role="tab">Saved</button><button type="button" data-atlas-trail="recent" role="tab">Recent</button></div></div><div id="atlasTrail" class="atlas-trail"></div></section>
    <section class="atlas-index" aria-labelledby="atlasIndexTitle"><div class="atlas-section-heading atlas-index-heading"><div><p class="eyebrow">WORLD INDEX</p><h2 id="atlasIndexTitle">Every country, one Atlas.</h2></div><label for="atlasContinentFilter">Filter region<select id="atlasContinentFilter"><option value="all">All regions</option></select></label></div><div id="atlasCountryIndex" class="atlas-country-index"></div></section>`;
}
