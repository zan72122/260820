# 線香花火 — senko-hanabi

A quiet, photoreal 3D sparkler for a phone or tablet. One finger, no words, no
score. It is a digital toy about a physical phenomenon a few centimetres across.

> 夏の夕暮れ。大人の手が、火のついた線香花火を一本、そっと持っている。
> 先には、小さな赤い玉がひとつ。

## What it is

Not a fireworks game. The whole thing is built around the one property that
makes a real senko-hanabi worth sitting still for: it is **not a single
effect**. It is four temperaments in one small object, and then it drops.

```
  waiting    a tiny red bead hangs there and does nothing      "…what is that?"
  burning    a finger touches the glass, and it answers        "it does that if I hold it"
             then it keeps changing, on its own                "it keeps changing!"
  falling    it lets go and drops                              "oh — it fell"
  quiet      the garden is still there
  offering   a hand comes back with another one                "again"
```

Nothing on screen ever explains any of that. There is no text anywhere in the
game, and there is nothing to win.

### The four temperaments

Traditional names, never shown to the player, but they are what the code builds:

| stage | what you see |
|---|---|
| 蕾 *tsubomi* | a bead of molten slag gathers at the tip. Almost no sparks. |
| 牡丹 *botan* | single, deliberate sparks, thrown hard. You can count them. |
| 松葉 *matsuba* | dense forking rays like pine needles. The one spectacular moment. |
| 柳 *yanagi* | thin, soft sparks hanging downward. Fewer and fewer. |
| 散り菊 *chirigiku* | a last flake or two, and the bead is the subject again. |
| — | a pause, and then it falls. |

## Playing it

Put one finger anywhere on the screen — beside the sparkler, below it, off in a
corner. The mapping is **relative to where the finger landed**, so a small hand
never has to cover the thing it is watching.

- Hold it and the bead keeps going.
- Let go and it visibly weakens. Put your finger back and it recovers.
- A small wobble is not a mistake: it shows up in the trails of the sparks.
- Wave it around and the bead deforms, and eventually lets go.
- **The first sparkler cannot be lost.** It dims when you let go — that is the
  lesson — but it always reaches the end.

Later sparklers each have their own character: the paper is dyed differently,
the powder burns a little faster or slower, the sparks fork a little more. A
steady hold makes one last measurably longer, because a bead that is not being
jostled really does hold together longer. None of this is scored, and none of it
is announced.

## Running it

```
npm install
npm run dev       # http://127.0.0.1:5173
npm run build
npm run preview   # http://127.0.0.1:4173

npm run verify    # lint + unit tests + build
npm run e2e       # Chromium smoke suite (see below)
```

Query flags, for tuning only — with no parameters you get a dark garden and one
small light:

| flag | effect |
|---|---|
| `?muted` | no audio |
| `?tier=high\|medium\|low\|floor` | pin the quality tier |
| `?dpr=1` | cap the device pixel ratio |
| `?seed=N` | fix the per-sparkler randomness |
| `?seek=0.55` | jump into the middle of a burn |
| `?capture` | `preserveDrawingBuffer`, for screenshots |

`globalThis.__senko` exposes the app. `__senko.stop()` freezes the clock and
`__senko.step(dt)` advances exactly one frame, which is how both the test suite
and `tools/capture.mjs` drive it without depending on wall time.

## How it is built

```
src/sim      phases.js    the timeline of stages, as normalised keyframes
             session.js   the state machine: waiting → burning → falling → offering
src/scene    hand.js      an adult hand, generated from a handful of curves
             sparkler.js  the paper cord: a verlet chain, and its shader
             fireball.js  the bead — the one object with a real materials budget
             sparks.js    one instanced draw call, over a branching CPU pool
             smoke.js     a few soft sprites
             sky.js       the sky, computed from the view ray
             environment.js  pre-defocused plates at true world sizes
             cameraRig.js a tripod that breathes
src/gfx      glsl.js      shared noise, the ember ramp, the shared light block
             textures.js  everything in the background, painted at runtime
             post.js      bright pass, two separable blurs, composite
src/core     app.js       the loop
             input.js     one finger
             audio.js     everything synthesised, nothing loaded
             quality.js   device tiering and a slow adaptive governor
```

The game ships **no meshes, no textures and no audio files**. Every asset is
generated at load.

### Decisions worth knowing about

**Sparks branch.** A senko-hanabi spark flies a little way, bursts into three,
and each of those bursts again. That recursion is what makes matsuba look like
pine needles instead of a fountain, so the simulation is a small CPU pool with a
branch event and the GPU only ever sees a flat instance buffer — one draw call
for the whole display.

**The ballistics are tuned per stage, not global.** Matsuba throws rays that
reach ~6.7cm with ~1.3cm of droop; yanagi reaches ~4.7cm and droops ~6.9cm.
That ratio *is* the difference between "pine needles" and "willow", and
`test/phases.test.js` asserts it.

**There are no real lights.** The brief rules out per-spark point lights, and
once you accept that, one analytic "ember light" shared by every hero material
is both cheaper and easier to art-direct than a light rig. Moving the bead
relights the hand, the paper and the smoke in a single assignment. Shadow maps
were left out deliberately rather than by omission: the only light is *below* the
hand, so its shadows fall where nothing can see them, and wrapped diffuse plus
analytic occlusion buys the same read for nothing.

**The cord is simulated, not animated.** A verlet chain with bending stiffness
behaves like paper string: it holds a gentle curve and swings a beat behind the
hand, and passes that lag to the bead. That chain is why a small movement of a
finger reads as one continuous object — hand → paper → bead → spark trail —
rather than as four things that happen to move together. (It needs root-anchored
passes at the end of the solve; twenty-five links of plain Gauss-Seidel under
gravity settle at about 1.4× their rest length.)

**The background is painted pre-defocused.** A macro lens at 25cm has a depth of
field of a few millimetres, so everything past the hand is a soft wash of value
anyway. Painting it onto four plates at true world sizes costs four textured
quads instead of a garden, composes correctly in both orientations, and leaves
the entire GPU budget on a bead of fire the size of a grain of rice.

**The camera is a tripod.** Framing is authored as two numbers per keyframe: the
height of the frame in metres at the sparkler, and where down that frame the
bead should sit. Distance and composition fall out of those. Through matsuba the
aim is almost frozen — with a subject three millimetres across, a camera that
chases destroys the thing it is trying to show. At the end it tilts down a
little way and no further, because if the camera keeps up with the bead, the
bead never appears to fall.

**Sound thins out with the sparks.** Ambience rather than music: wind, crickets,
a wind chime, a festival much too far away to be going to. The sparkler itself
is a band of noise plus scheduled crackles whose rate follows the stage. When
the bead falls there is **no impact sound at all** — the crackle simply stops,
and the garden is still there.

**Quality scaling never touches the story.** The governor sheds spark count,
bloom resolution and internal resolution, in that order. It cannot disable a
stage — the tiers carry no knob that could — and it explicitly does not scale
the first couple of sparks per second, so the beat where one spark leaves the
bead for the first time lands identically on every device.

## Safety and framing

The game opens on a summer evening with an adult already holding a lit sparkler.
Nobody lights anything, and no child is shown handling fire. A bucket of water
sits at the foot of the veranda — nobody points at it; it is simply there, the
way a careful adult leaves it there. This is a toy for observing a phenomenon,
not a guide to doing it.

## Testing

`test/` runs in plain Node with no DOM — the simulation, the timeline, the
particle pool, the cord physics and the quality governor are all pure JS.

`e2e/` is a Chromium smoke suite following the cloud profile in `CLAUDE.md`:
one worker, one retry, fail fast, no video, smallest practical viewport. It
drives the clock by hand, so nothing waits on wall time. It runs under
SwiftShader, which means it checks that the game *runs and behaves* — never how
it looks or how fast it is. Frame rate, animation smoothness and final visual
quality have to be judged on real hardware.

`tools/capture.mjs` renders the same build to PNGs at chosen points in the burn,
in either orientation, and prints mean/peak values for a few regions of the
frame. Judging a scene this dark by eye alone does not work; the numbers were
how the low-key palette got balanced.

```
PW_CHROMIUM=/path/to/chrome SHOTS=0,0.3,0.55,0.85,fall node tools/capture.mjs
```

## Requirements

WebGL 2, and a browser with Web Audio. Sound starts on the first touch, because
that is when a mobile browser will allow it — which happens to be the same
moment the sparkler starts, so it costs nothing.
