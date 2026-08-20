# Third-party assets

**None.**

This game ships no third-party art, audio, fonts or models. Every asset is generated at
runtime from code in this repository, so there is nothing to license, attribute or verify.

| Asset class | How it is produced | Source file |
| --- | --- | --- |
| Washi paper (fibre normal, sheet thickness, deckle flecks) | Perlin/value noise rendered to a canvas, then differentiated into a tangent-space normal map | `src/util/textures.ts` |
| Bamboo, cedar, painted cart wood, kindergarten plank floor | Procedural ring/grain functions with per-board tone variation | `src/util/textures.ts` |
| Packed earth of the yard, gravel, evening damp | Layered fBm with a dampness mask driving roughness | `src/util/textures.ts` |
| Brushed brass, steel wire, rubber tyre tread, paper cord, cotton happi, taiko hide | Procedural PBR sets (base colour + normal + roughness) | `src/util/textures.ts` |
| The goldfish-and-waves nebuta itself | Original parametric surfaces; frame, paper panels and line-work all derive from them | `src/nebuta/shape.ts`, `src/nebuta/artwork.ts` |
| Sky, sun, stars and all image-based lighting | Equirectangular sky generated on the CPU per time-of-day, then PMREM-filtered | `src/world/Environment.ts` |
| Taiko, kane, fue, the hayashi phrase, the children's call | Web Audio synthesis — oscillators, filtered noise and formant filters. No recordings | `src/audio/Audio.ts` |
| Every interface icon | System emoji glyphs and canvas-drawn cards | `src/ui/UI.ts`, `index.html` |
| Fonts | System UI stack only (Hiragino Maru Gothic ProN → Yu Gothic → Noto Sans JP → system-ui) | `src/ui/ui.css` |

## Cultural sourcing

The design is an original "goldfish riding two waves" motif drawn for this game. It is not a
copy of any existing Nebuta, any existing artist's work, or any character from a manga, game
or film. The craft sequence — frame, paper, sumi outline, wax resist, dye, interior light,
cart, hayashi — follows the real order of Nebuta making, compressed into representative steps
suitable for a four year old. The music is an original short hayashi phrase written for this
project in a pentatonic mode; no festival recording is sampled or imitated bar by bar.

If a future change adds an external asset, add it here with its licence, keep a local copy in
`public/`, and record where it came from.
