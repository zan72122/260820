# LETTER FOUNDRY — project notes

Vertical slice of a sand-casting letter game for 4-year-olds
(iPhone / iPad Safari, static hosting).

## Stack
- TypeScript + Three.js (WebGL2, WebGLRenderer) + Vite, no runtime assets:
  all geometry, textures and audio are generated procedurally at boot.
  `npm run dev` / `npm run build` / `npm run test:e2e`.

## Key decisions (verified in this repo)
- **Canonical glyph source** (`src/game/glyphs.ts`): each letter is contour
  data (outer + counters). The pattern extrusion, the sand mold depression
  mask, the melt flow-order field, the cast letter and the HTML letter-rack
  SVGs are all derived from the same contours, so 原型 / 鋳型 / 鋳造体 always
  match. Counters automatically become sand islands (mask holes) and cast
  holes (extrusion holes).
- **Sand is a CPU heightfield** (`sand.ts`), rewritten only while animating
  (press / crumble), not per idle frame. Cavity edges get noise jitter so
  the grid never reads as stair-steps. No runtime CSG.
- **Melt fill** (`letterMeshes.ts`): per-vertex flow order comes from a BFS
  over the mold mask from the gate; the fragment shader discards ahead of
  `uFill`. Front glow + temperature emissive are tuned against ACES
  desaturation (emissive kept ≈ 1.0, deep-red hot color); reflections
  (`envMapIntensity`) fade in as `uTemp` drops so molten metal is
  self-luminous, cold bronze is reflective.
- **Directed camera** (`camera.ts`): one pose per phase, portrait/landscape
  variants, smooth moves only (no cuts during causal moments). Rotation
  reframes without touching game state.
- **Input is phase-scoped and full-screen tolerant** (`Game.ts`): any drag in
  the right direction drives the active control; exact hit targets are not
  required. E2E driver (`window.__LF`) calls the same setters as gestures.
- **Guidance without text**: idle touch-ring hint (DOM overlay) with per
  letter delays (O 2.5s → A 5.5s → B/C 9s).
- Audio is WebAudio synthesis (`audio.ts`), unlocked on first pointerdown;
  letter name via speechSynthesis (ja-JP) after the reveal only.
- `?e2e=1`: shorter observation waits, dpr 1, higher dt clamp so logical
  time tracks wall clock under SwiftShader.

## Verified
- `tsc`, `vite build`, Playwright suite (4 specs) green: full O→A cycles,
  islands B=2 / C=0, real pointer gestures, rotation keeps phase,
  no console errors (favicon 404 fixed with inline SVG icon).
- Screenshot passes at 390×844 / 844×390 for O, A, B cycles: island(s)
  visible in mold, molten fill reads orange, finished letter faces camera
  with holes showing the shop.

## Known limits (deliberate for the slice)
- Melt is a controlled-volume fill front, not fluid simulation.
- Pattern face vs impression chirality is normalized so the letter reads
  correctly from the camera at every step (kid-readability over strict
  foundry chirality).
- FPS-based quality tiers drop pixel ratio / shadow size / particles only;
  glyph silhouettes are never simplified.
