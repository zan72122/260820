# 畝の裏側 — Under the Ridge

A 3D mobile web game for a four year old, about the one thing a peanut digger
does that nothing else does: it goes under the ridge, lifts the whole plant out
of the ground, shakes the soil off it and turns it over — and the moment it
turns over, the pods that were never visible are suddenly all there at once.

There is no text in the game. Not on the first screen, not on any screen.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
```

Build and preview the production bundle:

```bash
npm run build      # typecheck + vite build
npm run preview    # http://localhost:4173
```

Open it on a phone or tablet on the same network with `--host` (already set in
the dev and preview scripts).

## The loop

One finger, four gestures, in this order, each of them forgiving:

1. **Drag the lever down.** The hydraulic cylinder shortens, the frame drops,
   the shares go under the ridge and the crust splits ahead of them — in one
   continuous shot, so the cause and the effect are never separated.
2. **Swipe forward** from the bottom of the screen. The machine moves, and the
   plants come out of the ground still packed in soil.
3. **Shake sideways** over the conveyor. The soil falls off in lumps.
4. **Sweep an arc.** The inverter turns the lead plant over, the camera swings
   round low, and the pod side comes to the front.

Then a hold of about two seconds while the dust settles, a wide shot over the
finished row with the next ridge behind it, and one swipe starts the next one.

Nothing fails. A crooked, slow or half finished gesture still works; it just
works a little more slowly. If the player hesitates for three seconds the lever
vibrates a few millimetres and the driver looks at it; only after another few
seconds does a short translucent trail show the shape of the gesture, once.

Each run changes the crop and nothing else: the number of pods, their size, how
damp the soil is, how much of it clings to the roots, and how the finished row
lies.

## Controls the player never gets

No free camera and no driving. The camera is a fixed chain of shots that only
ever glides between positions, and lining up on the ridge is automatic.

## How it is built

- Vite + TypeScript + three.js, WebGL 2, no external assets at all: every
  texture is drawn on a canvas at boot and every mesh is generated in code.
- Sound is synthesised with the Web Audio API — a diesel idle, hydraulic whine,
  the conveyor rattle tied to chain speed, dry soil impacts, and the soft sound
  of the vines landing. The machine ducks by 14 dB at the moment of inversion so
  the crop is what you hear. No music.
- The plants the player is working on (12 per ridge) are individually rigged
  with their own pods, pegs and clinging soil. Everything else is instanced
  scenery with a much cheaper silhouette, and the distant field is a handful of
  instanced bands.
- Adaptive quality degrades in a fixed order — distant density, then particle
  count, then shadow resolution, then render scale. The pod reveal, the soil
  shedding and the inversion animation are never degraded.

### Layout

```
src/game/      Game.ts (state machine + loop), CameraRig, Input, Hints
src/world/     Environment, Field (ridges + dig shader), Plant, Harvester, Debris
src/gfx/       procedural textures, geometry merge helper, quality manager
src/audio/     synthesised machine and soil sound
tests/         Playwright smoke test of the whole loop
```

## Test hooks

The page exposes a read-only snapshot at `window.__ur.state()`. Two query
parameters exist for automation only and change nothing about how the game
plays by hand:

- `?capture=1` keeps the drawing buffer readable so a test can grab the canvas.
- `?step=0.1` runs the simulation at a fixed timestep, so a test measures the
  game's clock instead of the host's frame rate.
- `?fast=1` is the reduced profile for CI (small shadow map, no antialiasing).
- `?inspect=1` renders a single plant on its own, for looking at the asset.

```bash
npm run test:e2e   # Chromium, one worker, iPhone viewport
```

## Known limits

- Verified in this environment under a software renderer (SwiftShader), which
  renders around one frame a second regardless of what the game does. Frame
  rate, animation smoothness and final visual quality have to be judged on real
  hardware; the acceptance runs here checked composition, causality, state and
  layout, not performance.
- Audio starts on the first touch, as iOS requires. In an automated run the
  events are synthetic, so the audio graph is created but never actually heard.
- The camera chain is authored for one ridge at a time; the field holds six
  workable ridges before it starts reusing the last one.
