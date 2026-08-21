import * as THREE from 'three';
import { Engine } from './core/engine';
import { readFlags } from './util/flags';
import { mulberry32 } from './util/rng';
import { buildLane } from './scene/lane';
import { buildEnvironmentMap, buildLights } from './scene/lighting';
import { BALL_RADIUS, LANE_LENGTH, pinPositions } from './util/units';
import { buildBall } from './scene/ball';
import { buildPinAssets, makePinMesh } from './scene/pins';

const container = document.getElementById('app');
if (!container) throw new Error('#app not found');

const flags = readFlags();
const engine = new Engine(container, flags);

// 室内のごく薄い空気遠近（DoFボケは使わない）
engine.scene.fog = new THREE.FogExp2(0x0f0d0b, 0.02);
engine.scene.background = new THREE.Color(0x0f0d0b);

if (!flags.fast) {
  engine.scene.environment = buildEnvironmentMap(engine.renderer);
  engine.scene.environmentIntensity = 0.5;
}
buildLights(engine.scene, flags);

const rng = mulberry32(flags.seed);
const lane = buildLane(rng, flags.fast);
engine.scene.add(lane.group);

// ボール（構え位置）とピン10本
const ball = buildBall(rng, flags.fast);
ball.position.set(0.2, BALL_RADIUS, -3.2);
engine.scene.add(ball);

const pinAssets = buildPinAssets(rng, flags.fast);
for (const p of pinPositions()) {
  const pin = makePinMesh(pinAssets, rng, flags.fast);
  pin.position.set(p.x, 0, p.z);
  engine.scene.add(pin);
}

engine.camera.position.set(0.2, 1.6, -3.4);
engine.camera.lookAt(0, 0.25, LANE_LENGTH * 0.75);

// デバッグ: ?cam=x,y,z,tx,ty,tz で任意アングル確認（どの角度でも破綻しないことの検証用）
const camParam = new URLSearchParams(location.search).get('cam');
if (camParam) {
  const [x = 0, y = 1.6, z = -3, tx = 0, ty = 0.3, tz = 10] = camParam.split(',').map(Number);
  engine.camera.position.set(x, y, z);
  engine.camera.lookAt(tx, ty, tz);
}

engine.start();

declare global {
  interface Window {
    __game?: unknown;
  }
}
window.__game = { ready: true, flags };
