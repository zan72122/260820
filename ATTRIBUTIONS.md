# Attributions

## Audio

No recordings of any kind are used in this project — not of people, not of
equipment, not of a clinical environment. Every sound is synthesised at runtime
with the Web Audio API from oscillators and a deterministically generated noise
buffer (`src/core/AudioSession.ts`, `src/core/KorotkoffAudioModel.ts`,
`src/core/MechanicalAudio.ts`). There is therefore no third-party sample licence
to record here.

The tapping sound is an **educational synthesis**, not a clinical recording. Its
level and frequency band are deliberately shifted upward from what a stethoscope
would deliver, so that a four-year-old can hear it through a phone speaker. What
is *not* altered is the order of events, which follows the real mechanism:

- cuff above the module's peak pressure → the vessel never opens → silence
- cuff between peak and trough → the vessel opens for part of every beat → tapping
- cuff below the trough → the vessel stays open → silence again

This is a listening game, not a measurement instrument, a training device or a
diagnostic aid.

## Art assets

No binary art assets are shipped. Every texture — the woven cuff shell, the
knurled brass, the brushed steel, the moulded manikin skin, the vinyl floor, the
dial face — is generated procedurally into a canvas at boot
(`src/util/textures.ts`). No product, brand or manufacturer is reproduced; the
equipment is a generalised type, not a copy of a specific model.

## Libraries

- [three.js](https://threejs.org/) — MIT License, Copyright © 2010–present three.js authors.
  `RoomEnvironment` (used only to generate a neutral indoor image-based light)
  ships with three.js under the same licence.
- [Vite](https://vite.dev/) — MIT License.
- [TypeScript](https://www.typescriptlang.org/) — Apache License 2.0.
