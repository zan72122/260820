# Attributions

## Third party code

| Component | Version | Licence | Use |
| --- | --- | --- | --- |
| [three.js](https://threejs.org/) | 0.185.x | MIT | WebGL2 renderer, scene graph, PBR materials, PMREM probe generation |
| [Vite](https://vitejs.dev/) | 7.x | MIT | Development server and production bundler |
| [TypeScript](https://www.typescriptlang.org/) | 5.9.x | Apache-2.0 | Type checking |
| [Playwright](https://playwright.dev/) | 1.62.x | Apache-2.0 | Automated browser pass (development dependency only) |

Only three.js ships in the built game. Everything else is build or test tooling.

## Art, audio and content

Every asset in this game is generated at runtime by code in this repository.
There are no imported images, models, fonts or sound files, and nothing is
fetched from a third party at runtime.

- **Geometry** — the flume, its moulding joints, the caulk strips, the service
  heads, the crawler, the raft and the park are all built procedurally in
  `src/world/`.
- **Textures** — gelcoat orange peel and drag scratches, sealant grain, machined
  aluminium, deck tiles, contact shadows and particle sprites are drawn into
  `<canvas>` elements at startup in `src/core/textures.ts`. The live repair state
  (grime, compound haze, gloss) is rasterised per joint in `src/world/seam.ts`.
- **Lighting environment** — the dawn sky is a small GLSL gradient shader in
  `src/core/env.ts`; the image based lighting probe is prefiltered from that same
  sky, so no HDRI file is needed.
- **Audio** — every sound is synthesised with the Web Audio API in
  `src/core/audio.ts`: pinked noise beds, a generated convolution impulse for the
  inside-the-pipe reverb, and short oscillator figures. No samples are used.
- **Icons** — the interface icons are hand written inline SVG in
  `src/ui/icons.ts`. No icon font and no emoji are used anywhere in the game.

## Typography

The interface uses the platform UI stack only
(`-apple-system`, `Hiragino Maru Gothic ProN`, `Hiragino Sans`, `Segoe UI`,
`system-ui`). No web fonts are downloaded.
