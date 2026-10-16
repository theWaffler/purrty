# Clowder

A cozy cat themed RPG party roster for remembering the people in your life.
Everything is stored on your phone (IndexedDB). Nothing is ever uploaded.

## Put it on GitHub Pages
1. Create a new repo on GitHub (for example `clowder`).
2. Upload every file in this folder to the repo, keeping the folders as they are.
3. In the repo go to Settings > Pages, set Source to "Deploy from a branch", pick `main` and `/ (root)`, then Save.
4. After a minute it will be live at `https://YOUR-USERNAME.github.io/clowder/`.
5. Open that link on your phone and Add to Home Screen.

## Updating later
When you change any file, bump `VERSION` at the top of `sw.js` (for example `clowder-v2`)
so phones pick up the new version.

## Files
- `index.html` the page
- `css/style.css` the look
- `js/app.js` screens and logic
- `js/pixels.js` kitty sprites, hearts, icons
- `js/db.js` on-device storage
- `sw.js` offline support
