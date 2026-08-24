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

// ---------- quality tier (decided before the renderer so AA can depend on it) ----------
const coarseDPR = Math.min(window.devicePixelRatio || 1, 2);
let quality = (navigator.hardwareConcurrency || 4) >= 4 && coarseDPR >= 1.5 ? 1 : 0;
if (E2E) quality = 0;
let baseDPR = E2E ? 1 : quality > 0 ? Math.min(coarseDPR, 2) : Math.min(coarseDPR, 1.5);
let dprScale = 1;

// ---------- renderer ----------
const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({
  antialias: !E2E && quality > 0,
  powerPreference: 'high-performance',
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

// mobile Safari drops GL contexts on backgrounding/memory pressure —
// a frozen canvas in a child's hands is unacceptable
renderer.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault());
renderer.domElement.addEventListener('webglcontextrestored', () => location.reload());

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(baseDPR * dprScale);
  renderer.setSize(w, h);
}
window.addEventListener('resize', resize);
// iOS reports stale viewport sizes after rotation; retry a few times
window.addEventListener('orientationchange', () => {
  setTimeout(resize, 60);
  setTimeout(resize, 300);
  setTimeout(resize, 700);
});
window.visualViewport?.addEventListener('resize', resize);

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
const WORK = new THREE.Vector3(6.0, 0, -22.2);
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
let idleSinceProgress = 0;   // hint escalation: time without real unwinding
let hintTightenT = -1;       // knot half-turn tighten anim
let hintLoop = 0;            // which closed loop the hints act on
let steerTime = 0;           // accumulated free-steer play
let steerMoved = 0;          // accumulated |Δsteer| — genuine carrying
let sunUp = 0;
let wetSpots = 0;            // distinct areas rained on (for rainbow condition)
const wetCells = new Set<number>();
let dripTokens = 8;          // refilling budget for impact plinks
let virgaT = 2.5;            // timer for the "almost rains" tease

// gesture
const gesture = new Gesture(renderer.domElement);
let activeLoop = -1;
let replantAcc = 0;
let wrongWayKicked = false;
// rolling centroid of recent touch points: the circle's own center becomes
// the anchor during free play, so speed/size readings track the real circle
const anchorTrail: { x: number; y: number }[] = [];
const scr = { x: 0, y: 0 };
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

// knot winding: loops read as wound clockwise (screen), so unwind = CCW = angVel > 0
const UNWIND_SIGN = 1;

gesture.onDown = (x, y) => {
  audio.start();
  audio.resume();
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
      hintLoop = best;
      director.toScreen(cloud.loops[best].center, w, h, scr);
      gesture.setAnchor(scr.x, scr.y);
      // a bare touch already answers: the trapped drops stir under the horn
      const L = cloud.loops[best];
      if (!L.open) L.jiggle = Math.max(L.jiggle, 0.6);
      // a touch interrupts any playing hint
      hintTightenT = -1;
      cloud.loops[hintLoop].hintTwist = 0;
    } else {
      activeLoop = -1;
    }
  }
  if (phase === 'free' || phase === 'afterglow') {
    gesture.setAnchor(x, y); // circle center starts under the finger
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

// rain impacts: plinks on a refilling budget (never a permanent silence),
// wet-cell tracking for the sun/rainbow condition
rain.onImpact = (x, z, hero) => {
  if (hero || dripTokens >= 1) {
    audio.drip(0.85 + Math.random() * 0.4);
    if (!hero) dripTokens -= 1;
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

/** waiting (dry) flowers below a loop, nearest-first — first drops aim here */
function nearestFlowerTargets(center: THREE.Vector3, n: number): THREE.Vector3[] {
  return veg.flowers
    .filter((f) => !f.woken && Math.abs(f.pos.x - center.x) < 4 && f.pos.z > center.z - 2)
    .sort((a, b) =>
      Math.abs(a.pos.x - center.x) - Math.abs(b.pos.x - center.x))
    .slice(0, n)
    .map((f) => f.pos);
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
      // the sun returns only after the child has really played with the
      // rain — by carrying it around (steerMoved) OR by soaking one place
      // deeply (totalWet). Both strategies are success.
      if (steerTime > 6 && (steerMoved > 22 || wetSpots >= 6 || wetMask.totalWet > 420)) {
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

  // ----- hint ladder: escalates on UNPRODUCTIVE time, not just no-touch.
  // A tapping, scribbling child still deserves growing help. Runs until the
  // whole knot is open; acts on the closed loop nearest the last touch.
  let strandBeckon = 0;
  if ((phase === 'closeup' || phase === 'play') && !cloud.allOpen) {
    idleSinceProgress += dt; // reset inside handleUnwinding on real progress
    if (cloud.loops[hintLoop].open) {
      hintLoop = cloud.loops.findIndex((l) => !l.open);
    }
    const HL = cloud.loops[hintLoop];
    // stage 2 (from 3s): the unicorn reaches out and the strand leans to the
    // horn — a diegetic beckon toward the loosest thread
    strandBeckon = smoothstep(3, 5, idleSinceProgress);
    // stage 3 (from 6s): the loop half-tightens and springs back — it CAN move
    if (idleSinceProgress > 6 && hintTightenT < 0 && !gesture.state.engaged) hintTightenT = 0;
    if (hintTightenT >= 0) {
      hintTightenT += dt;
      const s = hintTightenT;
      if (s < 1.6 && !gesture.state.engaged) {
        HL.hintTwist = Math.sin(smoothstep(0, 1.6, s) * Math.PI) * -1.6 * UNWIND_SIGN;
      } else {
        HL.hintTwist = 0;
        hintTightenT = -1; // may replay after another quiet stretch
        if (gesture.state.engaged) idleSinceProgress = Math.min(idleSinceProgress, 5.5);
      }
    }
    // stage 4 (from 12s): unicorn tips its head the unwinding way (signed)
    if (idleSinceProgress > 12) unicornInput.hintNudge = 1;
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
    // idle beckon: the horn stretches toward the strand and the strand
    // leans back to meet it — the invitation is acted, not written
    unicornInput.hornReach = 0.55 + 0.45 * strandBeckon;
    hornNear = strandBeckon;
  } else {
    unicornInput.hornTarget.copy(knotCenter());
    unicornInput.hornReach = phase === 'approach' ? 0.4 : 0.2;
  }

  unicorn.update(dt, simTime, unicornInput);

  // ----- cloud -----
  const hornWorld = unicorn.hornTipWorld(tmpV);
  cloud.update(dt, simTime, director.camera, wind, sunUp, hornWorld, hornNear);

  // ----- rain: ambient drizzle from each opened loop's freed band section -----
  for (let i = 0; i < LOOP_COUNT; i++) {
    const L = cloud.loops[i];
    if (L.open && phase !== 'free' && phase !== 'afterglow') {
      rain.emit(cloud.releaseCenter(i, tmpV), 2.5, 2.2, dt);
    }
  }
  // virga tease while the knot holds: a single drop escapes, falls a little,
  // and dries up mid-air — rain that almost happens
  if (!firstLoopOpened && phase !== 'free' && phase !== 'afterglow') {
    virgaT -= dt;
    if (virgaT <= 0) {
      virgaT = 5 + Math.random() * 4;
      const L = cloud.loops[Math.floor(Math.random() * LOOP_COUNT)];
      rain.releaseVirga(tmpV.set(L.center.x, L.center.y - 2.2, L.center.z + 0.6));
    }
  }
  dripTokens = Math.min(10, dripTokens + dt * 1.5);
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
    lerp(0.72, 1.05, sunUp), lerp(0.64, 0.95, sunUp), lerp(0.50, 0.78, sunUp));
  (U.skyColor.value as THREE.Color).setRGB(
    lerp(0.40, 0.55, sunUp), lerp(0.44, 0.6, sunUp), lerp(0.50, 0.68, sunUp));
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
  const circling = gesture.state.down && (activeLoop >= 0 || phase === 'free' || phase === 'afterglow');
  const friction = circling ? clamp(Math.abs(gesture.state.smoothAngVel) / 6, 0, 1) : 0;
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
      // correct direction: the loop loosens; big circles clearly work faster
      const rate = 0.13 * vel * lerp(0.55, 1.6, smoothstep(0.45, 1.7, radT));
      L.progress = clamp(L.progress + rate * dt, 0, 1);
      L.twist += vel * dt * 0.55;
      L.jiggle = clamp(0.3 + unicornInput.effort, 0, 1.2);
      L.working = 1;
      idleSinceProgress = 0;
      // a quarter turn is enough to free the FIRST few drops — the child
      // must see cause → effect before the loop is even fully open
      if (L.progress > 0.22 && !L.releasedHero) {
        L.releasedHero = true;
        const rc = cloud.releaseCenter(activeLoop, tmpV2);
        if (!firstLoopOpened && heroSequence === 0) {
          heroSequence = 1;
          rain.releaseHero(L.center, 4, nearestFlowerTargets(L.center, 2));
        } else {
          rain.releaseHero(rc, 2, nearestFlowerTargets(rc, 1));
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
        rain.emit(cloud.releaseCenter(activeLoop, tmpV2), 50, 2.0, 0.25); // a burst, not a deluge
      }
    } else {
      // circling an opened loop pumps its freed section: speed = density,
      // size = spread
      const rate = clamp(vel * 9, 0, 60) * lerp(0.7, 1.3, smoothstep(0.45, 1.7, radT));
      const spread = lerp(1.4, 4.2, smoothstep(0.45, 1.7, radT));
      rain.emit(cloud.releaseCenter(activeLoop, tmpV2), rate, spread, dt);
      L.working = 1;
    }
    wrongWayKicked = false;
  } else if (vel < -0.25 && !L.open) {
    // wrong way: never dangerous — one springy recoil that visibly rotates
    // the loop the CORRECT way, then settles
    L.bounce = 1;
    if (!wrongWayKicked) {
      wrongWayKicked = true;
      L.hintTwist = 0.9 * UNWIND_SIGN;
    }
    unicornInput.hintNudge = 0.6;
  } else if (Math.abs(vel) < 0.1) {
    wrongWayKicked = false;
  }
}

// after all loops open: the thin band is steerable, rain follows it.
// The finger is unprojected onto the cloud's own plane so screen position
// and world position agree — the child carries the cloud, the cloud comes.
const steerRay = new THREE.Vector3();
function handleFreeSteer(dt: number) {
  const s = gesture.state;
  steerTime += (s.down ? dt : 0);
  if (s.down) {
    // finger ray → cloud plane (y = 14.2): true world x under the finger
    const w = window.innerWidth, h = window.innerHeight;
    steerRay.set((s.x / w) * 2 - 1, -(s.y / h) * 2 + 1, 0.5)
      .unproject(director.camera)
      .sub(director.camera.position)
      .normalize();
    // pointing at the sky steers the cloud; pointing at the ground says
    // "rain HERE" — both must answer, wherever the finger lands
    let targetX = cloud.steerX;
    const camY = director.camera.position.y;
    if (Math.abs(steerRay.y) > 1e-4) {
      const tCloud = (14.2 - camY) / steerRay.y;
      const tGround = (7.0 - camY) / steerRay.y;
      const t = tCloud > 0 ? tCloud : tGround > 0 ? tGround : -1;
      if (t > 0) targetX = clamp(director.camera.position.x + steerRay.x * t, -26, 26);
    }
    const prev = cloud.steerX;
    cloud.steerX = damp(cloud.steerX, targetX, 4, dt);
    steerMoved += Math.abs(cloud.steerX - prev);

    // circle detection around the child's own circle center
    anchorTrail.push({ x: s.x, y: s.y });
    if (anchorTrail.length > 20) anchorTrail.shift();
    let ax = 0, ay = 0;
    for (const p of anchorTrail) { ax += p.x; ay += p.y; }
    gesture.setAnchor(ax / anchorTrail.length, ay / anchorTrail.length);

    // circles modulate: speed = density, radius = width of the curtain
    const minDim = Math.min(w, h);
    const radT = clamp(s.radius / (minDim * 0.28), 0.45, 1.7);
    const speed = Math.abs(s.smoothAngVel);
    // carrying the cloud rains as you go; circling thickens it further
    const carryRate = clamp(Math.abs(cloud.steerX - prev) / Math.max(dt, 1e-3) * 2.5, 0, 20);
    const rate = 14 + carryRate + clamp(speed * 10, 0, 45);
    const spread = lerp(2.2, 7.0, smoothstep(0.45, 1.7, radT));
    // rain leaves from where the band's belly actually is
    const bellyX = knotCenter().x + (cloud.steerX - knotCenter().x) * 0.9;
    tmpV.set(bellyX, 14.0, -22.5);
    rain.emit(tmpV, rate, spread, dt);
    // unicorn walks a little to follow the band
    const dx = bellyX * 0.32 + 5 - unicorn.root.position.x;
    if (Math.abs(dx) > 2.5) {
      unicornInput.mode = 'walk';
      unicornInput.walkDir.set(Math.sign(dx), 0, 0);
    }
    unicornInput.effort = clamp(speed / 6, 0, 1);
    unicornInput.hornTarget.set(bellyX * 0.6, 13.5, -25.5);
    unicornInput.hornReach = 1;
  } else {
    anchorTrail.length = 0;
    // gentle ambient release keeps the world breathing
    const bellyX = knotCenter().x + (cloud.steerX - knotCenter().x) * 0.9;
    tmpV.set(bellyX, 14.0, -22.5);
    rain.emit(tmpV, 4, 3.0, dt);
  }
}

// ---------- frame loop ----------
let lastT = performance.now();
let frameEMA = 16.7;
let adaptT = 0;
let warmupT = 0;

function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (dt > 0.1) dt = 0.1;
  if (E2E) dt = 1 / 60; // deterministic stepping under test

  frameEMA = frameEMA * 0.95 + (dt * 1000) * 0.05;
  adaptT += dt;
  warmupT += dt;
  // skip the first seconds (shader-compile jank would ratchet quality down);
  // the up-threshold sits above 60Hz frame time so recovery can actually fire
  if (adaptT > 2 && warmupT > 3.5 && !E2E) {
    adaptT = 0;
    if (frameEMA > 30 && dprScale > 0.7) {
      dprScale -= 0.15;
      resize();
      cloud.setSpriteCount(10);
    } else if (frameEMA < 17.5 && dprScale < 1) {
      dprScale += 0.15;
      resize();
      cloud.setSpriteCount(quality > 0 ? 20 : 12);
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
        rain.releaseHero(L.center, 4, nearestFlowerTargets(L.center, 2));
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
