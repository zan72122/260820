# Secret Inside Cake

A realistic WebGL piñata-cake game for a four year old on an iPhone or iPad.

Build a layered sponge cake with a hidden cavity, pour candy into it, seal it
under a plain top layer, hide the seams under buttercream — and then cut it open
and watch the secret pour out.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # typecheck + production bundle into dist/
npm run preview    # serve the built bundle on :4173
npm run test:e2e   # Chromium smoke run over the whole loop
```

## The loop

1. **Base** — drag the first sponge onto the turntable; it sinks slightly as it lands.
2. **Buttercream** — one broad swipe spreads a layer.
3. **Ring layers** — two sponges with a 7 cm hole stack up into a cavity.
4. **Pour** — hold anywhere to tip the bowl; candy rattles down into the hole.
5. **Lid** — a solid layer closes the secret. An x-ray beat shows what is now hidden.
6. **Coat** — swipe sideways to spin the turntable past the spatula; the x-ray fades
   out exactly as the coat closes, and the cake looks completely ordinary.
7. **Cut** — one downward swipe drives the knife; the second cut runs itself.
8. **Spill** — the slice slides out, and the candy pours forward onto the board.

Then tap もういちど and the next cake has different candy.

## Query flags

| flag | effect |
| --- | --- |
| `?fast=1` | test profile: pixel ratio 1, no shadows, fixed candy count |
| `?seed=N` | deterministic candy colours, shapes and amount |
| `?shadows=0` / `?shadows=1` | force dynamic shadows off or on, independently of `fast` |
| `?debug=1` | on-screen state readout |

## How it is built

- `src/world/geom.ts` — ring/disc **sector** solids. Every layer exists both as an
  intact 360° solid and as a pre-split pair (remaining body + slice), so the cut is
  a mesh swap, never runtime CSG. Material group 0 is the baked outside, group 1 is
  the open crumb, which is what makes the cross-section readable.
- `src/world/cake.ts` — the cake itself: four sponges, three buttercream layers, and
  the outer coat. Buttercream and coat reveal by `setDrawRange` over an
  angle-ordered index buffer, so a swipe spreads them with no geometry rebuild.
- `src/sim/candy.ts` — ~80 candies as spheres against analytic walls (cavity
  cylinder, cut planes, board, bench), uniform-grid pair contacts, fixed 1/60
  timestep, sleeping bodies, four `InstancedMesh` shapes. No physics library.
- `src/core/cameraRig.ts` — one authored shot per beat. In portrait the vertical
  field opens up rather than the camera backing off, so an 18 cm cake fits across a
  narrow screen without a wide-angle lens bending it.
- `src/world/textures.ts` — every surface is painted procedurally at boot; there are
  no binary assets in the repository.

## Known limits

- WebGL2 required; there is no 2D fallback.
- The key light sits front-left, so its cast shadows fall away from the camera.
  Contact with the board and bench is carried by soft decals under the cake, the
  slice, the bowl and the turntable rather than by the shadow map.
- The E2E run uses SwiftShader, so it proves the loop, not the frame rate or the
  final look. Judge those on real hardware.
- The tablet E2E projects check boot and framing only; the full loop runs on the
  phone-sized surfaces to keep the suite bounded.
