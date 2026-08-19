# 稲コンバイン — Rice Combine

A 3D rice harvest for a four-year-old, played with one finger in mobile
Safari. Drop the header, drive along the golden rows, watch the paddy come
off behind you, and when the tank is full swing the auger out and pour the
rice into the truck.

Everything on screen is generated at boot — geometry, textures and sound.
There are no binary assets and nothing is fetched over the network.

## Play

```bash
npm install
npm run dev          # http://localhost:5173
```

For a phone on the same network, `npm run dev` already binds `0.0.0.0`;
open `http://<your-machine-ip>:5173` on the device.

```bash
npm run build        # typecheck + production bundle into dist/
npm run preview      # serve the built bundle on :4173
npm run test:e2e     # Playwright suite, both orientations
```

## How it plays

1. **ヘッダを さげる** — one big button drops the cutting header.
2. The machine drives itself forward. Touch the left or right half of the
   screen to lean that way; the lane assist keeps it on the row, so there
   is no way to get lost or stuck. Headland turns happen automatically.
3. Grain flows into the tank a beat after it is cut. A short cut-away
   ghosts the machine's shell so you can see the cylinder threshing, the
   grain dropping through the sieve and up the elevator, and the straw
   going out the back.
4. When the tank fills, the kei truck drives over. **パイプを のばす**
   swings the unloading auger out, **おこめを だす！** starts the pour.
5. Six lanes make a paddy. Finish it and you can plant a fresh one.

There are no timers, no fail states and no collision penalties.

## How it is built

| Piece | File | Notes |
| --- | --- | --- |
| Orchestration, state machine | `src/game/game.ts` | intro → harvest → turn → unload → finish |
| Paddy, crop, harvest mask | `src/game/field.ts` | instanced rice, live canvas mask |
| The machine | `src/game/combine.ts` | header, threshing internals, unloading auger |
| Receiver | `src/game/truck.ts` | kei truck, grain container, waiting farmer |
| Surroundings | `src/game/environment.ts` | levees, plots, village, tree line, ridges |
| Directed camera | `src/game/camera.ts` | named shots, no free look |
| Loose material | `src/game/particles.ts` | grain, straw, chaff |
| Procedural textures | `src/game/textures.ts` | soil, mud, grain, grassland, cloud |
| Synthesised sound | `src/game/audio.ts` | engine, rustle, pour, chimes |

### The crop

One `InstancedMesh` instance is a transplanted hill, not a single plant.
Hills are held in flat typed arrays with a uniform grid for the cutting
query, and drawn at two levels of detail: a detailed mesh (drooping
panicles with lumpy spikelet silhouettes, leaves) for the ~820 hills
nearest the machine, and a cheap four-culm tuft for the rest. The detail
radius adapts each refresh to keep the near mesh at its cap.

Wind sway and the felling animation both live in the vertex shader, driven
by per-instance attributes (`aCutTime`, `aYaw`, `aCutYaw`). When the cutter
bar reaches a hill the CPU only writes one float; the shader tips the hill
towards the machine, drags it forward and shrinks it away over half a
second.

### The ground changing

A 256×256 canvas is the paddy's memory. Every frame the game stamps the cut
swath into its red channel, the two crawler ruts into green and general
churn into blue, then uploads it at 18 Hz. The ground material samples that
mask in `onBeforeCompile` and blends between shaded soil under standing
crop, opened soil, and dark wet mud in the ruts. Stubble is real geometry
that is simply there all along — it is the base of every plant, revealed
the moment the tops come off.

### Performance

Around 470k triangles in ~70 draw calls at the default quality. The
renderer starts at the device pixel ratio (capped at 2) and steps down,
then drops shadows, if two consecutive 2.5-second windows come in under
42 fps — after a six-second warm-up so shader compilation is not mistaken
for a slow device. `?fx=low` forces the low tier (used by the test suite,
which runs on software GL).

## Testing

`npm run test:e2e` runs the Playwright suite in portrait (390×844) and
landscape (844×390) against the built bundle. The tests drive the game
through `window.__game` debug hooks — `debugAdvance()` steps the simulation
without waiting on the renderer — and cover booting, the first cut,
one-finger steering, the whole unload cycle, a complete paddy plus replay,
rotating the device mid-run, and the draw-call budget.

The runner has no GPU, so the suite deliberately asserts nothing about
frame rate, animation smoothness or visual fidelity. Those need a machine
with real hardware acceleration.
