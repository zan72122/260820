# Changelog

## 1.3.0 — Immediate physical response and input-layer rebuild

### Actual cause of the zero-response first scene

- The loading screen remained `display:flex` after its `active` class was removed because `#loading` had greater CSS specificity than the generic inactive-screen rule.
- The invisible loading screen therefore stayed above WebGL and intercepted pointer input.
- The transparent fallback artwork also remained eligible for hit testing.
- Even where events reached the game, the old screen-centred angle calculation and weak profile delta made the operation look unchanged.

### Input contract

- Added an explicit inactive loading rule: `display:none`, `visibility:hidden`, and `pointer-events:none`.
- Removed decorative overlays, fallback art, instruction strips, heat, vignette, flash, reward, and chapter layers from hit testing.
- Asserted in a real browser that the first gesture point resolves to `#gameCanvas`.
- Retained the path-centred circular recogniser so a large circle works anywhere on the screen and over multiple strokes.
- Added a bounded minimum response per meaningful movement; the first few centimetres can no longer be visually ignored.

### Continuous shape and material evolution

- Strengthened the initial packed-sand form so it is unmistakably different from the finished kettle mould profile.
- The full surface begins moving toward the profile from the first meaningful input, with emphasis on the shoulder and upper body.
- Added a real fresh-cut trace on the wet sand surface at the profile-board contact region.
- Added small fallen sand shavings around the turntable as material is removed.
- Rough turning now reduces material roughness from 0.997 toward 0.89 and bump depth from 0.088 toward 0.036.
- Fine turning continues toward roughness 0.78 and bump depth 0.010 while reducing circumferential irregularity.
- Increased task lighting and local exposure during the first scene so the silhouette and surface response do not disappear into the workshop darkness.

### Delivery and migration

- Bumped the runtime, bootstrap, package, and cache generation to 1.3.0.
- Added visual revision 4 migration for unfinished players in the first chapter.
- Replayed steps 1–14 once for saves created by the older, visually unresponsive opening.
- Added a browser acceptance test that captures seven progressive screenshots and a numeric state record.

### Browser acceptance evidence

The acceptance test verifies:

- inactive loading layer: `display:none`, `pointer-events:none`
- first two movement samples: progress above zero and immediate radius change
- fresh-cut trace opacity above zero during motion
- strong silhouette spread by half a circle
- complete rough profile
- lower roughness, bump depth, and angular variation during fine turning
- no browser console or runtime errors

## 1.2.0 — Continuous material and shape evolution

### Root-cause correction

- Replaced the mechanically stacked ring body with one continuous, dynamically deformed sand surface.
- The packed sand rises from the turntable continuously, including a live, slightly mounded top surface; no horizontal gaps are used to fake growth.
- Rough turning moves an actual tool front through the body profile. The upper neck, shoulder, belly, lower curve, and foot emerge in sequence while the entire object also compacts from the first meaningful movement.
- Fine turning reduces large-scale waviness, angular surface noise, bump depth, colour variation, and shallow tool marks instead of merely rotating a finished object.
- Replaced the pale platform with a dark wood-and-steel turntable and reduced loose sand chunks to small, surface-bound crumbs.
- Removed visible guide rings and contact markers from the 3D world.

### Interaction and delivery

- Kept the off-centre circular gesture recogniser and made the first visual response measurable after the first few pointer moves.
- Lengthened the sand-building sequence so the centre object can be watched growing rather than appearing between cuts.
- Bumped the opening-scene save revision so players stopped in an older broken version replay the rebuilt chapter.
- Changed the service worker to network-first delivery for HTML, JavaScript, and CSS, with automatic one-time client reload when an older game cache is replaced.
- Added browser screenshots and assertions for continuous height growth, immediate radius change, mid-turn silhouette, and completed rough profile.

## 1.1.0 — Progressive forming overhaul

### First chapter rebuilt

- Replaced the screen-centred angle test with a gesture tracker that recognises a large circular stroke anywhere on the screen.
- Progress begins with the first meaningful movement and survives finger lifts, so a four-year-old can complete the work over several strokes.
- Added resistance to straight swipes: they move the process a little, while a broad, consistently turning path is substantially more effective.
- Rebuilt steps 1–14 as a continuous visual sequence: full-scale drawing, profile plate cutting, seed moulds, three grades of moulding sand, sand accumulation, rough turning, spout and lug placement, fine turning, bottom mould, lid mould, and surface texture.
- Rough turning removes excess material and leaves tool tracks; fine turning reduces local radius noise, bump depth, colour variation, and visible track depth.
- Added a one-time save migration for players stopped inside the original first scene.

### Verification

- Added deterministic unit tests for off-centre circular gestures, partial progress, straight-swipe discrimination, and continuous rough/fine profile convergence.
- Added Chromium acceptance tests for the pre-interaction build, immediate visual response, mid-turn silhouette, completion, runtime errors, and screenshots.
