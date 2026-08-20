# スイカわり — Suika-wari

A 3D mobile web game for a four-year-old, set on a Japanese beach on a summer
afternoon. Built with Three.js and the Web Audio API, WebGL 2 baseline, no
asset files at all: every texture, voice and sound effect is generated at
runtime.

The game is one short loop, thirty to sixty seconds long:

> **you see the melon → the blindfold comes down → you listen → you guess a
> direction → you walk → one strike → the green shell opens and the red inside
> appears**

Two moments carry the whole thing, and every other decision in the codebase is
staging for them:

1. **You can't see, so you look with your ears.** The blindfolded view is never
   a black screen — it's a dim, blurred, high-contrast field where you can still
   read bright sky above, dark sand below, and the dark shapes of the people
   calling to you. The direction information lives entirely in the sound.
2. **The last hit reveals the inside.** The cloth comes off in 0.2 s at the
   exact frame of impact, sunlight floods back (a real exposure spike), and the
   camera pushes in on the torn red cut face.

There are no arrows, no minimap, no compass, no score and no timer.

---

## Playing

Portrait or landscape, one finger, three gestures:

| gesture | what happens |
| --- | --- |
| drag sideways | your body turns, slowly and continuously |
| short flick **up** | you walk a few steps forward |
| big swipe **down** | you swing the stick (only accepted once you're close) |

Arrow keys mirror all three for desktop play.

The gesture is classified once, after a small dead zone, so a sloppy diagonal
can never turn and step at the same time. Only the first finger down is
tracked, so a palm resting on the glass does nothing.

**The first tap is deliberate.** iOS will not start audio outside a user
gesture, so the title screen's はじめる button is where the AudioContext is
created. Stereo speakers or headphones make the left/right cue much clearer.

---

## How the listening works

The friends stand *around the melon*, so their voices and the melon share a
bearing from wherever you're standing. Turn towards a voice and it slides to
the middle of the stereo field — that causal loop is the entire tutorial, and
it is taught in the first few seconds by a call that fires 0.35 s after the
cloth drops.

Spatialisation is hand-rolled rather than a `PannerNode` (`src/audio.js`):

* **pan** — `sin(bearing)`, exaggerated 1.25×, so turning reads instantly
* **head shadow** — a low-pass that closes from 7.5 kHz to 1.1 kHz as a voice
  moves behind you, which resolves front/back without HRTF
* **distance** — an inverse-power roll-off plus a forward-facing gain lobe

This behaves identically on every browser and still gives a usable cue on a
mono phone speaker.

The calls themselves are synthesised: a sawtooth glottal source through three
parallel formant band-passes, with real consonants (stop bursts, fricative
noise, nasal murmur). Each character has their own `f0` and formant scaling, so
the same word is a small girl, a small boy or an adult depending on who is
calling. A different voice leads each round.

What you hear changes with how you're doing:

| situation | what happens |
| --- | --- |
| far away | one calm voice, every ~2.2 s |
| closing in | a second and third voice join, faster, more excited |
| very close | short sharp そこ！／そこそこ！ |
| facing badly wrong | おーい！ from whichever caller best marks the way, more often |
| wrong for 3 s | that caller **walks towards you** — same bearing, shorter distance, easier to place. Never a teleport, never an arrow. |
| close enough to swing | everyone goes quiet for a beat, then いまだ！ |

Under all of it runs a slow hand-clap beacon from the lead caller that speeds up
as you get closer — a hot/cold heartbeat you can steer by without understanding
a single word.

## How you always get there

The first round is heavily assisted and it is meant to be. When you step, the
**walk direction** is nudged towards the melon (55 % of the error in round 1,
inside a generous ±75° cone) — but your **facing** is never touched. The voices
stay the only thing that tells you where to turn, so the lesson still lands
while the geometry quietly guarantees you arrive. Later rounds drop the
assistance to 42 % and 32 %, move the melon, change your starting angle and
change who calls. It never becomes a maze.

The strike is always allowed to land: the stick auto-aims during the wind-up.
Finding it is the challenge; the バコン is the reward.

## The break

No fragment physics. The fruit is three large, hand-authored chunks — angular
sectors of the same ellipsoid, closed by two fracture faces carrying a real
cross-section (waxy skin → thick green rind → pale inner rind → red flesh →
seeds), with the crack lines wandering with height and the cut faces roughened
so nothing looks knife-cut. On impact a hairline crack opens for 0.11 s, then
the wedges topple open on keyframed arcs. Seeds and juice droplets are simple
ballistics. It is authored rather than simulated because it has to look right
every single time.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build && npm run preview
```

### Checks

```bash
npm run lint
npm run test:e2e   # Chromium smoke run
node scripts/shots.mjs   # writes the key frames to test-results/shots/
```

`?e2e=1` switches on the deterministic profile: fixed seed, device pixel ratio
1, no shadows or particles, small textures, and `window.__suika` for driving
the game and stepping logical time directly. The end-to-end suite checks the
three screens (seeing / blindfolded / broken open), asserts the blindfolded
frame is neither black nor readable, and exercises the whole Web Audio graph
behind a real tap.

> Screenshots from that profile run on a software rasteriser. They are good for
> composition, colour and correctness; frame rate, motion and final visual
> quality must be judged on real hardware.

`?shadows=1` re-enables sun shadows inside the fast profile for a one-off look
at composition.

---

## Layout

```
src/
  main.js              bootstrap, loop, lifecycle, test hooks
  game.js              phase machine, rounds, voice-cue director, the break
  audio.js             Web Audio: formant voice synth, spatial cues, SFX
  input.js             one-finger gesture classifier
  blindfold.js         the blindfold post pass
  camera.js            shot director (look / blind / ready / hero / wide)
  ui.js                DOM overlays and captions
  quality.js           detail budget, including the deterministic fast profile
  textures.js          every texture, drawn procedurally on canvas
  world/
    environment.js     sky, sun, sand, sea, foam, breakwater, crowd, props
    watermelon.js      the intact fruit and the authored break
    characters.js      articulated hero figures, stick, blindfold band
```

## Budget

The fruit is the hero and gets the detail; the beach is background.

* watermelon rind and cross-section: 1024² colour + normal + roughness
* sand, tarp, foam, cloth: 512² tiling detail — sand is **never** per-grain
  geometry, only a normal/roughness tile plus a few dozen near-camera pebbles
* sea: four sine trains displacing vertices, with a fresnel/glitter/foam shader.
  No fluid simulation.
* people: three articulated hero characters; everyone else is one instanced
  draw with no shadows
* shadows: the sun's `DirectionalLight` only, with a 13 m frustum around the
  play area
* the blindfold blurs by rendering at 1/6 resolution — the low resolution *is*
  the blur

Device pixel ratio is capped, and a medium profile drops automatically on
phones with few cores, little memory or a small screen.

## Note on the subject

This is a game inside a screen. It is not a how-to. The avatar swinging the
stick is an older child, not the player, and the title screen says plainly that
the real thing needs a grown-up and an open space.
