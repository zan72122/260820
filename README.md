# ひかる金魚ねぶた — Hikaru Kingyo Nebuta

A mobile web game for four year olds about building a kindergarten mini-nebuta and pulling it
through the yard after dark.

You start in front of a skeleton of bamboo, cedar and wire that does not yet look like
anything. You paste big sheets of paper onto it and smooth them out with a fingertip, and the
lines become surfaces. You trace the sumi outlines, the teacher lays the wax resist, you dye
it whichever colours you like. It dries, it goes on the cart, the yard turns to dusk, and you
press the big switch. Then you pull the rope.

Built with Vite, TypeScript and Three.js. Every texture, sound and shape is generated at
runtime; the build ships no external assets.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production bundle into dist/
npm run preview    # serve the production bundle on :4173
```

Requires WebGL 2. Tested against iPhone and iPad viewports in both orientations.

Useful query parameters while developing:

- `?tier=high|standard|low` — force a quality tier instead of detecting one
- `?stage=lightUp` — jump straight to a chapter (`intro`, `firstPaper`, `freePaper`, `ink`,
  `wax`, `dye`, `dry`, `toYard`, `lightUp`, `parade`, `finale`)

## Tests

```bash
npm run typecheck        # tsc --noEmit
npm run test:smoke       # boots the built game in Chromium, asserts a clean console
npm run test:e2e         # the whole suite
```

The suite covers:

| Spec | What it holds to account |
| --- | --- |
| `smoke` | boots the production bundle, console stays clean |
| `framing` | the nebuta and the switch stay on screen at 390×844, 844×390, 1024×1366, 1366×1024 |
| `ui` | swatches fit, are at least a 72 px target, and nothing overlaps at all four sizes |
| `journey` | the craft, end to end: a sheet dropped in the wrong place, the first sheet and its smoothing, pasting the rest in whatever order, fast and slow sumi, layered dye |
| `night` | rotate the device, light up, off and on again, pull, swing, leave the tab and return, finish, and the three replay cards |
| `perf` | drawing never adds objects, meshes or shaders; the parade stays inside the yard |
| `shots` | skipped unless `SHOT_DIR` is set; writes reference frames per chapter per viewport |

Playwright runs Chromium only, one worker, no video. On a machine without a GPU the game
falls back to the low tier and runs under a software rasteriser, which is fine for behaviour
but says nothing useful about frame rate — judge performance on real hardware.

## How it is put together

```
src/
  core/        renderer plumbing: quality tiers, viewport and safe areas, one-finger input,
               the camera director, and a small threshold-bloom + ACES post chain
  nebuta/      the sculpture: parametric shape, bamboo/wood/wire frame, paper panels and the
               washi material, the paint atlas, the baked interior lighting, the lamps
  world/       craft room and yard, sky and image-based lighting, cart, rope
  game/        the chapters of a play session and the interaction rules
  audio/       every sound, synthesised
  ui/          the thin DOM layer: one hint, the dye swatches, one button, the picture menu
```

Three ideas carry most of the game:

**The paint atlas.** Everything a finger leaves behind lives in three shared render targets
packed as a 4×4 atlas of panel tiles — paste and smoothing, sumi and wax, and dye. Strokes
are batched instanced quads, one draw call per brush kind per frame, so scribbling never
multiplies meshes.

**The paper.** Panels blend between four baked states — held in the hand, edges caught on the
frame, stretched from the centre, dry and taut. The "smoothed" amount is a texture the child
paints, sampled per vertex, so creases genuinely retreat outward under the fingertip. No cloth
simulation anywhere.

**The interior light.** Before play begins, each panel is rasterised into its atlas tile and,
per texel, rays are traced to the three interior lamps and tested against the frame members.
The result — what each lamp delivers, and how much frame sits behind the sheet — is stored
once. At night the washi shader reads it, so the lamp light respects the bamboo lattice, the
sumi blocks it, the wax lets it through and the dye colours it, all without a dynamic light
inside the paper.
