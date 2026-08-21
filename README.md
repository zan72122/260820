# Cassava

A mobile web game for a four-year-old, played with one finger, in which the
connection between a cut-back cassava stem and the radial cluster of storage
roots beneath it is *discovered* rather than explained.

There is no text in the game. No counters, stars, timers or currency. Nothing
can break, snap off, fly away or run out of time. The root cluster is the
reward.

## The sequence

1. **Nothing but a stem.** A red-brown field, one woody stub 20–30 cm tall,
   the soil around it barely domed. A lifter stands to one side. Its shape is
   the only instruction.
2. **Hook the clamp.** Drag the hanging jaw clamp to the base of the stem; it
   bites with a click and the tool settles into place.
3. **One tentative pull.** Push the long handle down a little. The foot plate
   presses into the soil, the stem rises about seven centimetres, three cracks
   run out across the ground, and in one of them a pale shoulder of root
   appears. Something thick is down there, and there is more than one of it.
4. **A short section.** Once, on the first plant only, the ground is cut away
   for just over a second to show the lever holding a plant that carries on
   below the soil line.
5. **Rock the stem.** Each swing side to side strips more soil and gives up
   exactly one further root direction.
6. **The full stroke.** Push the handle through. The cluster comes up, and it
   does not come up all at once: the thick central root releases first, then
   the flanking roots, then the ones running away from the camera, each with
   its own sticky delay. The camera eases back through the whole lift without
   a cut.
7. **The reveal.** Cluster and the hole it left, in the same frame. What was
   one stem above ground was a radial cluster below it.
8. **Shake and carry.** Swing it to drop the clods, then carry it to the
   basket — and the next stem is simply there, with a different plant under it.

## Running it

```
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run build      # typecheck + production bundle into dist/
npm run preview    # serve the production build on :4173
npm run test:e2e   # Playwright, four iOS viewports
```

`?quality=low|mid|high` forces a quality tier for testing.

## How it is built

Vite + TypeScript + Three.js (WebGL 2 baseline). No runtime dependencies
beyond Three.

### The plant

A cluster is one central stem node with four to nine storage roots. Each root
is a spline with its own length, thickness, descent angle and sideways curl,
wrapped in an individually generated surface with a tapered, slightly lobed
cross-section: a hard constriction at the neck, a swollen body, a blunt
fibrous end, lumps along its length, transverse skin striations, hair roots
and clinging clods.

Shape variation is **not** free-running procedural noise. Five archetypes —
`openFan`, `tightBunch`, `plunge`, `lopsided`, `twinLobe` — were authored and
checked by eye, and a run only jitters their parameters within modest bounds.
No cluster ever comes out as a ring of identical cylinders.

Surface normals are analytic, including the rate of change of radius along the
root. Re-averaging face normals would split the seam where the tube wraps and
draw a hard line down every root, which reads as a flat blade rather than a
solid.

### The ground

The worked strip is real geometry with a real hole cut at every plant, because
the split has to open onto something. Over each hole sits a patch of soil laid
out as radial plates whose boundaries lie on the root azimuths — when the
ground splits, it splits where a root is pushing. Beneath them is a crater
sculpted from that same layout, with a groove pressed into the floor along
each root, so the shape left behind is the negative of what came out.

Two details matter more than they look:

- Plates share their top edge with their neighbours exactly, use analytic
  surface normals, and are undercut so no two fracture faces are ever
  coincident. Without all three, every plate boundary shows as a dark crease
  from the first frame — which would draw the root layout on the ground before
  the player had touched anything.
- Large-scale colour variation is done in the shader from world position, not
  in vertex colours. The worked strip is a shape with holes cut in it and has
  almost no interior vertices, so a vertex tint there would not match the
  densely tessellated crater collar lapping over it, and the join would show as
  a pale disc.

Plants in sandier soil tint the ground locally and fade back to the field's
colour across the crater collar, rather than stamping a hard-edged circle of
sand into red earth.

### The tool

Real lever geometry, in `src/world/lifter.ts`: a foot plate on the ground, a
pivot standing on it, a bar crossing the pivot with a 0.40 m short arm on the
crop side and a 0.80 m handle on the operator side, and a chain carrying the
jaw clamp. Pushing the handle down rotates the bar; the short arm rises; the
chain pulls the stem straight up; the foot plate sinks under load. The lift
delivered to the plant is *derived* from that geometry rather than animated
alongside it, so the fulcrum and the direction of force stay legible from
every camera angle. There are no decorative hydraulics.

### The camera

Eight fixed shots, no free camera. Two rules are enforced in the director
rather than left to the shot table:

- Framing is solved by projecting the cluster's **measured extremities** onto
  the shot's own screen axes, with a second pass for perspective. A bounding
  radius either crops a wide fan of roots or holds the camera uselessly far
  back; measuring is what keeps the whole cluster in frame in portrait and in
  landscape alike, and what makes a rotation mid-gesture safe.
- Every shot pushes its subject above the screen centre, because the finger is
  low on the screen, on the tool handle. The jaws, the first crack and the
  emerging roots sit clear of it.

Portrait takes a wider lens rather than retreating, so a phone held upright
still gets close to the work.

### Materials and light

Every surface is generated on a 2D canvas at runtime, so the build ships no
binary texture payload at all — smaller than any compressed-texture pipeline
would have been for this content, and there is nothing to decode on load. Each
Hero Material has its own colour, roughness and normal set: iron-rich red
soil (dry dust film over damper aggregate), coarse cassava periderm, lignified
stem, and steel with different wear per zone — hands polish the grip, soil
abrades the foot plate, stems bruise the jaw interior, water corrodes the
hollows.

Lighting is one directional sun, a sky/ground fill, a weak bounce and contact
shadows, at a real midday exposure. A small two-tone sky-and-soil irradiance
probe is generated at boot; without one, metal has nothing to reflect and the
tool renders as a black silhouette. There is no colour grading, no rim glow,
no background bokeh and no symmetric dirt.

### Sound

Synthesised: dry leaves, the clack of the clamp, the creak of a loaded lever,
the low crack of a clod, the tacky pull of a root out of damp ground, falling
grains. Birds and wind sit far back. No electronic tones, and no fanfare when
a plant comes up.

### Input

One finger, always; a second touch is ignored rather than given a second job.
Gestures have gain and momentum, so a short jerky drag still travels a
meaningful distance, and releasing part-way never strands anything. The lever
ratchets: a wrong-way drag gives a little and then holds, so it can never undo
progress or leave the mechanism disagreeing with the plant.

### Performance

Quality tiers pick render scale, shadow size, particle budget, background
instancing and texture size from the device, and step down at runtime if the
frame budget is missed. The root-cluster silhouette, the soil cracks and the
staggered lift delay are never reduced at any tier. WebGPU-capable browsers
get richer particles and filtering only; WebGL 2 is the baseline everything
runs on.

## Size

The production build is 812 KB on disk, about 212 KB gzipped, and contains no
images, models or audio files — every surface and every sound is generated at
runtime.

## Tests

`tests/play.spec.ts` drives the whole checklist through genuine pointer input
on the canvas — the tests never call the game's own advance hook to make
progress, only to read state and to step simulation time. It runs on four
viewports: iPhone portrait and landscape, iPad portrait and landscape.

Eleven checks per viewport, forty-four in all: the opening withholds the
roots; the wordless prompt ladder never changes the task; the first pull
cracks the ground and brings a root shoulder to the surface; the cluster
climbs rather than jumping; a whole plant runs from first touch to basket and
straight on to a different plant; mashing and wrong-way drags leave the
sequence intact; a rotation mid-gesture keeps every bit of progress; sound
starts on the first touch and not before; reduced motion still plays the whole
plant through; and no part of the lifted cluster leaves the frame in either
orientation.

`tests/shots.mjs` is a separate inspection harness that plays the sequence and
writes a screenshot at every beat.

Nothing in either judges frame rate, animation smoothness or final image
quality. The cloud runner rasterises in software, which cannot speak to any of
those; they belong on a machine with a real GPU.
