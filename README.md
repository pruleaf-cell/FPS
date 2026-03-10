# Neon Breach Arena

Neon Breach Arena is a compact, single-player browser FPS survival demo built with **vanilla HTML/CSS/JavaScript** and no build step. It is designed to run locally by opening `index.html`, while also being deployable as a static site (including GitHub Pages).

## What it includes

- Title screen with best survival record
- Pointer-lock mouse look
- WASD movement + sprint
- Two weapons (carbine + scattergun)
- Shooting and reloading
- Health, enemy attacks, death and restart loop
- Two enemy types with distinct stats
- Pickups (health and ammo)
- HUD with health/ammo/weapon/time/score
- Pause overlay and help/settings panel
- Mouse sensitivity setting (persisted)
- Best survival time persistence via `localStorage`
- Lightweight procedural audio effects
- Arena radar/minimap

## Run locally

### Easiest
1. Clone/download this repository.
2. Open `index.html` in a modern desktop browser.

### Optional local server (recommended by some browsers)
```bash
python3 -m http.server 8000
```
Then open `http://localhost:8000`.

## Controls

- **W A S D**: Move
- **Shift**: Sprint
- **Mouse**: Look
- **Left click**: Fire
- **R**: Reload
- **1 / 2**: Switch weapon
- **Esc**: Pause / resume and release pointer lock

## Technical approach

- **Rendering:** custom 2.5D raycasting pipeline on a `<canvas>` (no external engine)
- **Level:** handcrafted arena grid map with collision checks
- **Gameplay loop:** deterministic update + render each animation frame
- **AI:** enemies path directly toward player with attack cooldown behavior
- **Persistence:** `localStorage` for sensitivity and best survival time
- **Audio:** procedural Web Audio API tones for key interactions

## Deployment notes (GitHub Pages)

This project is static and requires no build process.

1. Push repository to GitHub.
2. In **Settings → Pages**, set source to your default branch root (or `/docs` if you move files).
3. Save; the site will be served automatically.

## Known limitations

- Enemy navigation is direct-chase rather than full pathfinding.
- Weapons and enemy variety are intentionally compact for stability/scope.
- Audio is synthesized and minimalist (no imported SFX assets).

## Suggested next improvements

- Add richer enemy steering / obstacle-aware pathing.
- Add ambient/map SFX and music toggle.
- Add extra arena variants and wave progression UI.
- Improve weapon feel (recoil kick, shell particles, decals).
