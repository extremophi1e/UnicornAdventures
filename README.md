<h1 align="center">✨ Rainbow Unicorn Adventures ✨</h1>

<p align="center">
  <em>A pink, sparkly, gloriously <strong>no-fail</strong> arcade made for two small humans —<br>
  where the only way to play is to have fun.</em> 🦄🌈
</p>

<p align="center">
  <img src="docs/screenshots/title.jpg" width="300" alt="Title screen — Rainbow Unicorn Adventures, with a grid of nine games">
</p>

<p align="center">
  <img alt="difficulty: no-fail" src="https://img.shields.io/badge/difficulty-no--fail-ff8fcf">
  <img alt="ages: 3+" src="https://img.shields.io/badge/ages-3%2B-9b6bff">
  <img alt="installable PWA" src="https://img.shields.io/badge/PWA-installable-7ed957">
  <img alt="built with Phaser 4" src="https://img.shields.io/badge/Phaser-4-2d2d2d">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6">
</p>

---

There are **no scores to lose, no game-overs, no lives, no menus to get stuck in** — just a smiling unicorn, a lot of cute things, and nine little games you reach with one big tap. Built for a 4-year-old and her sibling, tuned so a toddler mashing the screen with both hands always feels like a hero.

## 🎮 Nine games, one tap each

<table>
<tr>
<td width="33%" valign="top" align="center">
<img src="docs/screenshots/star-blaster.jpg" alt="Star Blaster gameplay"><br>
<b>⭐ Star Blaster</b><br>
<sub>The unicorn flies through space and <b>auto-fires rainbow stars</b> at friendly cuties across 12 gentle levels with cuddly bosses. Just steer — it shoots for you. Bumping into things is a soft bounce, never a loss.</sub>
</td>
<td width="33%" valign="top" align="center">
<img src="docs/screenshots/catch-the-cuties.jpg" alt="Catch the Cuties gameplay"><br>
<b>🌈 Catch the Cuties</b><br>
<sub>Cute treats tumble from the sky and the unicorn <b>catches them</b> with a generous, forgiving hitbox. It speeds up when you're on a roll and gently slows when you miss — so it always finds your pace. Endless.</sub>
</td>
<td width="33%" valign="top" align="center">
<img src="docs/screenshots/pop-the-cuties.jpg" alt="Pop the Cuties gameplay"><br>
<b>🫧 Pop the Cuties</b><br>
<sub>Cute emoji bubble up from the deep and you <b>poke them to pop</b> into sparkles. Full <b>multi-touch</b> — mash with all ten fingers. A rare rainbow cutie clears the whole screen in a party.</sub>
</td>
</tr>
<tr>
<td width="33%" valign="top" align="center">
<img src="docs/screenshots/unicorn-gumballs.jpg" alt="Unicorn Gumballs gameplay"><br>
<b>🎁 Unicorn Gumballs</b><br>
<sub>Push the big button and the machine <b>rattles, flashes, and dispenses</b> a surprise cutie with confetti. Hit the rare jackpot and the unicorn itself pops out for a rainbow party.</sub>
</td>
<td width="33%" valign="top" align="center">
<img src="docs/screenshots/grow-a-garden.jpg" alt="Grow a Garden gameplay"><br>
<b>🌱 Grow a Garden</b><br>
<sub>Tap the meadow and flowers <b>sprout and bloom</b> under your finger. Butterflies and birds drift in, the sky warms as it fills, then the whole garden celebrates and starts fresh.</sub>
</td>
<td width="33%" valign="top" align="center">
<img src="docs/screenshots/peekaboo.jpg" alt="Peekaboo gameplay"><br>
<b>🐹 Peekaboo</b><br>
<sub>Animals pop up from burrows, flowers, and clouds — <b>tap them before they duck</b> back down for a giggle. Up to four little fingers at once. Endless surprises, no way to lose.</sub>
</td>
</tr>
<tr>
<td width="33%" valign="top" align="center">
<img src="docs/screenshots/surprise-eggs.jpg" alt="Surprise Eggs gameplay"><br>
<b>🥚 Surprise Eggs</b><br>
<sub>Tap a speckled egg to crack it — once, twice, then it <b>shatters and a creature hatches</b> with a fanfare. Golden eggs hatch the unicorn. Fresh eggs keep refilling the nests.</sub>
</td>
<td width="33%" valign="top" align="center">
<img src="docs/screenshots/tap-the-aquarium.jpg" alt="Tap the Aquarium gameplay"><br>
<b>🐠 Tap the Aquarium</b><br>
<sub>Sea creatures and floating treasures drift by. <b>Tap one for a surprise</b> — a spin, a giant grow, a color flash, a whole school, even a treasure chest. Poke one too much and it takes a sleepy nap. 💤</sub>
</td>
<td width="33%" valign="top" align="center">
<img src="docs/screenshots/animal-soundboard.jpg" alt="Animal Soundboard"><br>
<b>🔊 Animal Soundboard</b><br>
<sub>A swipeable picture-book of <b>50+ animals</b>. Tap any one to hear its sound and watch it wiggle to life. Pure cause-and-effect — no goal, just delight.</sub>
</td>
</tr>
</table>

## 👆 How to play

- **One tap to play.** Every game opens straight from the home grid with one big button — no menus, no reading.
- **Touch is everything.** *Steer* by dragging (Star Blaster, Catch the Cuties) or just *tap/poke* what you see (everything else). Most modes are full **multi-touch**, so two kids can play at once.
- Mouse and arrow keys also work for the steering games.
- The **⬅ button** (top-right) always goes home. That's the whole control scheme.

## 💖 The no-fail promise

Everything is designed so a little kid can't get stuck, can't lose, and can't accidentally quit:

- No score to drop, no lives, no "Game Over," no death screens.
- Difficulty **self-balances** to the player instead of punishing them.
- No reading required, no menus, no ads, no purchases, no accounts, **no data collected**, nothing saved.
- Celebrations everywhere — confetti, fanfares, and sparkle bursts for doing basically anything.

## 🚀 Run it yourself

```bash
npm install
npm run dev      # open the printed URL
npm test         # run the logic tests (Vitest)
npm run build    # production build → dist/ (also emits the PWA service worker)
```

## 📱 Put it on a kid's phone (one-time)

1. Open the deployed link in the phone browser.
2. **Add to Home Screen** (iPhone: Share ⬆️ → Add to Home Screen · Android: menu → Install app). Now it has its own icon and runs full-screen as an app.
3. **Lock them into the game** so a stray swipe can't escape it:
   - **iPhone:** Settings → Accessibility → **Guided Access** → On. Open the game, triple-click the side button to start. Triple-click + passcode to exit.
   - **Android:** Settings → Security → **Screen pinning** → On. Open the game, open recents, tap the icon → Pin.

### Deploy (Netlify)

Connect the repo on Netlify with build command `npm run build` and publish dir `dist` (or drag the built `dist/` folder straight in). You'll get a link like `https://your-site.netlify.app`.

## 🛠️ Under the hood

- **[Phaser 4](https://phaser.io/) + TypeScript + Vite**, shipped as an installable **PWA** (offline-capable via a service worker).
- **Pure game logic lives in `src/core/`** with **zero** Phaser imports, unit-tested with **Vitest** — the self-balancing speed ladder, level formations, collision, tap-targeting, and reaction-picking are all testable without a browser.
- **Animated [Google Noto emoji](https://googlefonts.github.io/noto-emoji-animation/)** (Apache-2.0) are decoded into sprite sheets at build time (`scripts/build-emoji.mjs`) and played as looping Phaser animations. The unicorn is its own animated sheet; the sparkle burst uses the [OpenMoji](https://openmoji.org/) atlas.
- Each mode has its own shape-drawn background (starfield, sunny meadow, deep sea, cozy playroom, egg nests, and more) — no heavy image backgrounds.
- Each game **lazy-loads its own art, music, and sound** on first entry, so the initial download stays tiny.

### Asset-build scripts

| Script | What it does |
|---|---|
| `npm run emoji` | Downloads Noto emoji → sprite sheets + manifest |
| `npm run atlas` | Builds the shared sparkle/particle atlas |
| `npm run catch-unicorn` | Builds the animated unicorn sprite sheet |
| `npm run audio` | Generates the shared sound effects |
| `npm run aquarium-sfx` | Synthesizes the aquarium reaction sounds (blub / sproing / chime) |
| `npm run <mode>-audio` | Fetches a mode's music (`catch`, `pop`, `gumball`, `peekaboo`, `eggs`, `garden`, `aquarium`, `soundboard`) |
| `npm run icons` | Generates the PWA icons |

## 🙏 Credits

- Music by **Kevin MacLeod** ([incompetech.com](https://incompetech.com)) — CC-BY 4.0. See [`public/audio/CREDITS.md`](public/audio/CREDITS.md).
- Emoji art: **Google Noto Emoji** (Apache-2.0) and **OpenMoji** (CC BY-SA 4.0).
- Made with 💜 for **Zoe and Desi**.
