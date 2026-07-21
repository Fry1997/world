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
- Local-first statistics, daily progress and streaks
- Optional Supabase accounts with cross-device progress
- Email-link, password and password-recovery sign-in
- Regional Mastery, achievements and Daily Time Trial
- Nearer Atlas with detailed country exploration
- Shareable result trail and friend challenges
- Responsive mobile-first interface

## Run locally

Install the application dependencies and start Vite:

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite.

## Project structure

- `index.html` — main game page
- `atlas/` — detailed world exploration and country entries
- `mastery/` — Regional Mastery experience
- `together/` — multiplayer modes
- `src/` — Vite entry points, progress, competition and account extensions
- `cloud.js` — Supabase authentication and cloud progress sync
- `chunks/` — compatibility source for the geography and game runtimes
- `supabase/` — versioned database migrations and functions

## Geography model

Nearer uses Natural Earth geometry distributed by `world-atlas@2.0.2`. The shared game modes use detailed 1:50m country borders, while Atlas and Regional Mastery add a compact 1:10m precision layer for small countries and microstates.

Country paths are rendered separately on the spherical canvas so land and ocean remain stable at both world and local-detail zoom levels. Automated browser checks sample rendered land and ocean pixels and verify real microstate polygons and deep zoom before changes are merged.

Border distances are calculated in the browser from sampled boundary points. Known shared land borders return 0 km. The figures are intended for consistent gameplay rather than navigation or survey use.

## Deployment

Production deploys from the `main` branch to Vercel. Pull requests receive isolated preview deployments and run the mobile and desktop browser regression suite before merge.
