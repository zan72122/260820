# Fire & Ice: Baked Alaska

A photoreal 3D mobile-web game for young children. One session runs 2–3 minutes:
lift the mould off a frozen ice-cream dome, pipe it white with meringue, torch the
surface gold with a pastry chef's kitchen torch, then cut it open and see the cold
layers inside.

Built with **Vite + TypeScript + Three.js (WebGL 2)**, tuned for mobile Safari.

---

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # typecheck + production bundle into dist/
npm run preview    # serve dist/ on http://localhost:4173
```

```bash
npm run typecheck  # tsc --noEmit
npm run test:e2e   # Playwright smoke run, iPhone + iPad, both orientations
```

### URL switches

| Query | Effect |
| --- | --- |
| `?fast=1` | Fast profile: DPR 1, small paint mask, no shadows, no flame extras. Used by the E2E run. |
| `?q=low\|medium\|high\|fast` | Force a quality profile (auto-detection always picks `fast` on a software renderer). |

---

## The session

| Beat | What the player does | What the game does |
| --- | --- | --- |
| Cold dome | swipe up | the mould lifts off a frosted, frozen dome on a sponge base |
| Meringue | drag | white meringue ropes and peaks appear under the finger along guide bands |
| Torch | tap | a short blue flame lights on a realistic kitchen torch |
| Bake | drag | only where the flame passes turns cream → gold → amber |
| Stop | tap | flame, hiss and glow all stop |
| Reveal | swipe down | the knife goes through, the slice slides out, the camera moves to the cut face |
| Replay | tap | one tap to play again, plus an optional flavour tap |

Everything is one finger. There is no score, no timer, no failure state and no way
to burn the cake black — the browning ramp is clamped at a deliberately beautiful
amber.

---

## How the two peaks are built

**Meringue that follows the finger.** A single low-resolution render target in
dome-UV space carries three accumulating channels — `R` coverage, `G` browning,
`B` ridge phase. Piping stamps `R`+`B`; the flame stamps `G`. Because the mask
lives on the GPU and is only ever added to, the browning the player painted
survives pauses, camera moves, HUD taps and device rotation.

Around that mask sit two pieces of real geometry:

* a **shell** whose vertices are displaced outward by coverage and ridge phase,
  discarded where coverage is zero, with its normal bent per pixel from the mask
  gradient (so ridges self-shade); and
* a few hundred **instanced star-nozzle peaks** with real flutes, tips and lean,
  popped in as the finger passes over their slot.

**Browning that reads as "I burnt that ridge".** The browning ramp is modulated by
height: peak tips brown well before the valleys between them. The same mask is
sampled by the sliced cross-section, so the golden rim on the cut face is exactly
the crust the player made.

---

## Architecture

```
src/
  core/       renderer + quality profiles, camera rig, pointer input, audio, settings
  scene/      procedural textures & geometry, paint mask, materials, cake,
              meringue, kitchen, tools, flame, cold air
  ui/         the CSS HUD (coach line, settings, finish card) — nothing else
  game.ts     phase machine, tool placement, per-frame update
```

* **Cutting is not runtime CSG.** The cake is modelled pre-split into a wedge and
  a remainder, each with its own sponge, ice cream, shell, peaks and cross-section
  faces; the reveal is one rigid animation on the wedge.
* **Shadows** are limited to one directional light and the hero objects.
* **Device pixel ratio** is capped per quality profile (2 / 1.75 / 1.4 / 1).
* **Textures** are all generated at boot from a seeded noise field — no image
  downloads, and a run is reproducible.
* **Losing the WebGL context** shows a clear restart route rather than a
  half-restored cake.

## Safety framing

The torch is held by an adult pastry chef — a gloved-clean hand, chef's cuff and a
correctly proportioned tool, at a working distance from the cake. The child never
holds the flame. This is carried by posture, scale and tool construction rather
than by warning text.

---

## Known limitations

* **WebGPU is a capability signal, not a render path.** Where `navigator.gpu`
  exists the game raises its own quality budget (bigger paint mask, flame
  extras, full backdrop), but every frame is still drawn through WebGL 2 so the
  behaviour is identical on mobile Safari.
* **The E2E run judges behaviour, not looks.** It executes on SwiftShader, where
  frame rate, animation smoothness and final image quality are meaningless.
  Performance, visual-regression and GPU work belong on hardware-accelerated
  runners.
* **A lost WebGL context ends the round.** The paint mask lives only on the GPU,
  so the game offers a clean restart instead of pretending to recover it.
* **Peaks are whole instances.** Peak footprints are nudged clear of the two
  pre-split planes so none of them straddles the cut; the shell closes the seam.
* **The kitchen behind the cake is deliberately cheap** — boxes, lathes and
  desaturated materials. It exists to give depth and colour temperature, not to
  be looked at.

---

## Dev tooling

Two small drivers sit in `scripts/`, both pointed at a running `npm run preview`:

```bash
npm run playthrough              # full session driven with real pointer input
npm run shots -- p 390 844 high  # one still per beat: name, width, height, quality
```

Screenshots land in `.shots/` (git-ignored). Both use the Chromium already on the
machine via `CHROME_PATH` (default `/opt/pw-browsers/chromium`).
