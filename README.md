# Vacuum Excavation — Find the Pipe

A realistic small-scale industrial 3D game for iPhone and iPad browsers. One
finger, one job: find out what runs under the ground beside the road.

The loop is a single chain of causes:

1. **Locate** — sweep the locator over the ground. A low pulse tightens as you
   near the buried service, and the needle climbs.
2. **Mark** — at the strongest response the operator sprays a small cross.
   Nothing about the pipe is shown yet.
3. **Soften** — the water lance runs only while your finger is down. The
   sprayed footprint darkens, smooths and turns to mud.
4. **Suck** — the big reinforced hose lifts the wet spoil. Dry ground barely
   yields, so the water genuinely matters. Grains rise, accelerate into the
   nozzle mouth and disappear inside it; the hole deepens exactly where the
   nozzle is, and the strata change colour as you go down.
5. **Expose** — the crown of the pipe appears first, then its flanks and
   couplings, as the last skin of soil comes off. Nothing glows, and the
   nozzle is held off the pipe automatically.
6. **Measure** — a banded depth rod goes down beside the pipe. The distance
   between the grade line and the pipe is read from the bands, never a number.

Then the locator answers at the next patch of ground and you go again. Three
sites: a straight plastic main in sand, a cast-iron tee in clay, and a steel
service crossing a cable duct at a different depth in gravel.

## Running it

```
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production bundle into dist/
npm run preview    # serve the production bundle on :4173
```

Open on a phone or tablet and tap the play mark. Portrait and landscape are
both first-class; rotating mid-dig keeps the hole exactly as you left it.

## How it is put together

| Piece | Approach |
| --- | --- |
| Ground | static lot geometry with real gaps under each work patch |
| Excavation | per-site height field with depth, wetness and a cut channel |
| Strata | vertex-tinted layers over one shared, triplanar-sampled soil map |
| Pipes | rigid meshes buried under the field; the field is what hides them |
| Hose | verlet chain with distance, bending and ground-drag constraints |
| Truck & boom | rigid hierarchy with a slewing, telescoping arm |
| Operator | rigid limb chain with analytic two-bone arm IK |
| Water & spoil | one flow ribbon plus small pooled instanced particles |
| Camera | scripted shot per work stage, reframed for both orientations |
| Audio | fully procedural Web Audio, spatialised per source |
| Textures | generated on a canvas at load; no external assets at all |

The pipe can only be uncovered because the excavation removes soil down to a
computed clearance surface and then dissolves the last skin. That same
clearance surface is what stops the nozzle, the rod and the hole itself from
ever touching the buried plant.

### Safety framing

The player's finger drives an adult operator in helmet, hi-vis, gloves and
boots, inside a closed and coned-off work area with nobody outside the
barriers. There is no traffic, no live services to strike, no deep trench, and
no failure state in which anything is damaged.

### Performance

The renderer targets WebGL 2 with a single shadow-casting light. A frame-time
monitor sheds load in a fixed order — particle budget, distant props, shadow
resolution, then render scale — so the water/suction causality, the pipe
reveal and the weight of the hose survive on slower hardware.

## Checking it

`scripts/play.mjs <profile> <outDir> [stopAfter]` drives a real play-through in
Chromium (iPhone/iPad, portrait/landscape) and captures each stage.
`scripts/checks.mjs` asserts the behaviour that matters: nothing is exposed at
launch, the locator response tracks position, dry ground resists the nozzle,
rapid tapping during a tool handover cannot corrupt state, and rotation keeps
the excavation.
