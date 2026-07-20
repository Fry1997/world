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
- `mastery/` — Regional Mastery experience
- `together/` — multiplayer modes
- `src/` — Vite entry points, progress, competition and account extensions
- `cloud.js` — Supabase authentication and cloud progress sync
- `chunks/` — compatibility source for the geography and game runtimes
- `supabase/` — versioned database migrations and functions

## Geography model

Country shapes come from the Natural Earth 1:110m dataset distributed by `world-atlas@2.0.2`. Border distances are calculated in the browser from sampled boundary points. Known shared land borders return 0 km.

Countries absent from the low-resolution atlas are represented by mapped point approximations adjusted by their approximate area. The figures are intended for consistent gameplay, not navigation or survey use.

## Deployment

Production deploys from the `main` branch to Vercel. Pull requests receive isolated preview deployments and run the mobile and desktop browser regression suite before merge.
