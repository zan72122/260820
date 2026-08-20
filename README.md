# すべりだい研究所 (Slide Lab)

A WebGL sandbox for four-year-olds. One real slide, eight things to send down
it, and no text anywhere in the game.

The point is not to slide a character down a chute. It is that **the same
slide behaves differently depending on what you put on it, what state its
surface is in, and where you let go** — and that a child can work that out
from a single action and then start combining variables on their own.

## Running it

```bash
npm install
npm run dev        # development server (open the LAN URL on the phone)
npm run build      # type check + production build into dist/
npm run preview    # serve the production build on :4173
```

Open the previewed URL on an iPhone or iPad in Safari. Nothing else is
needed — there is no back end, no login, no analytics, no network request
after the initial load.

Other scripts:

```bash
npm run typecheck  # tsc --noEmit
npm run simcheck   # headless behaviour table for every object x surface
npm run smoke      # Chromium smoke run of the production build (see below)
```

`npm run smoke` expects `npm run preview` to already be serving on
`127.0.0.1:4173`, and drives a full round in four viewports
(iPhone/iPad × portrait/landscape), writing screenshots and a report into
`artifacts/`.

### URL flags

| flag | effect |
| --- | --- |
| `?debug=1` | on-device instrumentation overlay (never shown otherwise, never transmitted) |
| `?fast=1` | forces the lowest quality profile — used for CI/software rendering |
| `?e2e=1` | installs `window.__lab`, a deterministic control surface for automated checks |

## How it is put together

```
src/
  core/      rng, math, adaptive quality, pointer routing, synthesised audio, debug overlay
  render/    procedural texture bakery, PBR material library, sky + IBL, particles
  world/     slide centreline, bed geometry, live surface state, park, trolley, console, mat
  objects/   physical profiles, prop geometry, the visual half of an experiment object
  sim/       the motion model
  game/      camera grammar, progression director, interaction, telemetry
```

### The motion model

`src/sim/simulate.ts`. Not a general physics engine — a purpose-built model
that stays reproducible enough to compare runs:

* **On the bed** the object is constrained to an arc-length parametrised
  curve. Acceleration is `rollFactor · (g·sinθ − μ·N)` with
  `N = g·cosθ + κv²`, so the flattening curve at the bottom really does scrub
  speed off heavy things. `μ` is blended per-frame from the live coverage of
  dry steel, water film, sprinkled sand and laid rubber under the object.
* **Off the lip** a simple ballistic arc, then a restricted contact model on
  the ground with per-material restitution and rolling/sliding friction.
* Repeats of the same experiment vary by roughly ±1 % of friction and a few
  millimetres of starting pose — enough that a repeat is alive, small enough
  that a child can still predict it.

`npm run simcheck` prints the whole behaviour table, including the
repeatability spread.

### Surfaces

The bed's state lives in one small array (water / sand / rubber coverage per
cell). That array is uploaded as a texture that the bed's PBR shader samples
to change roughness, base colour, metalness, normal detail and clear-coat —
and it is the *same* array the friction model reads. What you can see is what
the object feels.

Everything is generated at run time: no textures, models or audio files are
downloaded. Geometry is built procedurally and textures are baked into
canvases on first use, so objects the child has not unlocked yet cost nothing.

### Audio

`src/core/audio.ts` synthesises every sound with Web Audio — rolling steel,
wooden knocking, felt scuffing, rubber squeak, ice glide, sand rasp, the
continuous hiss of a wet bed, plus the impact for each material. Level and
pitch track the object's speed. Each cue is an isolated method so a recorded
sample can replace it later without touching any caller. Audio starts only
after the first touch and suspends with the tab.

### Camera

`src/game/camera.ts` implements the shot grammar: a three-quarter overview, a
mid shot that holds the lever and the held object in one frame, a follow rail
tied to the object's own arc position (identical path and field of view for
every object, so a difference on screen is a difference in the object), and a
low landing shot that is already in place before the touchdown. All moves are
damped; there are no cuts and no camera controls. Portrait puts the slide on
the screen's vertical axis; landscape lays it diagonally with room for the
roll-out.

## Mobile behaviour

WebGL 2 is the baseline. Quality starts from a device guess and degrades in
this order when frames are missed: environment reflection updates → shadow
resolution → distant foliage → particles → refraction → render scale. It
recovers in reverse. Rotating the device changes only the camera rig; the
experiment in progress is untouched.
