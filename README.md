# いねロール — 飼料稲WCS (whole-crop silage) for phones

A one-finger 3-D game about harvesting whole-crop rice silage, built for
iPhone and iPad browsers. Aimed at a four-year-old: **collect the rice,
grow a big round thing inside the machine, and let it roll out the back.**

```
npm install
npm run dev        # http://<your-ip>:5173  — open it on the phone
npm run build      # typecheck + production bundle into dist/
npm run test:e2e   # Chromium smoke suite
```

## The loop

1. **Harvest** — touch and hold anywhere to drive. Slide the finger sideways
   to move onto the next row; the machine snaps itself onto the row centre,
   so aiming is never required. The standing rice bows into the header a
   moment before it is swallowed, and chaff sprays out behind.
2. **The roll grows** — the crop goes up the feed elevator into the roll
   room, where a real cylinder gets fatter. It is visible from outside
   through the bolted inspection window on the machine's left flank: a
   circle that swells until it fills the chamber. The HUD gauge mirrors the
   same numbers, so the two always agree.
3. **Wrap** — one big button. The flank dissolves into a cutaway, the roll
   spins on its belts and white stretch film creeps out from the middle to
   both shoulders.
4. **Eject** — swipe up (or press the button). The tailgate hydraulics lift
   the whole rear shell, and the finished bale drops, bounces and rolls away
   backwards with a thud and a puff of dust. That shot is the pay-off.

Nothing can dead-end: every prompt advances itself if left untouched, the
machine turns itself round at the headland and picks the next row that still
has crop, and when the whole paddy is cut it is celebrated and replanted.

## How it is built

- **`src/core`** — renderer and quality tiers (`Engine`), the shot director
  (`CameraDirector`), one-finger input, and a WebAudio synth. No audio or
  texture files are fetched over the network.
- **`src/world`** — `textures.ts` bakes every surface procedurally on a 2-D
  canvas at boot: wet paddy mud, ripe rice, weathered enamel over steel,
  rubber belt, agricultural tread, compressed straw, stretch film.
  `Environment` builds sky, sun, an IBL probe (without one, painted metal
  renders black), and the near/mid/far depth layers. `Field` is the crop:
  one `InstancedMesh` of rice hills with a vertex-shader hook that blows
  wind through the whole paddy and drags the hills nearest the header mouth
  toward it.
- **`src/machine`** — the harvester is real geometry throughout: panelled
  body with an arched roof, cab, a header wider than the machine (with reel,
  tines, cross auger and knife guards), rubber feed elevator, the roll room
  with its driven rollers and belts, and a tailgate that hinges over the top
  and carries the rear rollers with it. `Bale` and `Chamber` handle the
  growing, wrapping and releasing.
- **`src/game`** — `Game` is the state machine (`drive → full → wrap → gate
  → eject → admire`, plus `uturn` and `cleared`) and owns every camera.
- **`src/ui`** — a deliberately small DOM overlay: one round gauge, a bale
  counter, one big button at a time, and an animated hand when nothing has
  been touched for a while.

Quality tiers pick pixel ratio, shadow-map size, crop density and particles
from device hints; `?fast=1` forces the cheapest settings and is what the
smoke suite runs with.

## Tests

`tests/smoke.spec.ts` drives the game through `window.__game` (Chromium
only, one worker, iPhone viewport) and covers booting, a full harvest → wrap
→ eject cycle, two bales back to back, landscape, the roll growing
monotonically and resetting, clearing and replanting a whole paddy, and the
hands-off case where nobody presses anything.

Frame rate and final visual quality are **not** assessed under the software
rasteriser used in CI — those need a real GPU.
