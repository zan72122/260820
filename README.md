# 投網の花 — Tōami no Hana

*A quiet cast-net game for four-year-olds, made to be played with one finger in
Mobile Safari on an iPhone or iPad.*

One long arc of the finger, and a bundle of net at your feet lifts, turns in the
air, opens into a circle like a flower, lands on the water, sinks into a cone,
and comes back dripping. Sometimes a fish rides up with it. You look at it for a
moment in a pail of sea water, and then you put it back.

There is no score, no timer, and no tutorial text. What changes between throws
is the shape the net makes.

---

## Running it

Nothing to build. The whole game is source files plus a vendored copy of
three.js, so any static server works.

```bash
npm install          # only needed for the tests; the game itself has no runtime deps
npm start            # http://localhost:5173/
```

Then open `http://<your-machine>:5173/` on the phone or tablet. On a desktop
browser, the mouse works exactly like a finger.

Useful query parameters:

| parameter | effect |
|---|---|
| `?fast=1` | low-cost profile: dpr 1, coarser meshes, no antialias, boot cover skipped. Used by the tests. |
| `?q=high` \| `?q=low` \| `?q=fast` | force a quality tier instead of picking one from the device. |
| `?seed=1234` | fixes the random seed, so a session replays identically. |

## Playing

| gesture | what happens |
|---|---|
| **a long arc, lower-left to upper-right** | throws the net |
| a **short, soft** arc | a near, gentle throw into the shallow |
| a **fast, long** arc | a far throw out over the deeper blue |
| a **wandering** arc | the same success, opening into a more lopsided flower |
| **swipe up** (or tap) while the net is under water | hauls it in |
| **tap** the water | look closer; the surface answers |
| **tap** the net at your feet | it shifts, and water runs out of it |
| **any swipe** while a fish is in the pail | puts it back in the shallow |

Nothing can go wrong. Every swipe throws, every throw opens, and if a child puts
the phone down mid-throw the net comes home by itself and the fish goes back on
its own.

## What is implemented

**The loop** — throw → open → land → sink → haul → look → release → throw again.
Replaying costs one gesture.

**The net** is a polar mesh of ~600 points with verlet integration on top of a
choreographed target shape (bundle / bloom / disc / cone / purse). The
choreography guarantees the flower always reads; the verlet layer gives the
twine lag, swing and weight. A lead line of instanced sinkers trails the rim,
and hauling lines run from the hand line down to it.

**Wet and dry are different objects.** A dry net is pale, light, and lifts at the
edge in the wind. From the instant it touches water it is dark, heavy, slower to
answer, glossier, and it drips.

**One rope, never cut.** The camera is authored per beat — stay still while the
net lifts, one step back for the bloom, a drift overhead for the circle on the
water — but a closed-form framing solver runs every frame and eases the camera
back along its own view ray if either end of the rope, or the net's rim, would
leave the screen.

**Water** is a polar grid, dense where the net lands and reaching 3 km to meet
the haze. Four travelling swells, ring impulses for every impact and drip, sun
glitter, depth-driven colour and transparency, and a lace of foam where the
swell meets the sand.

**Two places.** Within ~7 m the water is a calm sandy shallow: the lead line
cannot fall far, so the net stays a wide circle. Beyond ~11 m it drops into
blue, and the net draws itself into a deep cone that reaches roughly half a
metre further down. The same swipe reads differently in each.

**The throw range is deliberately short** — 3.6 m to 11.5 m. What a
four-year-old reads is the *difference* between throws, and a longer cast is
only a smaller net on a phone screen.

**Three fish silhouettes** — a tight school that flashes as one body, one big
slow shadow crossing the blue, and a handful of quick darters that scatter when
the net lands.

**Fish are held, not hunted.** When the circle of lead reaches the water, up to
five fish that were standing inside it are held there, circling under the mesh
while the net sinks — that is what makes the sunk beat worth watching. Hauling
keeps at most one, for a moment, in a pail of sea water. Then it goes back. If
nobody puts it back, it goes back on its own.

**Every cast has a character** derived from the swipe: reach and speed set the
distance and the apex, wobble sets the number and depth of the petals, and how
steadily the arc was drawn sets the attitude the net lands at.

**No binary assets.** Twine, rope, fraying, decking, sand, and noise are all
generated on a 2D canvas at boot, so the game loads instantly and offline.

**Sound** is synthesised (sea wash, whoosh, splash, drips) and starts on the
first touch, as iOS requires.

## Verification

`npm run test:e2e` drives the game with real pointer arcs in Chromium at four
viewports — iPhone and iPad, portrait and landscape — and asserts the whole
loop, the framing guarantee, replay cost, the shallow/deep difference, all three
fish patterns, catch-and-release, rotation mid-throw, and that the document
contains no text at all.

`npm run shots` writes screenshots of twelve moments in the same four
viewports to `shots/`. It steps the game until each beat actually begins, so
the frame named `03-splash` is the frame the net lands on.

`npm run perf` prints the scene cost per quality tier. At the top tier
the whole game is 26 draw calls, ~57k triangles, 9 textures and 21 programs.

## Known limits

Two independent review passes were run against the screenshot set. Everything
below is what those passes found and I chose *not* to chase further, so it is
known rather than missed.

- **No hand model.** The line runs to a coil of warp at your feet rather than to
  a rendered hand. A crude first-person hand would have cost more realism than
  it bought.
- **No shadow maps.** The net's shadow on the sand and its shadow on the planks,
  and the pail's contact shadow, are drawn as dedicated soft discs. Nothing else
  casts, so the deck receives no shadows from the pile heads or the net.
- **The sunken net is stylised, not attenuated.** Real water would swallow most
  of its contrast at a metre down. It is tinted and softened toward the water
  colour, and the hand line rings the surface where it passes through, but it
  stays more legible than physics would allow — because a four-year-old has to
  be able to see it.
- **Fish are silhouettes, not simulated.** Flat-ish bodies, yaw only, no
  refraction offset and no shadow of their own.
- **The rope has little slack in flight.** It is taut and nearly straight from
  the coil to the net; it sags properly only at rest.
- **The mesh can alias.** At high quality on a 3× phone screen the dense lattice
  is near the sampling limit; MSAA is on for that tier, but shimmer under motion
  is the thing most worth checking first on a real device.
- **Frame rate is not measured here.** The verification above ran on
  SwiftShader, which cannot speak to smoothness, GPU cost or final visual
  quality. Those need a real device or a hardware-accelerated runner.
- **One fish at a time** comes up in the net, and only ever for a moment.
- **Audio is minimal**: four synthesised cues and an ambient wash, no music.
- **WebGL 2 is required** (three.js r180 no longer ships a WebGL 1 path). That
  means iOS 15 or newer; an older iPad will show a blank canvas rather than a
  degraded scene.
- **The safe-area margin is a fixed 14%**, not read from `env(safe-area-inset-*)`.
  It is comfortably wider than a notch, but a future device with a larger
  cutout would want the real inset.
