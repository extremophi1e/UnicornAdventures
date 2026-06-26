# Zoe's Rainbow Unicorn 🦄🌈

A gentle, no-fail Galaga-style game made for Zoe.

## Run locally
- `npm install`
- `npm run dev` → open the printed URL
- `npm test` → run the logic tests

## Deploy (Netlify)
1. Push this repo to GitHub (or drag the `dist/` folder after `npm run build` into Netlify).
2. In Netlify: "Add new site" → connect the repo. Build command `npm run build`, publish dir `dist`.
3. You'll get a link like `https://zoes-rainbow-unicorn.netlify.app`.

## Put it on Zoe's phone (one-time)
1. Open the Netlify link in the phone browser.
2. **Add to Home Screen** (iPhone: Share ⬆️ → Add to Home Screen; Android: menu → Install app). Now it has its own icon and runs full screen.
3. **Lock her into the game so she can't accidentally exit:**
   - **iPhone:** Settings → Accessibility → Guided Access → On. Open the game, triple-click the side button to start Guided Access. Triple-click + passcode to exit.
   - **Android:** Settings → Security → Screen pinning → On. Open the game, open recents, tap the icon → Pin.

## Controls
- Move the unicorn: drag (touch), move the mouse, or arrow keys. It shoots by itself.
- Two games: **Play** (the shooter — 12 levels + friendly bosses; the unicorn shoots by itself) and **Rainbow Catch** (catch the falling treats — it speeds up the more you catch and slows when you miss; endless, no-fail).

## Notes
- No accounts, ads, purchases, or data collection. Nothing is saved (always starts at Level 1).
- Items & enemies use Google's animated [Noto emoji](https://googlefonts.github.io/noto-emoji-animation/) (Apache-2.0), decoded into sprite sheets by `scripts/build-emoji.mjs` (`npm run emoji`). The sparkle burst still uses the OpenMoji atlas (`src/render/sprites.ts`). The unicorn is a separate animated sheet.
