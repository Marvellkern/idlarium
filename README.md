# Idlarium

A cozy low poly idle game. Build a collection of water creatures, from swamp frogs to blue whales, across four living diorama habitats you check on for a few minutes at a time. Nothing dies and there's no guilt: neglect only slows the pearls down a little.

Built with Vite, React, TypeScript, React Three Fiber, drei, Zustand and Tailwind CSS. There's no backend: progress lives in `localStorage`.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build locally
```

Handy URL flags while testing (development builds only, `npm run dev`; production ignores them and doesn't even ship the code):

- `?debug` shows a small panel to set a habitat's size level (1–5), expand for free with the full animation, fill the habitat to capacity, fake the time of day, add pearls, spawn specific visitors or an old friend from the Sanctuary, lay an egg, and fake being away (2h, or 10h to hit the cap) or unfed.
- `?reducedmotion` pretends the device asked for reduced motion (to test the fades instead of the growth and swim-off animations).
- `?gallery` shows every procedural creature model; `?gallery=ocean` (or `swamp`, `reef`, `deep`) shows one habitat bigger.

## Deploy to Vercel

1. Push the project to a GitHub repo.
2. In Vercel, choose **Add New → Project** and import the repo.
3. Vercel detects Vite automatically: build command `npm run build`, output directory `dist`. No environment variables are needed.
4. Deploy. You get a `*.vercel.app` URL; add a custom domain later under **Settings → Domains** if you want one.

Or from the terminal: `npx vercel` (preview) and `npx vercel --prod`.

## Where to tweak balancing

All balancing numbers live in data files, not in components:

| What | File |
|---|---|
| Species: cost, pearls/sec, size, rarity, how they're obtained, color variants, tricks, codex facts | `src/data/creatures.ts` |
| Repeat-purchase growth (1.15×), space per size (S1/M2/L5/XL15), visitor rarity weights | `src/data/creatures.ts` |
| Habitats: unlock cost, codex rewards, camera, fog, Lv1 decoration grid | `src/data/biomes.ts` |
| **Expansion per habitat**: space at each of the 5 levels, Lv2 cost and cost growth, how much the diorama grows, the free terrain feature per level | `expansion` in `src/data/biomes.ts` |
| **Expansion, shared**: size multipliers per level, new decoration slots per level, terrain feature names, animation length | `src/data/expansion.ts` |
| First-full-expansion reward | `ECONOMY.expansion` in `src/state/economy.ts` |
| **Release refunds**, Undo time, when a confirm is needed, animation length | `ECONOMY.release` in `src/state/economy.ts` (rules in `releaseRefund()` just below it) |
| Sanctuary size and how often old friends come back | `ECONOMY.sanctuary` in `src/state/economy.ts` |
| Decorations: cost, happiness bonus, visitor boosts, hideouts | `src/data/decorations.ts` |
| Daily goals: the pool, targets, reward size (minutes of income) | `src/data/goals.ts` |
| Starting pearls, offline rate and cap, happiness rules, visitor timing, egg rates and variant chance | `ECONOMY` in `src/state/economy.ts` |
| Audio file paths (placeholders; the game synthesizes soft sounds without them) | `src/data/audio.ts` |
| Third-party asset credits | `src/data/credits.ts` |

### Current pacing

Simulated for a casual player (about four 4-minute check-ins a day, feeding each time, buying an expansion as soon as it's affordable):

| Milestone | When |
|---|---|
| Coral Reef (2K pearls) | Day 1, second check-in |
| Freshwater Swamp fully expanded | Day 1–2 |
| Coral Reef fully expanded | Day 2 |
| Open Ocean (45M) | Around day 3 |
| Open Ocean fully expanded | Around day 7–9 |
| Deep Sea (3B) | Around day 6–8 |
| Deep Sea fully expanded (the long-term goal) | Roughly 2–3 weeks |

Expansion costs follow `baseCost × costGrowth^(level − 2)`:

| Habitat | Space Lv1 → Lv5 | Lv2 | Lv3 | Lv4 | Lv5 |
|---|---|---|---|---|---|
| Freshwater Swamp | 10 · 18 · 28 · 42 · 60 | 300 | 6K | 120K | 2.4M |
| Coral Reef | 20 · 32 · 48 · 68 · 90 | 40K | 360K | 3.2M | 29M |
| Open Ocean | 60 · 90 · 130 · 180 · 240 | 100M | 320M | 1B | 3.3B |
| Deep Sea | 50 · 80 · 115 · 160 · 210 | 3B | 7.5B | 19B | 47B |

Visitors and eggs (which the sim ignores) speed things up a bit. Playtest and tune from there.

## How the game works

- **Pearls** come from every creature: `pearlsPerSec × habitat happiness`.
- **Happiness** runs from 0.5× to 1.5×. Decorations add to it (each kind counts once), feeding gives a small boost for 2 hours, and after 12 hours without food it drifts down slowly, never below 0.5×.
- **Offline earnings** pay 50% of live income for up to 8 hours. Clock changes are clamped, so a wrong system time can't break a save.
- **Visitors** show up every 3–8 minutes. The timer runs on the real clock and is saved, so it keeps going in another tab or with the game closed; when it's up, one visitor waits for you (never more than one), and the timer only restarts after that visitor is befriended, let go or swims off. Tap one (or "Say hi") within 25 seconds to befriend it (the 25 seconds pause while the tab is hidden). Missed ones are logged as "spotted" in the codex. Decorations raise the odds of specific visitors (a krill swarm draws blue whales, a whale fall draws sperm whales).
- **Eggs**: two or more of a species in one habitat sometimes lay eggs, offline too, up to 3 waiting. Tap to hatch; about 1 in 10 hatches a color variant, which gets its own codex entry. Giants (XL) don't breed.
- **Day and night** follow your real local clock (dawn 5–7, dusk 17–19). Nocturnal species tuck into hideouts by day and come out at night; day species rest on the bottom at night. Fireflies come out over the swamp. Sunlight never reaches the Deep Sea.
- **Daily goals**: three small optional goals each day, reset at local midnight. No streaks.
- **Giants** (whales, whale shark, giant squid) swim a wide loop that passes beyond the diorama walls and dissolves at the glass, which sells their size. Humpbacks occasionally breach, dolphins leap, and sperm whales dive in from above.
- **Capacity**: each habitat has space points. Small creatures use 1, medium 2, large 5, giants 15.
- **Expansion**: each habitat grows through 5 size levels. Buying one (Shop → Habitat, or tap the space counter in the top bar) shows a glowing outline of the next size first, then the walls slide out, new floor fills in, a free terrain feature pops up and the camera eases back (about 2 seconds; tap to skip; a quick fade with reduced motion). Each level adds space, 2–4 decoration spots and a feature like a mangrove edge, a rock arch or a second vent. Creatures, visitors and whale loops use the new size right away; decorations never move. The first habitat to reach full size gives a one-time pearl gift.
- **Release**: tap a creature and choose Release, or open Shop → Habitat → Manage creatures to release several of one species at once (a count stepper, so a big school isn't 30 taps). Released creatures turn, swim off toward the edge with a sparkle and fade (a plain fade with reduced motion). The codex keeps them as owned. Everyday releases happen in one tap with a 5-second Undo; rares, legendaries and batches of 5 or more ask first and show the space freed, the income lost and the pearls back.
- **Refunds**: species with a shop price give back 25% of their unscaled `baseCost`, so buying and releasing always loses pearls. Visitor-only species give back a few minutes of their habitat's income (2 for uncommon, 5 for rare, 10 for legendary), never less than 25% of that biome's cheapest shop creature.
- **Make Room**: when a visitor or an egg doesn't fit, a picker lists the habitat's creatures (lowest rarity and income first) with how much space each frees, then "Release & Welcome" or "Release & Hatch". The visitor's timer stays paused while you choose. Eggs never hatch past capacity and never disappear: they wait with a "Needs X space" badge, and the away summary mentions them.
- **Sanctuary**: released rares and legendaries are listed in a Sanctuary tab in the codex (up to 30, oldest dropped first). Now and then one comes back as a visitor marked with a heart; befriending it brings it home and takes it off the list.
- **Saves** autosave every 15 seconds and whenever the tab is hidden. They carry a version number with migrations: v1 → v2 (eggs, goals, onboarding), v2 → v3 (expansion) and v3 → v4 (the Sanctuary list for releases; nothing else changes). The v3 step turns the old capacity level into a size level (the smallest level with at least as much space, so nobody loses room) and moves decorations from grid indices to stable slot keys at the exact same positions. Settings has Export, Import and a reset that needs three taps.
- **Graphics**: High adds shadows, caustics, sun shafts and Deep Sea bloom. If frame rate drops, the game first lowers pixel density, then switches to Low once (with a message).

## Swapping in real 3D models

Every creature is a procedural low poly model built in `src/scene/models/creatureModels.ts`, so the game needs zero external assets. To use a `.glb` instead, put it in `public/models/` and set `modelUrl: "/models/your-file.glb"` on the species in `src/data/creatures.ts`. Only use CC0 or CC-BY models (Quaternius, Kenney and Poly Pizza are good sources), and add each one to `src/data/credits.ts` so it shows on the Credits screen.

## Adding sounds

Drop files into `public/audio/` and set their paths in `src/data/audio.ts` (one ambient loop per habitat, an optional music loop, and four UI sounds). Anything left `null` falls back to soft synthesized sounds. Sound is off by default.

## Project layout

```
src/
  data/      species, biomes, decorations, goals, expansion levels, pure habitat geometry
             (size per level, terrain, stable decoration slots), audio paths, credits
  state/     zustand store + save migrations, pure economy, visitors, eggs, expansion, release, game loop
  scene/     R3F diorama, lighting and day/night, creatures, schools (instanced boids),
             movement, swim shader, decorations, eggs, visitors, deep-sea bloom
  ui/        top bar, bottom nav, shop, decorate, codex, habitats, goals, settings,
             onboarding, credits, modals
  utils/     number formatting, time and day/night, audio
```

## Build status

All 13 steps of the original brief are done, plus the Tank Expansion and Release updates: four habitats (Freshwater Swamp, Coral Reef, Open Ocean, Deep Sea) that each grow through 5 size levels, with 38 species, 10 color variants, 33 decorations plus 16 free terrain features, visitors, eggs, releasing and a Sanctuary, codex, day/night, daily goals, onboarding, sounds and a performance pass. Polar Waters and the other stretch goals are next if wanted.
