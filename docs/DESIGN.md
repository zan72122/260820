# Design notes

The whole game is one moment: a mango lets go, falls for about a fifth of a
second, meets a net, sinks, comes back once, and stops. Everything else exists
to make that moment mean something.

## The one beat, and how it is built

A general-purpose physics engine would have produced a different catch on every
device and a different catch every time. The catch here is a real spring-damper
integrated at a fixed 1/240 s timestep, with every constant derived from what
the moment should look like rather than left to chance (`src/sim/fruitSim.ts`).

- **Peak sink is authored, not emergent.** At the instant of contact the
  stiffness is solved from the impact speed so the deepest point of the cradle
  lands on the designed depth. Drop from 13 cm or from 28 cm and the sink is the
  same to within 6 mm (`tests/fruitSim.test.ts`).
- **Hook spacing changes the catch.** Span maps to a tautness in 0..1, which
  scales the target sink. A narrow, slack hanging sinks about 11 cm and takes
  ~0.10 s to reach the bottom; a wide, taut one sinks about 5 cm and gets there
  in ~0.05 s. Both are safe; there is no way to hang the net that drops the
  fruit.
- **Exactly one return.** Damping is 0.26 until the fruit passes its lowest
  point, then steps to 0.82. The first rebound is clearly visible; the second is
  under a tenth of a millimetre.
- **Free play is a different spring.** Once the fruit is at rest, the vertical
  response switches from the stiff contact spring to a slow bob about where it
  settled (period 0.78 s, damping 0.17), and a fingertip drives the fruit at 30%
  of its own speed. The mesh gives at once under the finger and the fruit takes
  its time: that difference is what reads as weight.
- **Slow motion, not slow physics.** Time scale eases to 0.62 through the fall
  and the first 0.42 s of contact and back out afterwards. Gravity's
  acceleration curve is untouched; it is simply given time to be read.

## Contact that cannot cheat

A mango is not a ball, so a net cradling a sphere would visibly float off the
flatter cheeks. The fruit's surface is a star-shaped radial function
(`mangoRadiusAt`), and the net solver is handed that same function
(`NetSim.setSurfaceRadiusFn`). Two mechanisms then keep contact honest:

- Knots are projected out to the **real skin**, never a nominal radius, so
  nothing can sink into the fruit.
- On first touch, the knots under the fruit are recorded in body-local space and
  held on the surface from then on, so the sheet follows the fruit **upwards**
  through the rebound as well as down.

`tests/netSim.test.ts` measures both directions against the real fruit shape:
nothing buried deeper than 0.1 mm, nothing hovering more than 4 mm.

## The net is cordage, not a card

The sheet is a 15x9 grid of knots joined by real cords, gathered onto a ring at
each end and hung from a suspension cord (`src/sim/netSim.ts`). Every structural
cord is drawn as a tube with thickness and a twisted-fibre normal map tiled at a
fixed pitch, every crossing carries a squashed knot, and the fine netting
between the cords is a separate sheet skinned to the same knots with an alpha
and relief map (`src/world/netMesh.ts`). Nothing simulates thousands of threads;
the coarse grid carries the shape and the fine map carries the gauge.

The long edges of the panel are shortened by 10%, which is why the sheet curls
up into a cradle instead of lying flat.

## Camera

One rig, never cut. A shot is described by **what must stay in frame** — a
target point and half-extents in metres — rather than by a distance, so the same
shot works on a 390x844 phone and a 1366x1024 tablet: the solver picks the
distance that fits the box at the current aspect, inflated by the safe-area
insets (`src/game/cameraDirector.ts`).

- Attach: 52 mm, framing the bench, the hooks and the fruit together.
- Ripening: 58 mm, closing in on fruit and net.
- **Fall: 60 mm, computed once when ripeness passes 0.48 and then frozen
  outright** from the moment the stem starts letting go until the fruit is at
  rest. It is framed from the fruit's shoulder down past the deepest the cradle
  can reach, so peduncle, fruit and net are readable in one frame throughout.
- Settled: 88 mm, easing in only after the catch is over.
- Play: 70 mm, back out to the whole hammock.

No depth of field. The three things the causality depends on are never blurred.

## Discovery without words

The initial screen has no text, no arrow and no card. What it has:

- Two brass rings on the ends of the net, catching the light.
- Only the loose side stirring in the greenhouse breeze.
- One reflection off the hooks, about a second in.

After 4.2 seconds of no input the free cord end reaches a short way towards its
nearest hook and comes back — an impulse, not a teleport, and it never arrives.
Once the net is hung, the same silence moves to the sun: its glow pulses and the
day shifts a little and back.

The magnet that takes a cord end onto a hook is measured **on screen**, not in
the world. The branch sweeps in depth, so a hook that looks a fingertip away can
be 16 cm behind the plane the finger is dragging in. What the child sees decides.

The cord end also rises clear of the fingertip shortly after the grab, so the
thing being dragged is never hidden by the hand dragging it.

## Time

One number moves the sun's arc, the colour temperature, the ambient bounce, the
patch of window light sliding across the floor, and the fog — all together
(`Greenhouse.setTimeOfDay`). Ripening is a separate, one-way quantity: scrubbing
the light in either direction always advances it, so a child sweeping back and
forth is always making progress and never losing any. It takes roughly four full
swipes to go from hard green to ready, and the colour spreads a little each time.

The skin's colour is resolved in the shader from a single ripeness uniform and a
per-texel *ripening order* baked into the fruit's data map. Because every patch
of skin has its own turn, green, yellow, orange and red are all on the fruit at
once, the blush creeps out from the flank that faced the light, and the shoulder
in the shade of its own stem is still turning when the sun cheek is finished.

## Deliberate scope decisions

- **WebGL 2 only.** WebGPU would add nothing at this scale — the frame is a few
  thousand triangles and one shadow map — and would add a second render path to
  keep correct. The brief allows WebGPU only as extra quality where available;
  the honest call was to leave it out rather than ship a second untested path.
- **No glTF, KTX2, Meshopt or Draco.** There is nothing to compress: all
  geometry and all maps are generated at boot (see [ASSETS.md](ASSETS.md)).
- **Quality tiers reduce shadow resolution, leaf density, dust, texture size and
  cord segment count. They never reduce the fruit, the net or the catch**, and
  the simulation grid and every physics constant are identical on all tiers.

## Screenshot audit

`npm run shots` captures five moments — before, hung, ripe, mid-air, deepest
cradle, free play — at 390x844, 844x390, 1024x1366 and 1366x1024. The audit is
deliberately finite: five failure modes, nothing else.

| Looked for | Found | Fixed by |
| --- | --- | --- |
| Floating contact | The net gripped a nominal sphere, so knots hovered off the flatter cheeks | Solver evaluates the fruit's real radial function; contact patch held in body-local space |
| Plastic-looking fruit | Flat orange with no relief: the packed data map had gone through a 2D canvas, whose premultiplied alpha had zeroed the ripening-order channel | `DataTexture` for the data map; lenticels, mottle and a calmer relief map |
| Slab-like net | The fine sheet read as lace and buried the cords | Thicker cords, a coarser fine gauge, knots as flattened crossings rather than beads, fibre twist tiled at a fixed pitch |
| Drop landing off the net | Nothing: the fruit lands inside the cradle for every hook pair, and lateral offset becomes a gentle sway | Covered by `tests/netSim.test.ts` across all 16 hook pairs |
| Finger covering the action | The grip sat under the fingertip because the grab offset was held for the whole drag | Offset decays after the grab, so the cord end rises above the finger |

## Finished-or-not checklist

| # | Requirement | Where it is satisfied |
| --- | --- | --- |
| 1 | Net ends readable as the first thing to touch, without words | Brass end rings, one-sided breeze, single hook glint — `shots/*-1-before.png` |
| 2 | One weak nudge is enough to get the net onto the hooks | `e2e/interaction.spec.ts` — "one weak hint appears, and it never hangs the net by itself", "a single finger can hang both ends on the hooks" |
| 3 | No cut from before the fall to after the catch | `CameraDirector.freeze` held through `loosening` → `falling` → `cradling` |
| 4 | Peduncle, fruit and net visible at once | `Game.computeFallShot` — `shots/*-4-falling.png` |
| 5 | The fruit has mass, the net has tension | Authored spring, one return, slow bob; cord tubes, knots, deforming fine sheet |
| 6 | The net can be played with after the first catch | `e2e/interaction.spec.ts` — "the net can be pushed from underneath, and the fruit answers heavily" |
| 7 | The second fruit starts the same process with no hint | `e2e/interaction.spec.ts` — "a second fruit starts the same process with no hint needed" |
| 8 | A finger never covers the landing point, either orientation | Cord ends are at the sides; the grip rises above the finger; input is locked through the catch |
| 9 | Nothing important cropped at the four target sizes | Framing solver + safe insets; `e2e/smoke.spec.ts` — "keeps the causal trio framed at every target size"; 24 captured frames |
| 10 | Survives repeated taps, reversed drags, interrupted drags, rotation | `tests/state.test.ts`; `e2e/smoke.spec.ts` — "survives rotation, repeated taps and reversed drags"; `e2e/interaction.spec.ts` — "letting go halfway never teleports the cord end" |
| 11 | Build, type check and state-transition tests pass | `npm run build`, `npm test` (26), `npm run e2e` (9) |

Not claimed: real-device verification. Everything above was run in headless
Chromium on a software rasteriser.
