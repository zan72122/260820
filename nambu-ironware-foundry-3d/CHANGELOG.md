# Changelog

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
