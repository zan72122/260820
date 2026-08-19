# だいこん機械収穫 — Daikon Machine Harvest

A 3D mobile web game for four-year-olds, playable in Safari on iPhone and iPad.
One finger, no text, no score, no failure state.

The whole game is one causal chain, shown rather than explained:

> **葉をつかむ → スポンと抜ける → 白い根が集まる**
> the belt grips the leaves → the daikon pops out of the soil → the white roots pile up in the crate

Only leaves are visible above the ridge. The machine grabs them, and a white
root the child never knew was there comes out of the ground. That is the whole
idea, and every camera cut, sound and particle exists to serve it.

## Play

- **Tap anywhere** — lowers the harvesting head and the machine starts driving.
- **Drag left / right** — steers between ridges. Alignment is heavily assisted:
  get roughly onto a ridge and the machine snaps to its centre.
- That is the entire control scheme. There is no way to lose, get stuck, or run
  out of work — every ridge except the one just finished regrows, and if the
  player never touches the screen at all the head lowers by itself.

Arrow keys / space also work on desktop, for development.

## Running it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # typecheck + production bundle into dist/
npm run preview   # serve the production build
npm run typecheck
npm run test:e2e  # Playwright smoke tests, portrait and landscape
```

`dist/` is a static bundle with no runtime dependencies and no network requests —
every texture, mesh and sound is generated in the browser at start-up.

## How it is built

- **TypeScript + Three.js (WebGL2) + Vite.** No CSS pseudo-3D anywhere: real
  perspective, real geometry, real occlusion, depth from fog and silhouette.
- **Procedural everything.** `src/gfx/textures.ts` bakes wet loam, soil in
  section, leaf blades with a lobed alpha outline, daikon skin with its spiral
  rooting scars, ribbed rubber, chipped machine paint and honed steel from value
  noise, plus normal and roughness maps. Nothing is downloaded, so there is
  nothing to fail on a phone connection.
- **Real-world scale.** Ridges 0.19 m tall on 1.5 m centres, roots 0.42 m long
  and 78 mm across, the machine 2.8 m nose to crate. The sizes are what make the
  weight read.
- **An environment map baked from the sky** at start-up, so painted metal, steel
  and the plastic crate are lit by the sky rather than sitting flat black.

### The machine

`src/world/Harvester.ts`. A crawler-tracked leaf-grip harvester. Two rubber
belts on vertical pulleys pinch the tops at the mouth, lift the whole plant up
an inclined conveyor, a rotary knife shears the neck just under the pinch line,
the tops are flung clear and the white root drops onto a discharge belt that
carries it back into a slatted crate.

The belt speed is matched to ground speed (`beltSpeed × cos(head angle) ≈
driveSpeed`) exactly as a real one is, so the plant is not dragged along the row
while it is being pulled.

Its whole right flank is deliberately empty — no panels, no rails above the
pinch line, no share crossing the plant line. A four-year-old has to be able to
see the mechanism, so the machine is designed around the camera.

### The pull

`src/game/Daikon.ts` runs each plant through
`standing → grab → strain → pop → ride → fall → convey → drop`.

The feel lives in the first three:

- **grab** (0.15 s) — a shader deformation gathers the leaves in toward the belt
  pinch point; a fissure decal opens around the crown.
- **strain** (0.21 s) — the plant is still anchored in the world while the belt
  has already moved on, so the leaves visibly stretch. It rises 16 mm, shudders,
  and soil crumbles off the shoulder.
- **pop** (0.23 s) — the anchor releases and the plant snaps up to the belt with
  an ease-out-back overshoot, a squash-and-settle on the root, thirty soil clods
  and a synthesised スポン.

### The camera

`src/game/CameraDirector.ts`. The player never controls it. Shots are cut in
film order — establishing three-quarter, working view, the pull in close-up at
0.42× speed, a tight pass along the conveyor, the crate, and a slow arc around
the full crate at the end of a row. A shot that cannot cut in because another is
running stays queued instead of being dropped, so every row shows all of them.

Each shot is authored twice, once for landscape and once for a tall phone, and
blended by aspect ratio — on a phone held upright the camera re-stages itself
further behind the machine so the row runs up the frame instead of the machine
being pushed to a dot in the distance.

### Seeing into the soil

During the close-up the ridge and the field opens a local translucent window on
the camera side of the plant (`Materials.attachWindow`, injected into the
standard material). The soil in front of the plant fades out over a soft ellipse
centred on its axis while the buried root keeps rendering, so the child sees
the white body that was under the ground the whole time — and then sees it come
out. Soil materials swap to blended, non-depth-writing only while the window is
open.

## Performance

Targeted at mobile Safari:

- pixel ratio capped at 2, antialias only under 1.8×
- one 1024 shadow map on a tight frustum that follows the machine
- the crop is two `InstancedMesh` draw calls (≈180 playable plants, ≈900
  decorative), never per-plant meshes; only a handful of plants near the mouth
  are promoted to real animated objects, from a pool of 16
- settled roots collapse into an instanced pile per crate
- a frame-time watchdog drops the render scale, then shadows, if a device cannot
  hold the budget (`?noadapt` disables it for testing)

## Tests

`tests/smoke.spec.ts` runs in Chromium at iPhone 13 portrait and landscape and
covers: boot and first paint, the full grab→pop→convey→crate chain, all four
camera cuts plus slow motion and the soil window, finishing a row and starting
the next, steering between ridges, rotating the device mid-run, and the
no-input path (never tapping still plays).

Tests drive `window.__GAME__.simulate(seconds)`, which advances the simulation
at a fixed timestep, so results do not depend on how fast the software
rasteriser in CI can paint. Frame rate, animation smoothness and visual quality
must be judged on hardware-accelerated GPU, never under SwiftShader.
