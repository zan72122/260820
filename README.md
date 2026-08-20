# さつまいも ほり — Sweet Potato Digging

A realistic 3D sweet-potato harvest for a four-year-old, played with one
finger on an iPhone or iPad. There is no text, no score and no menu tree:
above ground you only see leaves and vines, and everything you learn about
what is under the ridge, you learn by digging it up.

## Playing

Nothing is explained in words. A hill is worked like this:

1. **Follow the vine** — drag along the stem that crosses the ridge. The
   leaves rustle, the stem draws taut and the camera travels with your
   finger to the crown of the plant.
2. **Set the fork** — drag the digging fork to the soil beside the hill. It
   snaps to a safe arc so the tines never land on the crop.
3. **Lever the handle down** — swipe downward. The ridge lifts, clods crack
   apart, and the single fissure over the crown opens far enough to show one
   purple tip.
4. **Brush the soil** — rub over the crown. Soil sinks away where your finger
   passes, and one root after another comes into view.
5. **Pull the crown up** — drag upward. Each tuber breaks free on its own
   delay, so a cluster appears rather than a single potato.
6. **Shake it** — swipe left and right to knock the wet soil off the skin.
7. **Set it in the crate** — drag toward the crate and it is laid down.
8. **Take the next vine** — a nearby vine stirs in the wind. No results
   screen: follow it and the next hill begins, with far less guidance.

Five cluster shapes rotate — a short fat bunch, a long slender one, one big
root with small ones, a curved bunch, and one with a root hidden out under a
clod — so the question "what is under this one?" stays alive.

If nothing is touched, help arrives quietly: at 3 s the leaves at the vine
tip stir, at 6 s a gloved hand reaches in beside the vine, at 9 s a finger
traces the first stretch of stem once. From the second hill on, almost all of
that is withheld.

The gear button opens three controls: volume, weaker motion, and haptics.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173  (also served on the LAN for a real phone)
npm run build      # typecheck + production bundle into dist/
npm run preview    # serve the built bundle
```

Add `?fast=1` to the URL to drop resolution, shadow size and background crop
density. That exists for GPU-less CI machines, not for players.

## How it is built

TypeScript, Three.js and Vite; WebGL 2; no downloaded assets at all. Soil,
skin, wood, steel and leaf maps, the sky and its image-based lighting, and
every sound are generated in the browser at start-up.

- `src/core` — renderer and frame loop, one-finger pointer, procedural audio,
  settings, quality profile.
- `src/gfx` — procedural PBR textures, sky/IBL, shared soil detail shader.
- `src/world` — terrain and ridges, the diggable soil patch, parametric
  tubers and roots, foliage, props, particles.
- `src/game` — camera rig, phase director (one gesture per phase), layout.
- `src/ui` — the hint finger and the settings panel.

The soil the player touches is a single 1.9 m patch per hill: a painted mask
sinks the surface toward a bowl carved under the crown, with the surface
normal recomputed analytically so a hollow shades like a hollow. Nothing else
in the field deforms.

## Automated play-through

`tests/` drives the real game in Chromium through Playwright. The simulation
clock is handed to the test (`window.__imo.manual/tick`) so results do not
depend on frame rate, and `window.__imo.state()` reports phase, dig coverage,
exposed roots and screen positions.

```bash
node tests/play.mjs phone      # whole loop at one device size
node tests/rotate.mjs          # dig state survives portrait/landscape changes
node tests/robust.mjs          # hint escalation, then 140 random taps and flicks
node tests/kinds.mjs           # three hills in a row, one screenshot per cluster
```

Screenshots land in `shots/`.
