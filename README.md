# 血圧の音の窓 — the window where the sound lives

A listening game for four-year-olds, made to be played on an iPhone or iPad in
Safari. It runs in a clinical skills lab on a **training manikin's arm module**.

The whole game is one piece of cause and effect:

> While the cuff is tight you hear nothing. Ease the valve open a little and a
> quiet *ton … ton …* appears. Ease it further and it goes away again.

## What this is not

This is **not** a blood-pressure trainer and **not** a diagnostic app. No
patient, no child's arm, no camera, no microphone, no biometric data of any kind
is involved. No pressure value, no measurement, no normal/abnormal judgement, no
condition name and no treatment advice is ever shown. There is no timer, no game
over, no score and no star rating.

Cuff pressure exists inside the code only as a normalised 0–1 number, and never
reaches the screen.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173 — open it on the phone over the LAN
npm run build    # type check + production build into dist/
npm run preview  # serve the production build
```

The dev server binds to all interfaces, so a phone on the same network can open
`http://<your-machine-ip>:5173/`.

## Sound

Audio starts on the child's first touch — dragging the stethoscope's chestpiece
onto the arm. There is no separate "enable audio" screen. One `AudioContext` is
shared by the whole game, every sound is scheduled against its clock rather than
against `requestAnimationFrame`, and the room, the equipment and the body sit on
separate buses so the room can duck as the child starts to listen. Volume, mute
and a speaker/headphone voicing live behind the small speaker button.

With the sound off the game still reads: the cuff, the needle, the valve and the
cutaway all move. With the sound on, the sound is the point.

## Layout of the code

| Module | Responsibility |
| --- | --- |
| `core/CuffPressureModel` | Normalised cuff pressure, the sound window, stages |
| `core/ValveController` | Finger arc → valve opening and spindle angle |
| `core/BulbPumpController` | Presses, holds and swipes → pump strokes |
| `core/KorotkoffAudioModel` | Pressure → what the stethoscope hears; audio-clock scheduler |
| `core/MechanicalAudio` | Check valve, air, fabric, escape hiss |
| `core/StethoscopeContact` | The generous antecubital acceptance region |
| `core/TrainingArmReveal` | The transparent training module and its vessel |
| `core/CameraDirector` | The fixed rail, auto-fitted per aspect ratio |
| `core/ChildGuidance` | Physical, wordless guidance |
| `core/ReplayVariation` | One variable per run |
| `core/AdaptiveQuality` | Resolution → shadows → flow markers, in that order |
| `core/AudioSession` | The single AudioContext and its buses |
| `core/PointerRouter` | One finger, three targets, screen-space hit tests |
| `core/GameDirector` | Sequencing and the ties between all of the above |
| `scene/*` | Room, manikin, cuff, equipment, stethoscope, instructor |

See `ATTRIBUTIONS.md` for asset and audio provenance.

## Checking it

```bash
npm run smoke        # drives a whole run in Chromium and prints the state at each beat
npm run framecheck   # projects every touch target at five viewport sizes
npm run snapshots    # renders each camera shot to a PNG
```

These use Playwright and need a server running. They drive the page through a
`window.__bp` handle that exists in `npm run dev` and in the `probe` build
(`npm run build:probe` / `npm run preview:probe`); the shipped production bundle
has no such handle. Point the tools at a server with `URL=…`, and set
`SHOTS=<dir>`, `TAG=<name>`, `SIZE='{"width":390,"height":844}'` for the two
that write images.

## Rendering notes

- WebGL 2 through three.js, metallic-roughness PBR, image-based lighting from a
  neutral generated indoor environment, one shadow-casting key light aimed at
  the arm and the instruments. Far props are grounded with contact-shadow
  patches instead of dynamic shadows.
- No material uses `transmission`. It looks better on glass, but it makes
  three.js render the scene a second time every frame, which is not a fair
  trade on a phone for one window pane and one acrylic slot.
- `AdaptiveQuality` gives up device pixel ratio first, then shadows, then the
  flow markers inside the training module. It never gives up the cuff
  deformation, the needle, the valve or a scheduled sound.
- The scene runs at roughly 130 draw calls and 33k triangles.

## Known limitations

- Frame rate has not been measured on real hardware. This was developed in a
  container whose only GL implementation is a software rasteriser, where FPS
  numbers mean nothing. The draw-call and triangle budgets above are what the
  60 fps target rests on; it needs confirming on a device.
- All surfaces are generated at boot, which costs a fraction of a second of
  blocking work before the first frame. Nothing is lazily loaded, because there
  is nothing to load.
- The reveal is a fixed six-and-a-half-second beat rather than something the
  child can dwell on.
