# Attributions

## Audio

Every sound in this piece is synthesised at runtime from a fixed seed. **No
recorded, sampled, or third-party audio is used**, so there is nothing here to
license and nothing to attribute.

The heart sounds are built in `src/audio/synth.ts` as short resonant noise
bursts with a few damped partials — the way a first or second heart sound
actually behaves, being the sudden deceleration of blood against a closing
valve rather than a tone. `src/audio/HeartSoundSource.ts` renders four
components once at startup (the mitral and tricuspid parts of S1, the aortic
and pulmonic parts of S2) and every listening position in the game plays
*those same four buffers*, re-weighted and re-filtered. The room tone, the
tubing friction, the rim meeting synthetic skin, and the instructor's knock on
the rail are synthesised the same way.

These are educational game sounds built on a normal S1/S2 structure. They are
**not diagnostic audio** and are not suitable for any clinical purpose.

## Art and models

All geometry, textures and materials are generated procedurally in code
(`src/scene/`). No external meshes, image textures, fonts or HDRIs are loaded.
The environment lighting comes from `RoomEnvironment`, part of the three.js
examples.

## Libraries

| Library | Version | Licence |
| --- | --- | --- |
| [three.js](https://github.com/mrdoob/three.js) | 0.169 | MIT |
| [Vite](https://github.com/vitejs/vite) | 5.4 | MIT |
| [TypeScript](https://github.com/microsoft/TypeScript) | 5.6 | Apache-2.0 |
| [Playwright](https://github.com/microsoft/playwright) (dev only) | 1.62 | Apache-2.0 |
