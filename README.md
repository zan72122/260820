# 手回しかき氷 — a hand-cranked shaved ice machine

A photoreal 3D web game for four-year-olds, built with Three.js and WebGL 2.

There is one thing to do here, and it takes about a minute: **turn the handle, watch
the ice turn, watch the snow come off the blade, watch the pile grow, and pour syrup
on it.** Nothing is explained. The handle is just sitting there, and finding out what
it does is the game.

```
handle  →  the block turns  →  the blade underneath shaves it
        →  white snow falls  →  the pile grows  →  syrup soaks in
```

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static output in dist/
npm run test:e2e   # Playwright, Chromium
```

Nothing is downloaded at runtime. Every texture, every sound, and every piece of
geometry is generated in the browser at boot from a fixed seed, so the shop looks
and sounds the same on every device.

## How it works

### The chain

`Game.js` owns one number — the crank angle — and everything else follows from it.

* **Slack.** The first ~1.9 radians of handle turn the shaft and the gears, but the
  claws holding the block have play in them, so the ice does not move yet. You hear
  the gear teeth click. Then it bites, with a clunk.
* **Rotation.** After that the block is locked to the handle through an exact 24:15
  spur pair. The two gears are phased at construction so a tooth always meets a gap
  on the line of centres — they genuinely mesh, at every angle.
* **Shaving.** The blade removes ice *per radian the block turns*, not per second.
  A slow, careful turn is worth exactly as much snow as a fast one; speed only
  changes what the shavings look like. The amount removed also tracks the chord
  where the square block actually crosses the blade, so output pulses four times per
  revolution as the corners come round — and the pile drifts left and right on its
  own, which is what makes it look like *your* pile.
* **Accumulation.** Flakes come from a fixed instanced pool (`Flakes.js`); each one
  carries a share of the volume the blade cut and hands it to the height field when
  it lands. Whatever the pool cannot carry still lands, as fine spray, so the heap
  always matches what was actually removed. The machine quietly eases off as the
  bowl fills, so a child cannot overflow it.
* **Syrup.** Two coupled layers on the GPU (`materials/syrupSim.js`): a film on the
  surface, and colour that has gone *into* the crystals. Each step the film is
  deposited under the bottle, creeps downhill along the pile's own gradient, and is
  slowly drunk by the ice. Draw a line, watch it wet, watch it sink, watch it slide.

### The pile

`Mound.js` is a height field the size of the bowl, with the bowl's own inner surface
baked in as its floor. It slumps toward a 36° angle of repose every frame, and a
displaced grid mesh renders it — thousands of rigid bodies were never needed, and a
smooth surface of revolution would have read as icing, so the mesh adds low-frequency
clumping and a crumbled boundary on top of the simulated height.

### The handle

The handle's circle is projected to screen as an ellipse and the finger is solved
back onto that ellipse exactly (`Input.js`). A finger anywhere near the handle snaps
onto real circular motion, at any camera angle, without the rotation speeding up and
slowing down inside a single turn the way a naive screen-space angle would.

### Camera

Shots declare what has to be *inside* the frame rather than where the camera stands,
so portrait and landscape both stay honest from one set of definitions
(`CameraRig.js`). The handle is kept reachable in every shot where you can still
turn it — a beautifully composed bowl is worth nothing if the player cannot crank.
During the syrup phase the pour point is lifted above the finger on screen, so the
hand never covers the place the syrup is landing.

### Materials

The detail budget is deliberately lopsided. The hero materials — chipped enamel over
cast iron, worn chrome, the block itself, the shavings, the syrup, the glass — get
the large maps and the custom shaders. The garden gets flat colours and haze.

The block is a transmissive shell that really refracts the shop behind it, plus a
short object-space raymarch through a baked 3D volume for the milk-white frozen core
and the trapped bubbles; the core is locked to the block, so it swims correctly when
the block turns.

### Performance

WebGL 2 baseline. One shadow-casting light. Flakes are pooled and instanced, never
allocated per frame. Reflections come from a single cube capture of the shop taken
once at boot and prefiltered. Quality tiers pick texture sizes, grid resolution and
whether transmission is used at all; internal resolution is traded away automatically
if frames start costing more than about 23 ms.

`?q=low|mid|high` forces a tier. `?fast=1` is the cheap deterministic profile the
tests use.

## What is deliberately not here

No money, no customers, no shop management, no dress-up, no ads, no level map, no
wall of toppings. One block of ice becomes one bowl of shaved ice, and that is the
whole game.
