# KERNING CANYON

A photoreal-leaning 3D physics toy for small children (4+), playable in a
mobile browser. The hero is not the letters — it is the negative space
between two letters, and how that space changes function as the letters
move closer or further apart on their rail.

An outdoor hydraulic letterform test facility: giant precast concrete
letters stand on steel transfer bogies. Slide the moving letter along its
embedded rail, pull the water valve, and a wooden test capsule pours in
with a little water from the traveling feed chute:

- **too far apart** — the capsule drops straight through to the safety net
- **too close** — it wedges gently at the pinch and the water flows around it
- **just right** — the negative space becomes a canyon: the capsule is
  guided from wall to wall down into the recovery tray riding on the bogie

Three letter pairs, one rule: **AV** (a straight-walled wedge), **OO**
(a channel between two round side bearings), **LT** (a covered bridge from
the L's foot to the T's side). Only the spacing ever changes.

## Play

```
npm install
npm run dev        # then open on a phone/tablet on the same network
```

One-finger controls:
- **drag the moving letter** (or its bogie/handle) left and right
- **press the valve wheel** (bottom right) to run a test
- **swipe sideways** (or tap the plate that appears) for the next pair
  after a successful pass

No score, no timer, no failure noises. Progress and spacing survive
rotation and reload (localStorage).

## Engineering notes

- Vite + TypeScript + three.js, WebGL2. No downloaded assets: glyphs,
  textures and audio are all generated from fixed seeds.
- One canonical glyph set (`src/core/glyphs.ts`) drives the extruded
  meshes, the 2D collision outlines, and the scanline evaluation of the
  gap — silhouette, physics and reading always agree.
- Deterministic fixed-step physics (circle vs. polygon soup, 120 Hz) with
  a terminal fall speed so the descent stays readable; the classification
  bands per pair are wide on purpose — a range that flows, not one exact
  position.
- Camera grammar per trial: 3/4 establishing view → near-frontal for
  adjusting → low tracking view during the pour → frontal again for the
  result, so each pair is always read as letters at the end.

## Verification

```
npm run typecheck
npm run build
npm run test:e2e   # Chromium; deterministic via window.__kc hooks (?e2e)
```

E2E covers: the auto demo pour within the first 30 s, all three outcomes
for all three pairs, the full AV→OO→LT→AV loop, real pointer drag /
valve press / swipe, four viewports (390×844, 844×390, 1024×1366,
1366×1024), rotation persistence, and zero console errors.

`tests/debug-shots.mjs` captures full-quality screenshots of key moments
(preview server on :4173 required). `?low=1` forces the reduced quality
profile; `?e2e&hq` keeps hooks with full quality.

Known environment caveat: the containerized NVIDIA GL driver used by
headless Chromium in this workspace exhibits a history-dependent shadow-map
bug (directional shadows vanish in larger scenes; the identical code path
renders them in reduced scenes). Grounding therefore never relies on shadow
maps alone — contact AO blobs under the letters carry it — and shadow-map
quality should be judged on a real device, per the project's WebGL policy.
