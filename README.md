# 流しそうめん — Nagashi Somen

A photoreal 3D web game for a four-year-old, made to be played with one finger
in Safari on an iPhone or iPad.

There is no title screen, no tutorial and no text anywhere in the game. It
opens on a half-split green bamboo flume in the summer sun with clear water
running down it. After a few seconds a small bundle of somen comes down from
upstream; the camera drops to the water and rides alongside it while it passes
and disappears. A pair of chopsticks then settles into the bottom of the
frame and catches the light once. Put a finger anywhere on the screen and the
chopsticks follow it; bring them near the next bundle and they close on it.
The somen lifts out of the water dripping, hangs and stretches from the
chopstick tips, and goes into the tsuyu bowl with a small *chapun*. Then the
camera returns to the flume, because another bundle is already on its way.

The whole design goal is that the meaning arrives through the first catch,
without a single word being read.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173, also served on your LAN
```

Open the LAN address printed by Vite on the phone or tablet — it needs to be
a real device to feel right, because the whole interaction is one finger.

```bash
npm run build      # typecheck + production bundle into dist/
npm run preview    # serve the built bundle
```

There are no binary assets. Every texture (bamboo skin inside and out, ground,
foliage, wood) is baked procedurally at load, and every sound is synthesised
with the Web Audio API, so the download is just the code.

## How it is put together

```
src/
  config.ts            world dimensions — the flume, the waterline, the play zone
  core/
    Post.ts            render pipeline: HDR target, bloom, restrained DOF, grade
    Input.ts           a single finger; extra touches are ignored on purpose
    Audio.ts           synthesised water, cicadas, wind bell and the one-shots
  gfx/
    noise.ts           tiling value noise used by the texture bakery
    textures.ts        procedural bamboo / ground / wood / foliage maps
    Sky.ts             analytic sky, also baked into the IBL probe
  world/
    Flume.ts           the split culm: node bulges, wet and dry skins, supports
    Water.ts           the running water: caustics, streaks, node wave trains
    Garden.ts          ground, veranda, trees, and the leaves that cast dapple
    Bowl.ts            tsuyu bowl, its table and the liquid surface
    Chopsticks.ts      the pair, and the highlight that slides down them once
  sim/
    Noodles.ts         somen bundles: verlet strands rendered as tube geometry
    Particles.ts       pooled, instanced water drops
  game/
    Aim.ts             finger position -> (where along the flume, how high)
    CameraRig.ts       the five shots and how they are blended
    Game.ts            the director, the assist, and the frame loop
```

### The things worth knowing

**Nothing is explained, so the staging has to do it.** The director runs a
fixed opening — water alone, then one bundle with the camera riding beside it,
then the chopsticks entering frame and catching the light every couple of
seconds — and only relaxes once the player has caught something. Assist
(capture radius, soft snap towards the nearest bundle) is at its widest before
the first catch and narrows over the next three.

**The finger controls two numbers, not a 3D point.** `Aim` projects the
waterline itself to the screen each frame and reads back "how far along the
flume" and "how high above the water" from where the finger is. That keeps the
mapping natural under any camera and in either orientation, and it means
sideways precision — which a four-year-old does not have — is never required.
The chopstick tips are drawn above the fingertip so the hand never covers the
somen.

**Camera poses live in the active shot's own frame.** A shot that follows a
bundle stores its offset relative to that bundle, so it never trails behind
what it is following; switching between a fixed and a tracking shot converts
the stored pose once, at the cut.

**Somen is simulated, not animated.** Each strand is a ten-node verlet chain:
in the water it is driven towards the flow velocity and floats at the surface,
and once the chopsticks take hold, one node is pinned and the rest hang under
gravity. The visible geometry is a tube resampled from those nodes with a
Catmull-Rom spline and a parallel-transported frame, rewritten in place each
frame from preallocated buffers.

**The water is not simulated.** Its look comes from an analytic slope field
(a few travelling ripple trains, a drag layer at each wall, a standing wave
shed by every culm node, and ring waves from anything that touches the
surface), plus a caustic web on the refracted bamboo floor and aeration
streaks advected with the flow.

**Performance.** Internal resolution is capped at roughly 2.3 megapixels and
scaled by a three-step quality ladder that also drops MSAA, bloom, DOF and
shadow-map size when frame time runs long. One shadow-casting light. Droplets
are a fixed instanced pool. No allocation happens in the frame loop.

### Debug hooks

Loading with `?fixed=0.05` runs a deterministic timestep, and `?quality=0..2`
pins the quality tier. `window.__somen` exposes `info()`, `cut(shot)`,
`skipTo(phase)`, `spawn(pattern, z)`, `frame(L, H, angle, z, fov)` and a few
visibility toggles, which is how the scene was framed and checked in a real
browser.
