# Nearer

A polished country-distance guessing game inspired by the hot-and-cold geography format.

A country is selected in secret. Every guess reports the shortest approximate border-to-border distance, whether the player moved closer or farther than their previous guess, and the closest result so far. Guesses remain ranked from nearest to farthest.

## Features

- 197 playable countries
- Daily deterministic puzzle and unlimited random mode
- Country autocomplete with common aliases
- Approximate border-to-border distance feedback
- Closer/farther comparison with the previous guess
- Permanently ranked guess history
- Interactive proximity map
- Kilometres and miles
- Light and dark themes
- Local game statistics, daily progress and streaks
- Shareable result trail
- Responsive mobile-first interface

## Run locally

The browser loads pinned map libraries and Natural Earth geometry from jsDelivr, so serve the folder over HTTP:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Project structure

- `index.html` — application markup
- `styles.css` — responsive visual design
- `runtime-data.js` — country metadata, map loading and distance engine
- `app.js` — game state, search, ranking, feedback and persistence

## Geography model

Country shapes come from the Natural Earth 1:110m dataset distributed by `world-atlas@2.0.2`. Border distances are calculated in the browser from sampled boundary points. Known shared land borders return 0 km.

Countries absent from the low-resolution atlas are represented by mapped point approximations adjusted by their approximate area. The figures are intended for consistent gameplay, not navigation or survey use.

## Deployment

The project is a static site and can be hosted on GitHub Pages, Netlify, Vercel or any ordinary static web server.
