// もちつき -- 進行、入力、演出
import * as THREE from '../vendor/three.module.js';
import { buildWorld } from './env.js';
import { makeUsu, makeKine, makeArm, makeDaidai } from './tools.js';
import { MochiMass, MochiBlob, MochiString, USU_FLOOR, MOCHI_R0, REST_H, clamp, mix, smoothstep } from './mochi.js';
import { Steam, Flour, Snowfall, Sparkle, Grains, GRAIN_STATE as GS } from './fx.js';
import { Sound } from './audio.js';
import { CameraRig } from './camera.js';
import { UI, GLYPH } from './ui.js';

const PHASE = { BOOT: 0, TITLE: 1, POUR: 2, POUND: 3, STRETCH: 4, CARRY: 5, CUT: 6, ROLL: 7, FINALE: 8 };
const HITS_TOTAL = 8;
const PULLS_TOTAL = 3;
const PIECES = 4;
const BOARD = new THREE.Vector3(1.65, 0.734, -0.35);
const KINE_PARK = { x: 0.60, y: 0.0705, z: 0.34, rx: Math.PI / 2, ry: -0.62 };
const BOARD_ROT = -0.30;

/* 板の上のローカル座標 -> ワールド */
function boardPos(lx, ly, lz) {
  const c = Math.cos(BOARD_ROT), s = Math.sin(BOARD_ROT);
  return new THREE.Vector3(BOARD.x + lx * c + lz * s, BOARD.y + ly, BOARD.z - lx * s + lz * c);
}

/* ---------- 立ち上げ ---------- */
const QS = new URLSearchParams(location.search);
const SPEED = Math.max(0.1, Math.min(12, +QS.get('speed') || 1));
const FAST = QS.has('fast');
const app = document.getElementById('app');

/* WebGL が使えない端末には静かに知らせる */
function noWebGL(msg) {
  const b = document.getElementById('boot');
  if (b) {
    b.classList.remove('gone');
    b.innerHTML = '<div style="max-width:22em;text-align:center;line-height:1.9;font-size:15px">' +
      '<div style="font-size:44px;margin-bottom:14px">🍡</div>' +
      'この端末では 3D 表示（WebGL）を使えませんでした。<br>Safari や Chrome の最新版でお試しください。' +
      '<div style="opacity:.5;font-size:12px;margin-top:12px">' + (msg || '') + '</div></div>';
  }
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
} catch (e) {
  noWebGL(String(e && e.message || e));
  throw e;
}
renderer.setPixelRatio(FAST ? 1 : Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;
renderer.shadowMap.enabled = !FAST;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);
renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); running = false; });
renderer.domElement.addEventListener('webglcontextrestored', () => { running = true; clock.getDelta(); });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.08, 90);
scene.add(camera);
const rig = new CameraRig(camera);

const world = buildWorld(scene, renderer);
scene.attach(world.seiro);          // 蒸籠を独立して動かせるようにする
world.seiro.userData.home = world.seiro.position.clone();

const usu = makeUsu(scene, world.mats.usuWood);
const kine = makeKine(scene, world.mats.kineWood);
const mochi = new MochiMass(scene);
const grains = new Grains(scene, 520);
const steam = new Steam(scene);
const flour = new Flour(scene);
const snowfall = new Snowfall(scene);
const sparkle = new Sparkle(scene);
const sound = new Sound();
const ui = new UI(document.getElementById('ui'));
ui.onMute = (m) => sound.setMuted(m);

const armL = makeArm(scene, { scale: 1.0 });
const armR = makeArm(scene, { scale: 1.0 });
armR.userData.hand.scale.x = -1;     // 右手は鏡像
// 丸めるときは「じぶんの手」。子どもの小さな手として少し丸く小さく。
const myL = makeArm(scene, { scale: 0.72, sleeveColor: 0x3d5a76, skinColor: 0xe9bb98, sleeveR: 0.70, sleeveLen: 0.42 });
const myR = makeArm(scene, { scale: 0.72, sleeveColor: 0x3d5a76, skinColor: 0xe9bb98, sleeveR: 0.70, sleeveLen: 0.42 });
myR.userData.hand.scale.x = -1;
const daidai = makeDaidai(scene);

const pieces = [];
const strings = [];
for (let i = 0; i < PIECES; i++) {
  const b = new MochiBlob(scene, 0.050);
  b.mesh.visible = false;
  pieces.push(b);
}
for (let i = 0; i < PIECES - 1; i++) strings.push(new MochiString(scene, pieces[0].mat));

/* 湯気の噴き出し口 */
const seiroSteam = steam.addEmitter({
  pos: new THREE.Vector3(-1.55, 0.955, -1.35), rate: 20, radius: 0.24,
  vy: 0.46, life: 3.0, s0: 0.10, s1: 0.80, alpha: 0.30, warm: 1,
});
const usuSteam = steam.addEmitter({
  pos: new THREE.Vector3(0, USU_FLOOR + 0.12, 0), rate: 0, radius: 0.15,
  vy: 0.40, life: 2.2, s0: 0.08, s1: 0.55, alpha: 0.26, warm: 1,
});

/* ---------- 状態 ---------- */
const S = {
  phase: PHASE.BOOT,
  t: 0, pt: 0,           // 全体時間 / フェーズ内時間
  hits: 0, pulls: 0, cuts: 0, rollIdx: 0,
  kineY: 0.74, kineTilt: 0, kineRot: 0, kineUp: 0,
  swing: null,           // {stage, t}
  queued: false,
  pourP: 0,
  cohesion: 0,
  grabbing: false, grabY0: 0, grabTop0: 0,
  rollAmount: 0,
  carry: null,
  logSpread: 0,
  bigStretch: 0,
  armTarget: null,
  finaleDone: false,
};

const pointer = { down: false, x: 0, y: 0, sx: 0, sy: 0, lx: 0, ly: 0, t0: 0, moved: 0, used: false };

/* ---------- カメラの構図 ---------- */
const SHOTS = {
  establish: { pos: [1.46, 1.44, 2.02], look: [-0.02, 0.70, -0.74], fov: 50, smooth: 1.4 },
  pour: { pos: [1.42, 1.62, 1.72], look: [-0.18, 0.86, -0.34], fov: 46, smooth: 1.1 },
  pound: { pos: [1.08, 1.40, 1.60], look: [0.0, 0.76, 0.02], fov: 50, smooth: 0.85 },
  stretch: { pos: [0.72, 1.16, 0.98], look: [0, 0.60, 0], fov: 44, smooth: 0.5 },
  carry: { pos: [1.55, 1.48, 1.55], look: [0.9, 0.85, -0.2], fov: 46, smooth: 0.9, wr: 0.85 },
  cut: { pos: [1.76, 1.44, 0.74], look: [1.62, 0.79, -0.33], fov: 42, smooth: 0.8, wr: 1.0 },
  roll: { pos: [1.72, 1.24, 0.44], look: [1.62, 0.79, -0.28], fov: 40, smooth: 0.6, wr: 1.0 },
  finaleClose: { pos: [2.10, 1.20, 0.68], look: [1.22, 0.98, -0.38], fov: 34, smooth: 0.9, wr: 0.88 },
  finale: { pos: [2.05, 1.52, 2.30], look: [0.85, 0.76, -0.75], fov: 48, smooth: 1.6 },
};

/* ---------- 補助 ---------- */
const ease = {
  out3: t => 1 - Math.pow(1 - t, 3),
  in3: t => t * t * t,
  inOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outBack: t => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
  outElastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -9 * t) * Math.sin((t * 9 - 0.75) * (2 * Math.PI) / 3) + 1,
};
const V = new THREE.Vector3();
const V2 = new THREE.Vector3();

function project(v) {
  V2.copy(v).project(camera);
  return {
    x: (V2.x * 0.5 + 0.5) * window.innerWidth,
    y: (-V2.y * 0.5 + 0.5) * window.innerHeight,
  };
}

/* 腕を配置する。指先の向き (dir) と 手の甲の向き (up) で姿勢を決める。 */
const _ax = new THREE.Vector3(), _ay = new THREE.Vector3(), _az = new THREE.Vector3();
const _mb = new THREE.Matrix4();
function aimArm(arm, px, py, pz, dir, up) {
  arm.visible = true;
  arm.position.set(px, py, pz);
  _az.copy(dir).normalize();
  _ay.copy(up).normalize();
  _ax.crossVectors(_ay, _az);
  if (_ax.lengthSq() < 1e-6) _ax.set(1, 0, 0);
  _ax.normalize();
  _ay.crossVectors(_az, _ax).normalize();
  _mb.makeBasis(_ax, _ay, _az);
  arm.quaternion.setFromRotationMatrix(_mb);
}
const D = (x, y, z) => new THREE.Vector3(x, y, z);
function hideArms() { armL.visible = armR.visible = myL.visible = myR.visible = false; }

/* ---------- 米粒 ---------- */
function resetGrains() {
  for (let i = 0; i < grains.count; i++) {
    const g = grains.g[i];
    g.state = GS.HIDDEN;
    g.theta = Math.random() * Math.PI * 2;
    g.tt = 0.16 + Math.pow(Math.random(), 0.75) * 0.80;
    g.scale = 0.85 + Math.random() * 0.5;
    g.baseScale = g.scale;
    g.absorbAt = 0.10 + (i / grains.count) * 0.86 + Math.random() * 0.06;
    g.age = 0; g.dur = 1;
    g.wx = (Math.random() - 0.5) * 8; g.wy = (Math.random() - 0.5) * 8; g.wz = (Math.random() - 0.5) * 8;
    g.y = -9;
  }
}
function pourGrain(i, lip) {
  const g = grains.g[i];
  g.state = GS.FALL;
  g.x = lip.x + (Math.random() - 0.5) * 0.13;
  g.y = lip.y + (Math.random() - 0.5) * 0.05;
  g.z = lip.z + (Math.random() - 0.5) * 0.13;
  g.sx = g.x; g.sy = g.y; g.sz = g.z;
  g.age = 0; g.dur = 0.42 + Math.random() * 0.30;
}
const _sp = new THREE.Vector3();
function updateGrains(dt) {
  for (let i = 0; i < grains.count; i++) {
    const g = grains.g[i];
    if (g.state === GS.HIDDEN || g.state === GS.GONE) continue;
    g.rx += g.wx * dt; g.ry += g.wy * dt; g.rz += g.wz * dt;

    if (g.state === GS.FALL) {
      g.age += dt;
      const u = clamp(g.age / g.dur, 0, 1);
      mochi.surfacePoint(g.theta, g.tt, _sp);
      const k = ease.in3(u) * 0.55 + u * 0.45;
      g.x = mix(g.sx, _sp.x, k);
      g.z = mix(g.sz, _sp.z, k);
      g.y = mix(g.sy, _sp.y, u * u) + Math.sin(u * Math.PI) * 0.02;
      if (u >= 1) { g.state = GS.ONMOCHI; g.wx *= 0.05; g.wy *= 0.05; g.wz *= 0.05; }
    } else if (g.state === GS.ONMOCHI) {
      mochi.surfacePoint(g.theta, g.tt, _sp);
      g.x = _sp.x; g.y = _sp.y; g.z = _sp.z;
      g.wx = g.wy = g.wz = 0;
      if (S.cohesion > g.absorbAt) {
        g.state = GS.POP; g.age = 0; g.dur = 0.30;
        g.vx = 0; g.vy = 0; g.vz = 0; g.absorbing = true;
      }
    } else if (g.state === GS.POP) {
      g.age += dt;
      if (g.absorbing) {
        const u = clamp(g.age / g.dur, 0, 1);
        mochi.surfacePoint(g.theta, g.tt, _sp);
        g.x = _sp.x; g.y = mix(g.y, _sp.y - 0.004, 0.3); g.z = _sp.z;
        g.scale = g.baseScale * (1 - u);
        if (u >= 1) { g.state = GS.GONE; }
      } else {
        g.vy -= 7.0 * dt;
        g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
        mochi.surfacePoint(g.theta, g.tt, _sp);
        if (g.y <= _sp.y) { g.state = GS.ONMOCHI; }
      }
    }
  }
  grains.sync();
}
function popGrains(n, power) {
  let c = 0;
  for (let i = 0; i < grains.count && c < n; i++) {
    const g = grains.g[Math.floor(Math.random() * grains.count)];
    if (g.state !== GS.ONMOCHI) continue;
    g.state = GS.POP; g.absorbing = false; g.age = 0; g.dur = 2;
    const a = Math.random() * Math.PI * 2;
    g.vx = Math.cos(a) * 0.55 * power; g.vz = Math.sin(a) * 0.55 * power;
    g.vy = (0.9 + Math.random() * 1.5) * power;
    g.wx = (Math.random() - 0.5) * 22; g.wy = (Math.random() - 0.5) * 22;
    c++;
  }
}

/* ---------- 杵 ---------- */
function updateKine(dt) {
  const sw = S.swing;
  if (sw) {
    sw.t += dt;
    const top = 1.16, rest = 0.74;
    const surf = USU_FLOOR + mochi.topY;
    if (sw.stage === 'up') {
      const u = clamp(sw.t / 0.32, 0, 1);
      S.kineY = mix(sw.from, top, ease.out3(u));
      S.kineTilt = mix(0, -0.13, ease.out3(u));
      if (u >= 1) {
        if (sw.release || sw.t > 0.62) { sw.stage = 'down'; sw.t = 0; sw.from = S.kineY; }
      }
    } else if (sw.stage === 'down') {
      const u = clamp(sw.t / 0.145, 0, 1);
      S.kineY = mix(sw.from, surf, ease.in3(u) * 0.72 + u * 0.28);
      S.kineTilt = mix(-0.13, 0.02, u);
      if (u >= 1) { onImpact(); sw.stage = 'press'; sw.t = 0; }
    } else if (sw.stage === 'press') {
      const u = clamp(sw.t / 0.10, 0, 1);
      S.kineY = USU_FLOOR + mochi.topY * mix(1.0, 0.80, Math.sin(u * Math.PI));
      if (u >= 1) { sw.stage = 'lift'; sw.t = 0; sw.from = S.kineY; }
    } else if (sw.stage === 'lift') {
      const u = clamp(sw.t / 0.34, 0, 1);
      S.kineY = mix(sw.from, rest, ease.out3(u));
      S.kineTilt = mix(0.02, 0, u);
      if (u >= 1) { S.swing = null; startTegaeshi(); }
    }
  }
  if (!S.swing && !S.tegaeshi) S.kineY += Math.sin(S.t * 1.9) * 0.0004;
}

/* up=0: 土間に横たえる / up=1: 臼の上に構える */
function applyKinePose(up) {
  const k = ease.inOut(clamp(up, 0, 1));
  const arc = Math.sin(k * Math.PI) * 0.20;
  kine.position.set(mix(KINE_PARK.x, 0, k), mix(KINE_PARK.y, S.kineY, k) + arc, mix(KINE_PARK.z, 0, k));
  kine.rotation.set(mix(KINE_PARK.rx, S.kineTilt, k), mix(KINE_PARK.ry, S.kineRot, k), 0);
}

function onImpact() {
  const power = 1;
  mochi.hit(power);
  sound.pettan(power, S.cohesion);
  sound.riceSettle(0.6 + S.cohesion * 0.6);
  rig.shake(0.85);
  V.set(0, USU_FLOOR + mochi.topY * 0.7, 0);
  flour.burst(V, 22, 1.0);
  steam.burst(V, 5, { vy: 0.9, life: 1.4, s0: 0.10, s1: 0.55, alpha: 0.26, radius: 0.17 });
  popGrains(26, 1);
  S.hits++;
  S.cohesion = Math.pow(clamp(S.hits / HITS_TOTAL, 0, 1), 0.82);
  ui.setStep(S.hits);
}

let tegaeshiT = -1;
function startTegaeshi() {
  if (S.hits >= HITS_TOTAL) { toStretch(); return; }
  tegaeshiT = 0;
  S.tegaeshi = true;
}
function updateTegaeshi(dt) {
  if (tegaeshiT < 0) return;
  tegaeshiT += dt;
  const T = 0.70;
  const u = clamp(tegaeshiT / T, 0, 1);
  const surf = USU_FLOOR + mochi.topY;
  // 画面左手前から手が入り、餅をひと返しして抜ける (片手・安全なテンポ)
  const k = u < 0.26 ? ease.out3(u / 0.26) : u < 0.66 ? 1 : ease.out3(1 - (u - 0.66) / 0.34);
  const sweep = u > 0.26 && u < 0.66 ? (u - 0.26) / 0.40 : (u <= 0.26 ? 0 : 1);
  const sw = Math.sin(sweep * Math.PI);
  const ax = mix(-0.80, -0.10 + sw * 0.14, k);
  const ay = mix(0.80, surf + 0.035 + sw * 0.05, k);
  const az = mix(0.34, 0.05 - sw * 0.08, k);
  aimArm(armL, ax, ay, az, D(0.62 + sw * 0.25, -0.62, -0.48 + sw * 0.30), D(0, 1, 0.25));
  armR.visible = false;
  if (tegaeshiT >= 0.30 && !S.foldDone) {
    S.foldDone = true;
    mochi.fold();
    V.set(0, surf, 0);
    flour.burst(V, 16, 0.6);
    flour.burst(new THREE.Vector3(ax, ay + 0.03, az), 8, 0.35);
    sound.riceSettle(0.55);
  }
  if (u >= 1) {
    tegaeshiT = -1; S.tegaeshi = false; S.foldDone = false;
    hideArms();
    if (S.queued) { S.queued = false; startSwing(true); }
  }
}

function startSwing(autoRelease = false) {
  if (S.swing || S.tegaeshi) { S.queued = true; return; }
  S.swing = { stage: 'up', t: 0, from: S.kineY, release: autoRelease };
  sound.blip(300, 0.05, 0.12, 'triangle');
}

/* ---------- 場面遷移 ---------- */
function setPhase(p) {
  S.phase = p; S.pt = 0;
  ui.hideHint();
  if (p !== PHASE.TITLE && p !== PHASE.FINALE) ui.hideBig();
  if (p === PHASE.TITLE) {
    rig.set(SHOTS.establish);
    ui.clearSteps();
    ui.showBig(GLYPH.kine, () => { sound.init(); startGame(); });
  } else if (p === PHASE.POUR) {
    rig.set(SHOTS.pour);
    ui.clearSteps();
    sound.pour();
    seiroSteam.rate = 40;
  } else if (p === PHASE.POUND) {
    rig.set(SHOTS.pound);
    ui.setSteps(HITS_TOTAL);
    ui.setStep(0);
    usuSteam.rate = 14;
    setTimeout(() => { if (S.phase === PHASE.POUND && S.hits === 0 && !S.swing) ui.showHint('down'); }, 500);
  } else if (p === PHASE.STRETCH) {
    rig.set(SHOTS.stretch);
    ui.setSteps(PULLS_TOTAL);
    ui.setStep(0);
    usuSteam.rate = 6;
    setTimeout(() => { if (S.phase === PHASE.STRETCH && !S.grabbing) ui.showHint('up'); }, 400);
  } else if (p === PHASE.CARRY) {
    rig.set(SHOTS.carry);
    ui.clearSteps();
    usuSteam.rate = 0;
  } else if (p === PHASE.CUT) {
    rig.set(SHOTS.cut);
    ui.setSteps(PIECES - 1);
    ui.setStep(0);
    setTimeout(() => { if (S.phase === PHASE.CUT && S.cuts === 0) ui.showHint('across'); }, 400);
  } else if (p === PHASE.ROLL) {
    rig.set(SHOTS.roll);
    ui.setSteps(PIECES);
    ui.setStep(0);
    setTimeout(() => { if (S.phase === PHASE.ROLL && !S.rolling) ui.showHint('circle'); }, 400);
  } else if (p === PHASE.FINALE) {
    rig.set(SHOTS.finaleClose);
    ui.clearSteps();
  }
}

function startGame() {
  resetGrains();
  S.hits = 0; S.pulls = 0; S.cuts = 0; S.rollIdx = 0; S.cohesion = 0;
  S.pourP = 0; S.logSpread = 0; S.finaleDone = false; S.poured = 0; S.rollSpin = 0;
  S.grabbing = false; S.swing = null; S.queued = false; S.tegaeshi = false; S.foldDone = false;
  S.finale = null; S.carry = null; S.pullSpeed = 0;
  S.cutSpread = null; S.cutTarget = null;
  strings.forEach(s2 => { s2.prog = undefined; });
  pieces.forEach(p2 => { p2.done = false; p2.landed = false; });
  S.kineY = 0.74; S.kineTilt = 0; S.kineUp = 0;
  mochi.cohesion = 0; mochi.topY = 0.001; mochi.targetTopY = 0.001;
  mochi.visualR0 = MOCHI_R0 * 0.35;
  mochi.mesh.visible = true;
  mochi.mesh.rotation.y = 0;
  mochi.newShape(0);
  pieces.forEach(p => { p.mesh.visible = false; p.roundness = 0; p.flat = 0; p.r = 0.050; });
  strings.forEach(s => s.hide());
  daidai.visible = false;
  hideArms();
  setPhase(PHASE.POUR);
}

function toStretch() {
  hideArms();
  S.swing = null;
  S.kineY = USU_FLOOR + mochi.topY;
  mochi.newShape(0.35);
  sound.blip(523, 0.10, 0.5);
  setPhase(PHASE.STRETCH);
}

/* ---------- 各フェーズの更新 ---------- */
function updatePour(dt) {
  const t = S.pt;
  const seiro = world.seiro;
  const home = seiro.userData.home;
  const over = new THREE.Vector3(0.0, 1.10, 0.02);
  // 0.0-0.4 蓋をとる / 0.3-1.5 運ぶ / 1.5-3.0 傾ける / 3.0-4.0 戻す
  if (t < 1.6) {
    const u = clamp((t - 0.25) / 1.25, 0, 1);
    const k = ease.inOut(u);
    seiro.position.lerpVectors(home, over, k);
    seiro.position.y += Math.sin(k * Math.PI) * 0.16;
    seiro.rotation.z = 0;
    seiroSteam.pos.set(seiro.position.x, seiro.position.y + 0.34, seiro.position.z);
    if (u > 0.02) {
      aimArm(armL, seiro.position.x - 0.33, seiro.position.y + 0.10, seiro.position.z - 0.02, D(1, 0.10, -0.16), D(0, 1, 0));
      aimArm(armR, seiro.position.x + 0.33, seiro.position.y + 0.10, seiro.position.z - 0.02, D(-1, 0.10, -0.16), D(0, 1, 0));
    }
  } else if (t < 3.25) {
    const u = clamp((t - 1.6) / 0.45, 0, 1);
    seiro.rotation.z = ease.out3(u) * 1.30;
    seiro.position.copy(over);
    seiro.position.x -= ease.out3(u) * 0.10;
    seiroSteam.pos.set(seiro.position.x, seiro.position.y + 0.20, seiro.position.z);
    aimArm(armL, seiro.position.x - 0.30, seiro.position.y + 0.20, seiro.position.z - 0.02, D(1, -0.25, -0.16), D(0.2, 1, 0));
    aimArm(armR, seiro.position.x + 0.25, seiro.position.y - 0.04, seiro.position.z - 0.02, D(-1, 0.35, -0.16), D(-0.2, 1, 0));
    // 米を落とす
    const p = clamp((t - 1.85) / 1.15, 0, 1);
    S.pourP = p;
    const want = Math.floor(p * grains.count);
    const lip = new THREE.Vector3(seiro.position.x - 0.16, seiro.position.y - 0.06, seiro.position.z);
    while (S.poured < want) { pourGrain(S.poured, lip); S.poured++; }
    if (p > 0 && p < 1 && Math.random() < dt * 26) {
      steam.burst(new THREE.Vector3(0, USU_FLOOR + 0.16, 0), 2, { vy: 1.0, life: 2.0, s0: 0.10, s1: 0.7, alpha: 0.30, radius: 0.16 });
    }
  } else if (t < 4.4) {
    const u = clamp((t - 3.25) / 1.0, 0, 1);
    seiro.rotation.z = (1 - ease.inOut(u)) * 1.30;
    seiro.position.lerpVectors(over, home, ease.inOut(u));
    seiroSteam.pos.set(seiro.position.x, seiro.position.y + 0.34, seiro.position.z);
    aimArm(armL, seiro.position.x - 0.33, seiro.position.y + 0.10, seiro.position.z - 0.02, D(1, 0.10, -0.16), D(0, 1, 0));
    aimArm(armR, seiro.position.x + 0.33, seiro.position.y + 0.10, seiro.position.z - 0.02, D(-1, 0.10, -0.16), D(0, 1, 0));
    if (u > 0.85) hideArms();
  } else {
    seiro.position.copy(home); seiro.rotation.z = 0;
    seiroSteam.rate = 20;
    seiroSteam.pos.set(home.x, home.y + 0.34, home.z);
    hideArms();
    setPhase(PHASE.POUND);
    return;
  }
  // 餅の素が育つ
  const grow = clamp(S.pourP, 0, 1);
  mochi.topY = 0.008 + grow * 0.152;
  mochi.visualR0 = MOCHI_R0 * (0.34 + 0.66 * Math.pow(grow, 0.6));
  mochi.cohesion = 0;
  // 杵は待機位置へ
  S.kineY = mix(S.kineY, 0.74, 1 - Math.exp(-dt * 2.2));
}

function updatePound(dt) {
  const target = mix(0.158, REST_H, S.cohesion);
  mochi.topY = mix(mochi.topY, target, 1 - Math.exp(-dt * 5));
  mochi.visualR0 = mix(mochi.visualR0, MOCHI_R0 * (0.95 + 0.09 * S.cohesion), 1 - Math.exp(-dt * 5));
  mochi.cohesion = mix(mochi.cohesion, S.cohesion, 1 - Math.exp(-dt * 4));
  usuSteam.rate = 14 * (1 - S.cohesion * 0.6);
  usuSteam.pos.set(0, USU_FLOOR + mochi.topY, 0);
  // 打つ位置を見せる
  if (!S.swing && !S.tegaeshi) {
    const p = project(V.set(0, USU_FLOOR + mochi.topY + 0.34, 0));
    ui.setHintPos(p.x, p.y);
  }
}

function updateStretch(dt) {
  // 杵は餅の頂点に貼り付いたまま
  if (S.grabbing) {
    mochi.topY = mix(mochi.topY, mochi.targetTopY, 1 - Math.exp(-dt * 16));
  } else {
    mochi.targetTopY = REST_H;
    mochi.topY = mix(mochi.topY, REST_H, 1 - Math.exp(-dt * 7));
  }
  S.kineY = USU_FLOOR + mochi.topY - 0.024 * clamp(mochi.stretch * 2.5, 0, 1);
  S.kineTilt = mix(S.kineTilt, 0, 1 - Math.exp(-dt * 6));
  mochi.cohesion = mix(mochi.cohesion, 1, 1 - Math.exp(-dt * 2));
  const st = mochi.stretch;
  usuSteam.pos.set(0, USU_FLOOR + 0.06, 0);
  // カメラは伸びの中ほどを見続ける
  rig.tLook.y = 0.50 + mochi.topY * 0.66;
  rig.tPos.y = 1.02 + mochi.topY * 0.50;
  rig.tPos.x = 0.72 + mochi.topY * 0.44;
  rig.tPos.z = 0.98 + mochi.topY * 0.66;
  S.pullSpeed = mix(S.pullSpeed || 0, 0, 1 - Math.exp(-dt * 7));
  if (S.grabbing) sound.stretchUpdate(clamp(st, 0, 1), Math.abs(S.pullSpeed) + 0.12);
  const p = project(V.set(0, USU_FLOOR + mochi.topY + 0.16, 0));
  if (!S.grabbing) ui.setHintPos(p.x, p.y);
}

function beginGrab() {
  S.grabbing = true;
  S.grabTop0 = mochi.topY;
  S.grabY0 = pointer.y;
  sound.stretchStart();
  ui.hideHint();
}
function endGrab() {
  if (!S.grabbing) return;
  S.grabbing = false;
  const st = mochi.stretch;
  sound.stretchEnd(true);
  if (st > 0.30) {
    S.pulls++;
    ui.setStep(S.pulls);
    mochi.newShape(0.4 + st * 1.1);
    mochi.swayX.kick((Math.random() - 0.5) * 5);
    mochi.squash.kick(-4 - st * 5);
    V.set(0, USU_FLOOR + 0.06, 0);
    flour.burst(V, 14, 0.7);
    if (st > 0.72) {
      sparkle.burst(new THREE.Vector3(0, USU_FLOOR + 0.35, 0), 16);
      sound.blip(784, 0.09, 0.5);
    }
    if (S.pulls >= PULLS_TOTAL) {
      setTimeout(() => { if (S.phase === PHASE.STRETCH) startCarry(); }, 900);
    } else {
      setTimeout(() => { if (S.phase === PHASE.STRETCH && !S.grabbing) ui.showHint('up'); }, 700);
    }
  } else {
    setTimeout(() => { if (S.phase === PHASE.STRETCH && !S.grabbing) ui.showHint('up'); }, 400);
  }
}

function startCarry() {
  setPhase(PHASE.CARRY);
  S.carry = { t: 0 };
  sound.blip(659, 0.10, 0.45);
}
function updateCarry(dt) {
  const c = S.carry; if (!c) return;
  c.t += dt;
  const T = 2.4;
  const u = clamp(c.t / T, 0, 1);
  // 餅を持ち上げて板へ運ぶ
  const from = new THREE.Vector3(0, USU_FLOOR + 0.05, 0);
  const to = boardPos(0, 0.055, 0);
  if (u < 0.18) {
    mochi.topY = mix(REST_H, REST_H * 0.7, u / 0.18);
    aimArm(armL, -0.15, USU_FLOOR + 0.06, -0.10, D(0.85, 0.30, 0.42), D(0, 1, 0));
    aimArm(armR, 0.15, USU_FLOOR + 0.06, -0.10, D(-0.85, 0.30, 0.42), D(0, 1, 0));
  } else {
    if (mochi.mesh.visible) {
      mochi.mesh.visible = false;
      for (let i = 0; i < grains.count; i++) if (grains.g[i].state !== GS.GONE) grains.g[i].state = GS.GONE;
      grains.sync();
      pieces.forEach((p, i) => { p.mesh.visible = true; p.roundness = 0.15; });
    }
    const k = ease.inOut(clamp((u - 0.18) / 0.66, 0, 1));
    const pos = new THREE.Vector3().lerpVectors(from, to, k);
    pos.y += Math.sin(k * Math.PI) * 0.30;
    aimArm(armL, pos.x - 0.16, pos.y - 0.02, pos.z - 0.06, D(0.85, 0.34, 0.36), D(0, 1, 0));
    aimArm(armR, pos.x + 0.16, pos.y - 0.02, pos.z - 0.06, D(-0.85, 0.34, 0.36), D(0, 1, 0));
    layoutLog(pos, 0, k);
    if (u > 0.86) hideArms();
  }
  if (u >= 1) { S.carry = null; setPhase(PHASE.CUT); }
}

/* 4つの塊を一本の棒状に並べる */
function layoutLog(center, spread, flatten = 1) {
  const gap = 0.062 + spread;
  for (let i = 0; i < PIECES; i++) {
    const p = pieces[i];
    const lx = (i - (PIECES - 1) / 2) * gap;
    const extra = S.cutSpread ? S.cutSpread[i] : 0;
    const c = Math.cos(BOARD_ROT), s = Math.sin(BOARD_ROT);
    p.mesh.position.set(center.x + (lx + extra) * c, center.y, center.z - (lx + extra) * s);
    p.flat = flatten * 0.8;
  }
}

function updateCut(dt) {
  const base = boardPos(0, 0.055, 0);
  layoutLog(base, 0, 1);
  // 切り離しの糸
  for (let i = 0; i < strings.length; i++) {
    const st = strings[i];
    if (st.prog !== undefined && st.prog < 1) {
      st.prog += dt / 0.34;
      const a = pieces[i].mesh.position.clone();
      const b = pieces[i + 1].mesh.position.clone();
      const mid = a.clone().lerp(b, 0.5);
      mid.y -= 0.012 * (1 - st.prog);
      st.set(a.lerp(mid, 0.28), b.lerp(mid, 0.28), 0.030 * (1 - st.prog * 0.4), st.prog);
      if (st.prog >= 1) { st.hide(); }
    }
  }
  if (S.cutSpread) {
    for (let i = 0; i < PIECES; i++) {
      S.cutSpread[i] = mix(S.cutSpread[i], S.cutTarget[i], 1 - Math.exp(-dt * 7));
    }
  }
  if (S.cuts < PIECES - 1) {
    const i = S.cuts;
    const a = pieces[i].mesh.position, b = pieces[i + 1].mesh.position;
    const p = project(V.copy(a).lerp(b, 0.5).setY(a.y + 0.10));
    ui.setHintPos(p.x, p.y);
  }
}
function doCut() {
  if (S.cuts >= PIECES - 1) return;
  const i = S.cuts;
  if (!S.cutSpread) { S.cutSpread = new Array(PIECES).fill(0); S.cutTarget = new Array(PIECES).fill(0); }
  for (let k = 0; k <= i; k++) S.cutTarget[k] -= 0.026;
  for (let k = i + 1; k < PIECES; k++) S.cutTarget[k] += 0.026;
  strings[i].prog = 0.001;
  pieces[i].squash.kick(-4); pieces[i + 1].squash.kick(-4);
  sound.cut();
  flour.burst(pieces[i].mesh.position.clone().lerp(pieces[i + 1].mesh.position, 0.5), 10, 0.5);
  S.cuts++;
  ui.setStep(S.cuts);
  if (S.cuts >= PIECES - 1) {
    ui.hideHint();
    setTimeout(() => { if (S.phase === PHASE.CUT) setPhase(PHASE.ROLL); }, 800);
  }
}

function updateRoll(dt) {
  const idx = S.rollIdx;
  const base = boardPos(0, 0.055, 0);
  // 済んだ餅は板の奥へ並べる
  for (let i = 0; i < PIECES; i++) {
    const p = pieces[i];
    if (i < idx) {
      const t = boardPos(-0.165 + i * 0.11, 0.052, -0.175);
      p.mesh.position.lerp(t, 1 - Math.exp(-dt * 6));
      p.flat = mix(p.flat, 0.55, 1 - Math.exp(-dt * 5));
    } else if (i === idx) {
      const t = boardPos(0, 0.058, 0.045);
      p.mesh.position.lerp(t, 1 - Math.exp(-dt * 7));
      p.flat = mix(p.flat, 0.25, 1 - Math.exp(-dt * 5));
      p.mesh.rotation.y += S.rollSpin * dt;
      p.mesh.rotation.x += S.rollSpin * 0.5 * dt;
      S.rollSpin *= Math.exp(-dt * 2.5);
    } else {
      const t = boardPos(-0.12 + (i - idx) * 0.12, 0.052, 0.20);
      p.mesh.position.lerp(t, 1 - Math.exp(-dt * 5));
    }
  }
  // 手を添える
  if (idx < PIECES) {
    const p = pieces[idx];
    const wob = Math.sin(S.t * 9) * 0.006 * (S.rolling ? 1 : 0.25);
    const rr = p.r + 0.024;
    const px = p.mesh.position.x, py = p.mesh.position.y, pz = p.mesh.position.z;
    armL.visible = armR.visible = false;
    aimArm(myL, px - rr - 0.014 + wob, py + 0.052, pz + 0.046, D(0.44, -0.70, -0.56), D(-0.42, 0.60, -0.68));
    aimArm(myR, px + rr + 0.014 - wob, py + 0.052, pz + 0.046, D(-0.44, -0.70, -0.56), D(0.42, 0.60, -0.68));
    const sp = project(V.copy(p.mesh.position).setY(p.mesh.position.y + 0.12));
    if (!S.rolling) ui.setHintPos(sp.x, sp.y);
  } else hideArms();
}
function addRoll(amount) {
  const idx = S.rollIdx;
  if (idx >= PIECES) return;
  const p = pieces[idx];
  p.roundness = clamp(p.roundness + amount / 420, 0, 1);
  S.rollSpin = clamp(S.rollSpin + amount * 0.03, 0, 9);
  sound.rollUpdate(clamp(amount * 0.4, 0, 1));
  if (p.roundness >= 1 && !p.done) {
    p.done = true;
    p.squash.kick(-5);
    sound.blip(880 - idx * 60, 0.13, 0.45);
    flour.burst(p.mesh.position.clone(), 12, 0.5);
    sparkle.burst(p.mesh.position.clone().setY(p.mesh.position.y + 0.05), 12);
    S.rollIdx++;
    ui.setStep(S.rollIdx);
    if (S.rollIdx >= PIECES) {
      ui.hideHint();
      sound.rollEnd();
      setTimeout(() => { if (S.phase === PHASE.ROLL) startFinale(); }, 900);
    }
  }
}

function startFinale() {
  setPhase(PHASE.FINALE);
  S.finale = { t: 0 };
  hideArms();
  sound.chime();
}
function updateFinale(dt) {
  const f = S.finale; if (!f) return;
  f.t += dt;
  const sp = world.sanpo.position;
  const targets = [
    new THREE.Vector3(sp.x, sp.y + 0.185, sp.z),
    new THREE.Vector3(sp.x, sp.y + 0.301, sp.z),
    boardPos(-0.05, 0.046, -0.15),
    boardPos(0.13, 0.046, -0.11),
  ];
  const rads = [0.086, 0.062, 0.050, 0.050];
  for (let i = 0; i < PIECES; i++) {
    const p = pieces[i];
    const d = clamp((f.t - 0.25 - i * 0.30) / 0.80, 0, 1);
    if (d <= 0) continue;
    p.mesh.position.lerp(targets[i], 1 - Math.exp(-dt * mix(4, 11, d)));
    p.r = mix(p.r, rads[i], 1 - Math.exp(-dt * 3.5));
    p.flat = mix(p.flat, i < 2 ? 0.95 : 0.62, 1 - Math.exp(-dt * 3.5));
    p.roundness = 1;
    if (d >= 1 && !p.landed) {
      p.landed = true; p.squash.kick(-6);
      sound.blip(523 + i * 90, 0.10, 0.6);
      sparkle.burst(p.mesh.position.clone(), 14);
      flour.burst(p.mesh.position.clone(), 8, 0.4);
    }
  }
  if (f.t > 1.9 && !daidai.visible) {
    daidai.visible = true;
    daidai.position.set(sp.x, sp.y + 0.399, sp.z);
    daidai.scale.setScalar(0.01);
    sparkle.burst(daidai.position.clone(), 34);
    sound.blip(1046, 0.11, 0.8);
  }
  if (daidai.visible) {
    const k = clamp((f.t - 1.9) / 0.75, 0, 1);
    daidai.scale.setScalar(ease.outElastic(k));
    daidai.rotation.y = Math.sin(f.t * 0.7) * 0.25;
  }
  // 寄り -> 引き
  if (f.t > 3.1 && !f.pulled) {
    f.pulled = true;
    rig.set(SHOTS.finale);
    sparkle.burst(new THREE.Vector3(sp.x, sp.y + 0.40, sp.z), 26);
  }
  if (f.pulled) {
    const a = (f.t - 3.1) * 0.11;
    rig.tPos.set(SHOTS.finale.pos[0] + Math.sin(a) * 0.30, SHOTS.finale.pos[1] + Math.sin(a * 0.7) * 0.05, SHOTS.finale.pos[2] + Math.cos(a) * 0.12);
  }
  if (f.t > 4.4 && !S.finaleDone) {
    S.finaleDone = true;
    ui.flash('rgba(255,244,220,0.30)', 700);
    ui.showBig(GLYPH.replay, () => { startGame(); });
  }
}

/* ---------- 入力 ---------- */
function onDown(e) {
  const r = renderer.domElement.getBoundingClientRect();
  pointer.down = true; pointer.used = false; pointer.moved = 0;
  pointer.sx = pointer.x = pointer.lx = e.clientX - r.left;
  pointer.sy = pointer.y = pointer.ly = e.clientY - r.top;
  pointer.t0 = S.t;
  sound.init();
  if (S.phase === PHASE.POUND) {
    if (S.hits < HITS_TOTAL) { ui.hideHint(); startSwing(false); }
  } else if (S.phase === PHASE.STRETCH) {
    if (S.pulls < PULLS_TOTAL) beginGrab();
  } else if (S.phase === PHASE.ROLL) {
    S.rolling = true; sound.rollStart(); ui.hideHint();
  }
}
function onMove(e) {
  if (!pointer.down) return;
  const r = renderer.domElement.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  const dx = x - pointer.lx, dy = y - pointer.ly;
  pointer.moved += Math.hypot(dx, dy);
  pointer.lx = x; pointer.ly = y;
  pointer.x = x; pointer.y = y;

  if (S.phase === PHASE.POUND) {
    if (S.swing && S.swing.stage === 'up' && dy > 6) S.swing.release = true;
  } else if (S.phase === PHASE.STRETCH && S.grabbing) {
    const h = window.innerHeight;
    const up = (S.grabY0 - y) / h;              // 上方向が正
    const t = clamp(S.grabTop0 + up * 1.30, REST_H, 0.66);
    S.pullSpeed = clamp((t - mochi.targetTopY) / 0.02, -3, 3);
    mochi.targetTopY = t;
  } else if (S.phase === PHASE.CUT) {
    if (!pointer.used && Math.abs(x - pointer.sx) > 42 && Math.abs(x - pointer.sx) > Math.abs(y - pointer.sy) * 0.6) {
      pointer.used = true; doCut();
    }
  } else if (S.phase === PHASE.ROLL) {
    addRoll(Math.hypot(dx, dy));
  }
}
function onUp() {
  if (!pointer.down) return;
  pointer.down = false;
  if (S.phase === PHASE.POUND && S.swing && S.swing.stage === 'up') S.swing.release = true;
  if (S.phase === PHASE.STRETCH) endGrab();
  if (S.phase === PHASE.ROLL) { S.rolling = false; sound.rollEnd(); }
  if (S.phase === PHASE.CUT && !pointer.used && pointer.moved < 20) doCut();
}
const cv = renderer.domElement;
cv.addEventListener('pointerdown', e => { cv.setPointerCapture?.(e.pointerId); onDown(e); });
cv.addEventListener('pointermove', onMove);
cv.addEventListener('pointerup', onUp);
cv.addEventListener('pointercancel', onUp);
window.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());

/* ---------- リサイズ ---------- */
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(FAST ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
resize();

/* ---------- ループ ---------- */
S.poured = 0;
S.rollSpin = 0;
const clock = new THREE.Clock();
let bootHidden = false;
let running = true;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    sound.stretchEnd(false); sound.rollEnd();
    if (sound.ctx && sound.ctx.state === 'running') sound.ctx.suspend();
  } else {
    clock.getDelta();
    if (sound.ctx && sound.ctx.state === 'suspended' && !sound.muted) sound.ctx.resume();
  }
});

function tickLogic(dt) {
  S.t += dt; S.pt += dt;
  switch (S.phase) {
    case PHASE.TITLE: {
      S.kineY = 0.74; S.kineUp = 0;
      const a = S.t * 0.10;
      rig.tPos.set(SHOTS.establish.pos[0] + Math.sin(a) * 0.30, SHOTS.establish.pos[1] + Math.sin(a * 0.7) * 0.05, SHOTS.establish.pos[2] + Math.cos(a) * 0.14);
      break;
    }
    case PHASE.POUR: updatePour(dt); break;
    case PHASE.POUND: updatePound(dt); updateKine(dt); updateTegaeshi(dt); break;
    case PHASE.STRETCH: updateStretch(dt); break;
    case PHASE.CARRY: updateCarry(dt); break;
    case PHASE.CUT: updateCut(dt); break;
    case PHASE.ROLL: updateRoll(dt); break;
    case PHASE.FINALE: updateFinale(dt); break;
  }
  const wantUp = (S.phase === PHASE.POUND || S.phase === PHASE.STRETCH) ? 1
    : (S.phase === PHASE.POUR ? clamp((S.pt - 3.25) / 1.1, 0, 1) : 0);
  S.kineUp = mix(S.kineUp, wantUp, 1 - Math.exp(-dt * (S.phase === PHASE.POUR ? 6 : 2.2)));
  applyKinePose(S.kineUp);
}

function tickVisual(dt) {
  mochi.update(dt);
  if (S.phase >= PHASE.POUR && S.phase <= PHASE.CARRY) updateGrains(dt);
  pieces.forEach(p => { if (p.mesh.visible) p.update(dt, S.t); });
  steam.update(dt);
  flour.update(dt);
  snowfall.update(dt);
  sparkle.update(dt);
  sound.setSteam(seiroSteam.rate / 40);

  const flick = 0.82 + Math.sin(S.t * 11.3) * 0.10 + Math.sin(S.t * 4.7) * 0.08;
  world.fire.intensity = 2.2 * flick;
  world.ember.material.emissiveIntensity = 2.0 + flick * 0.9;
  world.lamp.intensity = 5.0 * (0.985 + Math.sin(S.t * 2.7) * 0.015);
}

function frame() {
  requestAnimationFrame(frame);
  if (!running || document.hidden) { clock.getDelta(); return; }
  const raw = Math.min(clock.getDelta(), 0.05) * SPEED;
  let acc = raw;
  let guard = 0;
  while (acc > 1e-4 && guard++ < 24) { const d = Math.min(acc, 1 / 50); tickLogic(d); acc -= d; }
  tickVisual(raw);
  rig.update(raw, window.innerWidth / window.innerHeight);
  renderer.render(scene, camera);

  if (!bootHidden) {
    bootHidden = true;
    const b = document.getElementById('boot');
    setTimeout(() => { b.classList.add('gone'); setTimeout(() => b.remove(), 900); }, 260);
    setPhase(PHASE.TITLE);
    rig.set(SHOTS.establish, true);
  }
}
frame();

// デバッグ用フック (試遊時に使う)
window.__mochi = { ui, dbgTeg: () => { tegaeshiT = 0; S.tegaeshi = true; S.foldDone = false; },
  dbgTegAt: (u) => { S.tegaeshi = true; S.foldDone = true; tegaeshiT = u * 0.70; updateTegaeshi(0); tegaeshiT = -1; S.tegaeshi = false; }, armL, armR, updateTegaeshi, steam, flour, sparkle, snowfall, grains, kine, usu, S, PHASE, setPhase, mochi, rig, SHOTS, startGame, pieces, sound, scene, camera, renderer, world, doCut, addRoll, startSwing, beginGrab, endGrab, pointer };
