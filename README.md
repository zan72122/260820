# Upside-Down Chiffon / さかさまシフォン

A photoreal-leaning 3D mobile web game for a four-year-old, built around the one
thing that makes a chiffon cake a chiffon cake: **you turn the hot tin upside
down and hang it on a bottle so the cake cannot collapse.**

Not "mix and bake". The whole game is the action chain:

> ふくらむ → **ひっくりかえす** → 逆さなのに落ちない → 型を外す → ふわっと戻る

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # typecheck + production bundle into dist/
npm run preview    # serve the built bundle on :4173
```

Add `?fast=1` for the low-cost profile (device pixel ratio 1, no MSAA, smaller
shadow map) and the deterministic automation hooks used by the tests.

## Playing

Two to three minutes, one verb per scene, no text to read, nothing to fail.

| # | Scene | Touch | What the child sees |
|---|-------|-------|---------------------|
| 1 | そっと まぜる | three big scooping arcs | white meringue streaks even out; bubbles survive |
| 2 | そそぐ | tip-the-bowl drag | a thick ribbon of batter fills the tin, never overflows |
| 3 | オーブンへ | forward swipe | the tin slides onto the rack, the door shuts |
| 4 | ふくらむ | — | behind the glass the batter climbs the central tube and colours; one short cut-away shows the bubbles growing |
| 5 | あつい！とりだす | — | the adult pastry chef's mitted hands lift the hot tin out |
| 6 | **ひっくり かえす** | **one big 180° arc** | tin, cake, hands and shot all turn over together |
| 7 | びんに のせる | wide drag | the central tube seats on the bottle neck with a magnetic snap |
| 8 | さます | — | steam fades, the metal cools, the cake is pulled gently downward and still does not fall |
| 9 | ぐるっと はずす | a fat circle, then a small one | a palette knife opens a dark separation line exactly where the finger has been |
| 10 | うえへ ぬく | up swipe | the tin lifts away and the tall chiffon stays on the bench |
| 11 | おすと もどる | one tap | the top sinks a few millimetres and springs back |

Then pick プレーン / いちご / ココア / まっちゃ and go again — same chain, different
bake colour, crumb and crack pattern.

Guides are drawn large on the first play and faded on every play after that.

## Main files

```
src/
  main.ts                bootstrap: renderer, adaptive pixel ratio, loop, visibility
  game.ts                stage machine, replay, automation state
  world.ts               scene assembly, layout constants, cut-away control
  core/
    dims.ts              real dimensions — the 17 cm tin is the yardstick
    geometry.ts          surface of revolution + relative morph targets
    gestures.ts          arc / circle / drag / swipe / tap in resolution-free unit space
    camera.ts            directed camera, separate portrait and landscape framing
    textures.ts          every texture generated procedurally at runtime
    audio.ts             every sound synthesised — cloth, metal, air, batter
    flavors.ts, math.ts
  objects/
    pan.ts               aluminium chiffon tin: one closed lathe cross-section
    chiffon.ts           batter → risen cake → pressed cake, three stacked morphs
    batterBowl.ts        folding surface: streaks, scoop lift, surviving bubbles
    ribbon.ts            the viscous pour
    mitts.ts, props.ts, steam.ts, separation.ts
  scene/
    kitchen.ts           bench, walls, window, the oven (open casing + real pane)
    lighting.ts          one shadow-casting key, warm side bounce, low fill
    poses.ts             every shot authored twice, portrait and landscape
  stages/                one file per span of the sequence
  ui/hud.ts              the ghost trajectory and the verb pill (CSS/SVG only)
```

## Engineering notes

- WebGL 2 through Three.js for the entire world; CSS/SVG is used only for the
  HUD, the guides and the finish panel.
- One shadow-casting light, its frustum kept tight around whatever the shot is
  about. No SSR, no volumetric steam, no realtime GI.
- Steam is computed entirely in the vertex shader — zero per-frame CPU cost.
- The cake is not a soft body: pour, rise and press are three relative morph
  targets that stack, with a small decaying oscillator for the wobble.
- Cut-aways use one clipping plane aimed at the camera plus a dedicated
  cross-section mesh, never stacked transparency.
- Pixel ratio adapts to measured frame time; portrait and landscape carry their
  own camera positions and FOV rather than cropping one framing.
- `visibilitychange` stops the clock, the audio and every timer, and a
  `pointercancel` or an orientation change parks the tin in a safe pose instead
  of leaving it mid-swing.

## Tests

```bash
npm run test:e2e
```

Chromium only, one worker, one retry, stop on first failure. The suite plays a
complete cake through at 390×844, 844×390, 820×1180 and 1180×820 by dispatching
real pointer events along each stage's own ghost trajectory, and additionally
covers an interrupted flip, an orientation change mid-play, and a hidden tab.

If Playwright's browser download is unavailable, point it at a pre-installed
Chromium:

```bash
PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run test:e2e
```

`tools/capture.mjs` and `tools/spot.mjs` drive the same hooks to capture
screenshots of a full play-through or of a single frozen frame.
