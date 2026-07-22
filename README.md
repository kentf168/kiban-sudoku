# Kiban Sudoku

A self-contained, offline-first Sudoku PWA. No Firebase, no backend, no
network calls — everything (puzzle generation, solving, progress, stats)
runs and saves locally on the device via `localStorage`.

## What's in here
- `index.html`, `styles.css`, `app.js` — the app
- `manifest.json`, `service-worker.js` — what makes it installable + offline
- `icons/` — home screen icons

## Get it on your iPhone

PWAs need to be served over `https://` (or `localhost`) for the "Add to
Home Screen" install and offline caching to work — Safari won't do it for
a `file://` path opened directly. Easiest free option, matching what you
used for the to-do PWA before:

### Option A: GitHub Pages (recommended)
1. Create a new repo (e.g. `kiban-sudoku`) and push these files to it.
2. In the repo: **Settings → Pages → Deploy from branch → main → / (root)**.
3. Wait ~1 minute, then open the given `https://<you>.github.io/kiban-sudoku/`
   URL in Safari **on your iPhone**.
4. Tap the Share icon → **Add to Home Screen**.
5. Launch it from the home screen icon — it opens full-screen, no Safari
   chrome, and works with airplane mode on after the first load.

```bash
cd kiban-sudoku
git init
git add .
git commit -m "Kiban Sudoku"
git remote add origin https://github.com/<you>/kiban-sudoku.git
git push -u origin main
```

### Option B: quick local test on your Mac/PC first
```bash
cd kiban-sudoku
python3 -m http.server 8000
```
Open `http://localhost:8000` in a desktop browser to sanity-check it
before deploying. (iPhone Safari can't reach your computer's `localhost`
directly unless it's on the same Wi-Fi and you use your machine's LAN IP —
GitHub Pages is simpler for real install-and-play use.)

## How it plays
- Tap a cell, then tap a number (or type 1–9 on a physical keyboard).
- **Notes** toggles pencil-mark mode for candidate digits.
- **Hint** fills in one correct cell (prioritizes your selected cell if
  it's wrong or empty).
- 3 mistakes ends the round; progress, timer, and stats persist across
  app restarts and phone reboots.
- Four difficulties (Easy/Medium/Hard/Expert) control how many starting
  clues the puzzle keeps — each puzzle is generated fresh and verified to
  have exactly one solution before it's shown to you.
