// 雲の結び目 — Cloud Knot.
// A dry ridge, a low cloud band snagged into a knot, and a unicorn whose
// spiral horn can feel the wind's twist. Unwinding a loop the wrong way
// never punishes; unwinding it the right way lets a few drops go first,
// so the rule is understood before it becomes a toy.

import * as THREE from 'three';
import { buildWorld, terrainHeight, WetMask } from './world';
import { Vegetation } from './vegetation';
import { CloudBand, LOOP_COUNT } from './cloud';
import { RainSystem } from './rain';
import { Unicorn } from './unicorn';
import { Gesture } from './gesture';
import { Director, Shot } from './director';
import { GameAudio } from './audio';
import { clamp, damp, lerp, smoothstep } from './util';

type Phase =
  | 'intro_wide' | 'intro_knot' | 'approach'
  | 'closeup' | 'play' | 'free' | 'afterglow';

const params = new URLSearchParams(location.search);
const E2E = params.has('e2e');
const SKIP_INTRO = params.has('skip');

// ---------- renderer ----------
const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({
  antialias: !E2E,
  powerPreference: 'high-performance',
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

// quality tier: rough guess up front, adapted at runtime
const coarseDPR = Math.min(window.devicePixelRatio || 1, 2);
let quality = (navigator.hardwareConcurrency || 4) >= 4 && coarseDPR >= 1.5 ? 1 : 0;
if (E2E) quality = 0;
let baseDPR = E2E ? 1 : quality > 0 ? Math.min(coarseDPR, 2) : Math.min(coarseDPR, 1.5);
let dprScale = 1;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(baseDPR * dprScale);
  renderer.setSize(w, h);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 60));

// ---------- scene ----------
const scene = new THREE.Scene();
const world = buildWorld(quality);
scene.add(world.group);
const wetMask: WetMask = world.wetMask;

const hemi = new THREE.HemisphereLight(0x9099a6, 0x40372c, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0x8a8d95, 0.75);
sun.position.set(-20, 40, 25);
scene.add(sun);

const veg = new Vegetation(wetMask, quality);
scene.add(veg.group);

const cloud = new CloudBand(quality);
scene.add(cloud.group);

const rain = new RainSystem(quality);
scene.add(rain.group);

const unicorn = new Unicorn();
const START = new THREE.Vector3(17, 0, -17);
const WORK = new THREE.Vector3(6.8, 0, -22.4);
unicorn.root.position.set(START.x, terrainHeight(START.x, START.z), START.z);
scene.add(unicorn.root);

const director = new Director(window.innerWidth / window.innerHeight);
const audio = new GameAudio();

// rainbow (built once, revealed only after real play)
const rainbowUniforms: Record<string, THREE.IUniform> = {
  fade: { value: 0 },
};
const rainbow = (() => {
  const geo = new THREE.TorusGeometry(16, 1.6, 2, 60, Math.PI);
  const mat = new THREE.ShaderMaterial({
    uniforms: rainbowUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform float fade;
      void main() {
        float t = vUv.y; // across the tube
        vec3 c = vec3(0.8);
        if (t < 0.17) c = vec3(0.75, 0.35, 0.38);
        else if (t < 0.34) c = vec3(0.8, 0.6, 0.35);
        else if (t < 0.5) c = vec3(0.78, 0.78, 0.45);
        else if (t < 0.67) c = vec3(0.45, 0.7, 0.5);
        else if (t < 0.84) c = vec3(0.45, 0.58, 0.78);
        else c = vec3(0.55, 0.45, 0.72);
        float soft = sin(t * 3.14159);
        gl_FragColor = vec4(c, fade * 0.28 * soft);
      }
    `,
  });
  const m = new THREE.Mesh(geo, mat);
  m.visible = false;
  m.renderOrder = 16;
  scene.add(m);
  return m;
})();

// ---------- game state ----------
let phase: Phase = 'intro_wide';
let phaseT = 0;
let simTime = 0;
let firstLoopOpened = false;
let heroSequence = 0;        // 0 none, 1 falling, 2 landed
let idleSinceInput = 0;      // for hint escalation (closeup)
let hintTightenT = -1;       // knot half-turn tighten anim
let steerTime = 0;           // accumulated free-steer play
let sunUp = 0;
let wetSpots = 0;            // distinct areas rained on (for rainbow condition)
const wetCells = new Set<number>();
let dripSounds = 0;

// gesture
const gesture = new Gesture(renderer.domElement);
let activeLoop = -1;
let replantAcc = 0;
const scr = { x: 0, y: 0 };
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

// knot winding: loops read as wound clockwise (screen), so unwind = CCW = angVel > 0
const UNWIND_SIGN = 1;

gesture.onDown = (x, y) => {
  audio.start();
  if (phase === 'intro_wide' || phase === 'intro_knot' || phase === 'approach') {
    advanceIntro();
    return;
  }
  if (phase === 'closeup' || phase === 'play') {
    // pick nearest loop (open loops can still be circled to pump rain)
    let best = -1, bestD = Infinity;
    const w = window.innerWidth, h = window.innerHeight;
    const maxR = Math.max(w, h) * 0.45;
    for (let i = 0; i < LOOP_COUNT; i++) {
      director.toScreen(cloud.loops[i].center, w, h, scr);
      const d = Math.hypot(scr.x - x, scr.y - y);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (bestD < maxR) {
      activeLoop = best;
      director.toScreen(cloud.loops[best].center, w, h, scr);
      gesture.setAnchor(scr.x, scr.y);
    } else {
      activeLoop = -1;
    }
  }
};
gesture.onUp = () => {
  if (activeLoop >= 0) {
    const L = cloud.loops[activeLoop];
    if (!L.open) L.jiggle = Math.min(L.jiggle, 0.55); // drops wait, trembling
  }
  activeLoop = -1;
};

function advanceIntro() {
  if (phase === 'intro_wide') setPhase('intro_knot');
  else if (phase === 'intro_knot') setPhase('approach');
  else if (phase === 'approach') setPhase('closeup');
}

function setPhase(p: Phase) {
  phase = p;
  phaseT = 0;
  const shots: Record<Phase, Shot> = {
    intro_wide: 'wide', intro_knot: 'knot', approach: 'approach',
    closeup: 'closeup', play: 'play', free: 'play', afterglow: 'finale',
  };
  director.setShot(shots[p]);
}

if (SKIP_INTRO) {
  unicorn.root.position.set(WORK.x, terrainHeight(WORK.x, WORK.z), WORK.z);
  setPhase('closeup');
}

// rain impacts: audio for the first clear drops, wet-cell tracking
rain.onImpact = (x, z, hero) => {
  if (hero || dripSounds < 14) {
    audio.drip(0.85 + Math.random() * 0.4);
    dripSounds++;
  }
  const cell = (Math.floor((x + 60) / 7) * 64 + Math.floor((z + 60) / 7)) | 0;
  if (!wetCells.has(cell)) {
    wetCells.add(cell);
    wetSpots = wetCells.size;
  }
  if (hero) heroSequence = 2;
};

// ---------- per-frame logic ----------
const unicornInput = {
  mode: 'idle' as 'idle' | 'walk' | 'brace' | 'pull',
  lookTarget: new THREE.Vector3(0, 16.2, -23.2),
  hornTarget: new THREE.Vector3(0, 16.2, -23.2),
  hornReach: 0,
  torque: 0,
  effort: 0,
  hintNudge: 0,
  walkDir: new THREE.Vector3(),
  windAmp: 0.7,
};

function knotCenter(): THREE.Vector3 {
  return cloud.loops[1].center;
}

function tick(dt: number) {
  simTime += dt;
  phaseT += dt;
  gesture.update(dt);

  const wind = 0.55 + 0.35 * Math.sin(simTime * 0.23) * Math.sin(simTime * 0.11 + 2);
  unicornInput.windAmp = wind;
  unicornInput.hintNudge = 0;
  unicornInput.torque = 0;
  unicornInput.effort = 0;

  // ----- phase machine -----
  switch (phase) {
    case 'intro_wide':
      if (phaseT > 4.6) setPhase('intro_knot');
      unicornInput.mode = 'idle';
      break;
    case 'intro_knot':
      if (phaseT > 4.4) setPhase('approach');
      unicornInput.mode = 'idle';
      break;
    case 'approach': {
      const to = tmpV.set(WORK.x - unicorn.root.position.x, 0, WORK.z - unicorn.root.position.z);
      const dist = to.length();
      if (dist > 0.35) {
        unicornInput.mode = 'walk';
        unicornInput.walkDir.copy(to.normalize());
      } else {
        unicornInput.mode = 'brace';
        unicornInput.walkDir.set(0, 0, 0);
        if (phaseT > 2.2) setPhase('closeup');
      }
      if (phaseT > 7) setPhase('closeup'); // safety
      break;
    }
    case 'closeup':
    case 'play': {
      unicornInput.mode = 'brace';
      handleUnwinding(dt);
      if (cloud.allOpen && phase !== 'play') { /* fallthrough guard */ }
      if (cloud.allOpen) {
        setPhase('free');
        cloud.steerW = 1;
        cloud.steerX = knotCenter().x;
      } else if (firstLoopOpened && phase === 'closeup' && heroSequence === 2 && phaseT > 2 && !gesture.state.down) {
        setPhase('play');
      }
      break;
    }
    case 'free': {
      unicornInput.mode = 'brace';
      handleFreeSteer(dt);
      // the sun returns only after the child has really played with the rain
      if (steerTime > 10 && wetSpots >= 6) {
        sunUp = Math.min(1, sunUp + dt * 0.09);
      }
      if (sunUp > 0.75 && phaseT > 24) setPhase('afterglow');
      break;
    }
    case 'afterglow':
      unicornInput.mode = 'idle';
      handleFreeSteer(dt); // still steerable — the toy stays alive
      sunUp = Math.min(1, sunUp + dt * 0.08);
      break;
  }

  // ----- hint ladder (closeup, before first success) -----
  if (phase === 'closeup' && !firstLoopOpened) {
    if (!gesture.state.down) idleSinceInput += dt;
    else idleSinceInput = 0;
    // stage 3: the loop half-tightens and returns (shows it CAN move)
    if (idleSinceInput > 6 && hintTightenT < 0) hintTightenT = 0;
    if (hintTightenT >= 0) {
      hintTightenT += dt;
      const L = cloud.loops[0];
      const s = hintTightenT;
      if (s < 1.6) {
        L.twist = Math.sin(smoothstep(0, 1.6, s) * Math.PI) * -Math.PI * UNWIND_SIGN;
      } else {
        L.twist = 0;
        if (idleSinceInput > 6) hintTightenT = -1; // may replay
      }
    }
    // stage 4: unicorn tips its head the unwinding way
    if (idleSinceInput > 12) unicornInput.hintNudge = 1;
  }

  // ----- unicorn look/horn targets -----
  const strandTip = cloud.strandTipWorld(tmpV2);
  unicornInput.lookTarget.copy(knotCenter());
  let hornNear = 0;
  if (activeLoop >= 0 && gesture.state.down) {
    const L = cloud.loops[activeLoop];
    // horn reaches to the loop's near-lower edge — contact before effect
    unicornInput.hornTarget.copy(L.center).add(tmpV.set(1.6, -2.3, 1.4));
    unicornInput.hornReach = 1;
    hornNear = 1;
  } else if (phase === 'closeup' || phase === 'play') {
    unicornInput.hornTarget.copy(strandTip);
    unicornInput.hornReach = 0.55;
    // pre-touch: pointer hovering near loop0's screen area draws the strand
    hornNear = 0;
  } else {
    unicornInput.hornTarget.copy(knotCenter());
    unicornInput.hornReach = phase === 'approach' ? 0.4 : 0.2;
  }

  unicorn.update(dt, simTime, unicornInput);

  // ----- cloud -----
  const hornWorld = unicorn.hornTipWorld(tmpV);
  cloud.update(dt, simTime, director.camera, wind, sunUp, hornWorld, hornNear);

  // ----- rain: ambient drizzle from opened loops -----
  for (let i = 0; i < LOOP_COUNT; i++) {
    const L = cloud.loops[i];
    if (L.open && phase !== 'free' && phase !== 'afterglow') {
      rain.emit(L.center, 2.5, 2.2, dt);
    }
  }
  rain.update(dt, wetMask);
  wetMask.update();

  // hero-drop camera ride: dip the gaze, no cut
  if (heroSequence === 1) {
    director.dropFollow = damp(director.dropFollow, 1, 2.5, dt);
    director.dropFocus.copy(rain.heroFocus);
    if (rain.heroActive <= 0) heroSequence = 2;
  } else {
    director.dropFollow = damp(director.dropFollow, 0, 1.2, dt);
  }

  // ----- world uniforms -----
  const U = world.terrainUniforms;
  (U.camPos.value as THREE.Vector3).copy(director.camera.position);
  U.sunUp.value = sunUp;
  const shadowArr = U.cloudShadow.value as Float32Array;
  for (let i = 0; i < LOOP_COUNT; i++) {
    shadowArr[i * 2] = cloud.loops[i].center.x + (cloud.steerW > 0.5 ? (cloud.steerX - knotCenter().x) * 0.35 : 0);
    shadowArr[i * 2 + 1] = 0.55 + 0.45 * (1 - cloud.loops[i].progress);
  }
  (U.sunColor.value as THREE.Color).setRGB(
    lerp(0.55, 1.0, sunUp), lerp(0.55, 0.92, sunUp), lerp(0.58, 0.78, sunUp));
  (U.skyColor.value as THREE.Color).setRGB(
    lerp(0.42, 0.55, sunUp), lerp(0.46, 0.6, sunUp), lerp(0.52, 0.68, sunUp));
  (U.fogColor.value as THREE.Color).setRGB(
    lerp(0.62, 0.74, sunUp), lerp(0.63, 0.74, sunUp), lerp(0.66, 0.75, sunUp));
  U.fogDensity.value = lerp(0.0075, 0.0058, sunUp);
  world.skyUniforms.sunUp.value = sunUp;
  world.skyUniforms.time.value = simTime;
  hemi.intensity = lerp(0.9, 1.15, sunUp);
  sun.intensity = lerp(0.75, 1.25, sunUp);
  (sun.color as THREE.Color).setRGB(lerp(0.54, 1.0, sunUp), lerp(0.55, 0.95, sunUp), lerp(0.6, 0.82, sunUp));

  veg.update(dt, simTime, wetMask, wind, sunUp);

  // rainbow: only over ground that actually got rain, only once sun returns
  if (sunUp > 0.45 && wetSpots >= 4) {
    if (!rainbow.visible) {
      rainbow.visible = true;
      // arc over the wetted area's rough center
      let cx = 0, cz = 0, n = 0;
      wetCells.forEach((c) => {
        cx += (Math.floor(c / 64)) * 7 - 60 + 3.5;
        cz += (c % 64) * 7 - 60 + 3.5;
        n++;
      });
      if (n > 0) rainbow.position.set(cx / n, 1, cz / n - 4);
      rainbow.rotation.y = 0.25;
    }
    rainbowUniforms.fade.value = Math.min(0.9, rainbowUniforms.fade.value + dt * 0.1);
  }

  // ----- audio -----
  const tension = 1 - cloud.openAll;
  const friction = activeLoop >= 0 && gesture.state.down ? clamp(Math.abs(gesture.state.smoothAngVel) / 6, 0, 1) : 0;
  audio.setState(
    tension,
    friction,
    clamp(rain.activeCount / 130, 0, 1),
    wind * (0.7 + 0.3 * tension),
    clamp(wetMask.totalWet / 2600, 0, 1) * (0.4 + sunUp * 0.6)
  );

  // ----- camera -----
  director.update(dt, window.innerWidth / window.innerHeight);
}

// unwinding interaction (closeup + play)
function handleUnwinding(dt: number) {
  if (activeLoop < 0 || !gesture.state.down || !gesture.state.engaged) return;
  const s = gesture.state;
  const L = cloud.loops[activeLoop];
  const w = window.innerWidth, h = window.innerHeight;
  // keep anchor pinned on the loop as camera drifts
  director.toScreen(L.center, w, h, scr);
  gesture.setAnchor(scr.x, scr.y);

  const minDim = Math.min(w, h);
  const radT = clamp(s.radius / (minDim * 0.28), 0.45, 1.7); // circle size
  const vel = s.smoothAngVel * UNWIND_SIGN;
  unicornInput.mode = 'pull';
  unicornInput.effort = clamp(Math.abs(s.smoothAngVel) / 6, 0, 1);
  unicornInput.torque = clamp(vel / 5, -1, 1);

  if (vel > 0.25) {
    if (!L.open) {
      // correct direction: the loop loosens; big circles spread the effect
      const rate = 0.13 * vel * lerp(0.7, 1.25, smoothstep(0.45, 1.7, radT));
      L.progress = clamp(L.progress + rate * dt, 0, 1);
      L.twist += vel * dt * 0.55;
      L.jiggle = clamp(0.3 + unicornInput.effort, 0, 1.2);
      L.working = 1;
      idleSinceInput = 0;
      // a quarter turn is enough to free the FIRST few drops — the child
      // must see cause → effect before the loop is even fully open
      if (L.progress > 0.22 && !L.releasedHero) {
        L.releasedHero = true;
        if (!firstLoopOpened && heroSequence === 0) {
          heroSequence = 1;
          rain.releaseHero(L.center, 4);
        } else {
          rain.releaseHero(L.center, 2);
        }
      }
      // big circles bleed a little slack into neighbours & make the unicorn step
      if (radT > 1.15) {
        for (let i = 0; i < LOOP_COUNT; i++) {
          if (i !== activeLoop && !cloud.loops[i].open) {
            cloud.loops[i].progress = clamp(cloud.loops[i].progress + rate * dt * 0.22, 0, 0.85);
          }
        }
      }
      replantAcc += Math.abs(vel) * dt;
      if (replantAcc > 1.15 * (radT > 1.15 ? 0.7 : 1)) {
        replantAcc = 0;
        unicorn.replant();
      }
      if (L.progress >= 1 && !L.open) {
        L.open = true;
        L.jiggle = 0;
        audio.loopRelease();
        firstLoopOpened = true;
        rain.emit(L.center, 50, 2.0, 0.25); // a visible burst, not a deluge
      }
    } else {
      // circling an opened loop pumps rain: speed = density, size = spread
      const rate = clamp(vel * 9, 0, 60) * lerp(0.7, 1.3, smoothstep(0.45, 1.7, radT));
      const spread = lerp(1.4, 4.2, smoothstep(0.45, 1.7, radT));
      rain.emit(L.center, rate, spread, dt);
      L.working = 1;
    }
  } else if (vel < -0.6 && !L.open) {
    // wrong way: never dangerous — a springy refusal that points the way
    L.bounce = 1;
    L.twist = damp(L.twist, L.twist + 0.3, 3, dt); // tiny recoil the correct way
    unicornInput.hintNudge = 0.6;
  }
}

// after all loops open: the thin band is steerable, rain follows it
function handleFreeSteer(dt: number) {
  const s = gesture.state;
  steerTime += (s.down ? dt : 0);
  if (s.down) {
    const w = window.innerWidth;
    // horizontal finger position maps to valley x
    const nx = (s.x / w) * 2 - 1;
    const targetX = clamp(nx * 26, -28, 28);
    cloud.steerX = damp(cloud.steerX, targetX, 3, dt);
    // circles modulate: speed = density, radius = width of the curtain
    const minDim = Math.min(window.innerWidth, window.innerHeight);
    const radT = clamp(s.radius / (minDim * 0.28), 0.45, 1.7);
    const speed = Math.abs(s.smoothAngVel);
    const rate = 8 + clamp(speed * 10, 0, 55);
    const spread = lerp(2.2, 7.0, smoothstep(0.45, 1.7, radT));
    tmpV.set(cloud.steerX, 14.4, -22.5);
    rain.emit(tmpV, rate, spread, dt);
    // unicorn walks a little to follow the band
    const dx = cloud.steerX * 0.32 + 5 - unicorn.root.position.x;
    if (Math.abs(dx) > 2.5) {
      unicornInput.mode = 'walk';
      unicornInput.walkDir.set(Math.sign(dx), 0, 0);
    }
    unicornInput.effort = clamp(speed / 6, 0, 1);
    unicornInput.hornTarget.set(cloud.steerX * 0.6, 13.5, -25.5);
    unicornInput.hornReach = 1;
  } else {
    // gentle ambient release keeps the world breathing
    tmpV.set(cloud.steerX, 14.4, -22.5);
    rain.emit(tmpV, 4, 3.0, dt);
  }
}

// ---------- frame loop ----------
let lastT = performance.now();
let frameEMA = 16.7;
let adaptT = 0;

function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (dt > 0.1) dt = 0.1;
  if (E2E) dt = 1 / 60; // deterministic stepping under test

  frameEMA = frameEMA * 0.95 + (dt * 1000) * 0.05;
  adaptT += dt;
  if (adaptT > 2 && !E2E) {
    adaptT = 0;
    if (frameEMA > 30 && dprScale > 0.7) {
      dprScale -= 0.15;
      resize();
      cloud.setSpriteCount(10);
    } else if (frameEMA < 15 && dprScale < 1) {
      dprScale += 0.15;
      resize();
    }
  }

  tick(dt);
  renderer.render(scene, director.camera);
}

resize();
frame();

// ---------- deterministic hooks for tests ----------
if (E2E) (window as any).__debug = { cloud, scene, director, unicorn, THREE };
(window as any).__game = {
  get phase() { return phase; },
  get loops() { return cloud.loops.map((l) => ({ progress: l.progress, open: l.open })); },
  get rainActive() { return rain.activeCount; },
  get rainLanded() { return rain.totalLanded; },
  get flowersAwake() { return veg.wokenCount; },
  get sunUp() { return sunUp; },
  get wetSpots() { return wetSpots; },
  get frameMs() { return frameEMA; },
  skipIntro() {
    unicorn.root.position.set(WORK.x, terrainHeight(WORK.x, WORK.z), WORK.z);
    setPhase('closeup');
  },
  unwind(i: number, amount: number) {
    const L = cloud.loops[i];
    L.progress = clamp(L.progress + amount, 0, 1);
    L.twist += amount * 4;
    if (L.progress >= 1 && !L.open) {
      L.open = true;
      if (!firstLoopOpened) {
        firstLoopOpened = true;
        heroSequence = 1;
        rain.releaseHero(L.center, 4);
      }
    }
  },
  loopScreen(i: number) {
    const o = { x: 0, y: 0 };
    director.toScreen(cloud.loops[i].center, window.innerWidth, window.innerHeight, o);
    return o;
  },
  tick(seconds: number) {
    const steps = Math.ceil(seconds * 60);
    for (let s = 0; s < steps; s++) tick(1 / 60);
  },
};
