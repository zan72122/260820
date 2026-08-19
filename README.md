# おはなクリーム — Buttercream Flower Studio

A photoreal-leaning 3D buttercream piping game for iPhone and iPad, built with
Vite, TypeScript and Three.js. One finger squeezes a piping bag, a stainless
flower nail turns, and a rose is built petal by petal before being lifted onto a
small cake.

Everything on screen is real WebGL 3D geometry with physical scale (the flower
nail head is 50 mm across). Nothing is a sprite, and no texture or model file is
shipped: all materials are generated procedurally at load.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type check + production bundle into dist/
npm run preview    # serve the built bundle
```

Open it on a phone or tablet on the same network with the address `vite --host`
prints. Sound starts on the first touch, as iOS requires.

### URL flags

| flag | effect |
| --- | --- |
| `?seed=123` | fixes the random detail of the flowers |
| `?fast=1` | cheap deterministic profile used by the E2E suite (half resolution, no IBL, no shadows) |
| `?lowres=1` | full materials at half resolution, for software GL |
| `?debug=1` | on-screen act, fps, draw call and cone height readout |

## How it plays

One verb per scene, no written instructions after the first hint.

1. **Put the paper down** — drag the parchment square onto the flower nail; it
   snaps when it is near.
2. **Make the core** — press and hold. Cream flows only while the finger is
   down, and the cone stops growing on its own at a natural limit. A soft chime
   and a light pulse mark the sweet spot.
3. **Inner petals** — draw a short arc. The petal grows live under the finger
   and is cut off when the finger lifts.
4. **Outer petals** — the ghost path lengthens and the petals open outwards.
   The nail turns itself after every petal, so the flower fills out even if the
   child keeps drawing in the same spot.
5. **Move the flower** — drag the steel lifter under the flower and carry it to
   the cake. It seats itself and the petals settle with a small sway.
6. **Again?** — two big buttons: the same colour, or a new one. No score.

Speed, press time and how far the finger travelled feed the petal's thickness,
height and reach, so no two flowers are the same. A wild stroke is never
rejected: it is smoothed, pulled gently onto the ring of the layer being piped,
and given a petal-sized angular span.

## Main files

| file | what lives there |
| --- | --- |
| `src/game/PetalGeometry.ts` | the petal itself: a twin-shell ribbon with a rim, rebuilt every frame while the finger is down |
| `src/game/PetalShaper.ts` | finger path → petal: smoothing, gentle correction, thickness and rise from speed and press time |
| `src/game/ConeMesh.ts` | the growing buttercream core, with the spiral the tip leaves |
| `src/game/Flower.ts` | one flower: cone, petals, layer bookkeeping, geometry merging |
| `src/game/Game.ts` | the six acts, pointer projection, snapping and hand-offs |
| `src/game/CameraDirector.ts` | the fixed shots, portrait and landscape framing |
| `src/scene/materials.ts` | buttercream with a fake back-scatter term, stainless, sponge, parchment |
| `src/scene/Patisserie.ts` | bench, wall, shelf, bowls, cake, lighting |
| `src/scene/Tools.ts` | piping bag, petal tip, the chef's fingers, flower lifter |
| `src/ui/Ghost.ts` | the translucent path and the bead that demonstrates the stroke |
| `src/ui/Hud.ts` | five dots, one pictogram, one confirm button, two colour choices |

## Tests

```bash
npx playwright test              # everything
npx playwright test tests/smoke.spec.ts
```

`tests/smoke.spec.ts` plays a full round on 390×844, 844×390, 820×1180 and
1180×820 and asserts WebGL 2, a finished flower on the cake and a clean console.
`tests/play.spec.ts` covers the tip offset above the finger, cream flowing only
while pressing, petals surviving an orientation change, and two flowers in the
same colour never coming out identical.

## Known limits

- Frame rate, motion and final image quality must be judged on real hardware.
  The suite runs under SwiftShader, where `?fast=1` deliberately drops image
  based lighting, shadows and resolution.
- The chef's hand is a suggestion, not an anatomical model: it is deliberately
  kept behind the bag and cropped by the frame.
- Petals are constrained in radius and height so layers cannot intersect badly;
  a very large deliberate stroke is compressed into that envelope.
- WebGPU is not used. The renderer targets WebGL 2 everywhere.
- Placed flowers stay on the cake for the session only. There is no save.
