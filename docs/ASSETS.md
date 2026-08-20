# Assets and licensing

**外部アセットは使用していません。**

This project ships no images, no models, no fonts and no audio files. There is
nothing in the repository that was downloaded, purchased or derived from
someone else's work, so there is no third-party licence to record.

Everything visible and audible is generated at runtime by code in this
repository, from a seed. That is a deliberate choice, not a placeholder: a
generated map can be tuned against a screenshot in seconds, and a game with no
asset payload starts on a phone as fast as its first frame renders.

## What is generated, and where

| Asset | Generator | Notes |
| --- | --- | --- |
| Fruit skin data map | `src/gfx/textureLab.ts` → `mangoData` | RGBA `DataTexture`: broad mottle, ripening order, lenticels, over-ripe speckle. Never a canvas — a 2D canvas stores premultiplied alpha and would destroy the packed channels. |
| Fruit relief map | `src/gfx/textureLab.ts` → `mangoData` | Height field of pores, orange-peel grain and broad undulation, converted to a tangent-space normal map. |
| Fruit geometry | `src/world/mango.ts` | A star-shaped radial function: ellipsoid base plus shoulder, neck, taper, one fuller cheek, a beak and a flank groove. The physics evaluates the same function. |
| Bark colour + normal | `src/gfx/textureLab.ts` → `barkMaps` | Ridged noise on a cylinder, so it is seamless around the branch. |
| Leaf colour + normal | `src/gfx/textureLab.ts` → `leafMaps` | Midrib, fanned secondary veins, margin browning, nibbled patches. |
| Leaf geometry | `src/world/leaf.ts` | Per-blade outline, cup, droop, twist and tint. No two leaves in the scene are the same object. |
| Cord fibre normal | `src/gfx/textureLab.ts` → `cordNormal` | Three-ply twist plus fibre and fuzz, tiled along every rope at a fixed pitch. |
| Fine netting | `src/gfx/textureLab.ts` → `fineNetMaps` | Drawn with real strokes so the knots stay crisp, used as both alpha and relief. |
| Floor | `src/gfx/textureLab.ts` → `floorMaps` | Grit and damp patches. |
| Environment probe | `src/gfx/textureLab.ts` → `environmentTexture` | A tiny equirectangular greenhouse (diffuse glass, sun blob, green bounce, dim floor) run through `PMREMGenerator`. It is what gives the fruit's wax and the leaves their sheen. |
| Window light patch, dust | `src/world/greenhouse.ts` | Canvas gradients. |
| Every sound | `src/core/audio.ts` | Web Audio: filtered noise and oscillators. The room tone, cord friction, the hook click, the soft low thump of the catch, the cord creak that follows it, the sway, and the harvest knock. |

## Tooling

No Blender, no glTF, no KTX2, no Meshopt, no Draco. None of them would have
anything to compress: the only bytes shipped are the JavaScript that draws
these maps and builds these meshes. Boot cost is a few hundred milliseconds of
generation behind the loading indicator, yielding to the browser between maps
so the page never locks up.

If external art is ever added, its source and licence must be recorded in this
file before it is committed.
