# Changelog

## 1.2.0 — Continuous material and shape evolution

### Root-cause correction

- Replaced the mechanically stacked ring body with one continuous, dynamically deformed sand surface.
- The packed sand now rises from the turntable continuously, including a live, slightly mounded top surface; no horizontal gaps are used to fake growth.
- Rough turning now moves an actual tool front through the body profile. The upper neck, shoulder, belly, lower curve, and foot emerge in sequence while the entire object also compacts slightly from the first meaningful movement.
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
- Progress now begins with the first meaningful movement and survives finger lifts, so a four-year-old can complete the work over several strokes.
- Added explicit resistance to straight swipes: they move the process a little, while a broad, consistently turning path is substantially more effective.
- Rebuilt steps 1–14 as a continuous visual sequence: full-scale drawing, profile plate cutting, seed moulds, three grades of moulding sand, sand accumulation, rough turning, spout and lug placement, fine turning, bottom mould, lid mould, and surface texture.
- The central sand object now changes radius band by band from an irregular mound to a readable kettle silhouette.
- Rough turning removes excess chunks and leaves tool tracks; fine turning reduces local radius noise, bump depth, colour variation, and visible track depth.
- Added a one-time save migration for players who were stopped inside the original first scene, so the redesigned opening is replayed rather than resuming into the broken state.

### Verification

- Added deterministic unit tests for off-centre circular gestures, partial progress, straight-swipe discrimination, and continuous rough/fine profile convergence.
- Added a Chromium acceptance test that checks the pre-interaction sand build, immediate visual response after the first few pointer moves, mid-turn silhouette change, completion, runtime errors, and screenshots.
