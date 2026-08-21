import * as THREE from 'three';
import { Engine } from './core/engine';
import { readFlags } from './util/flags';
import { mulberry32 } from './util/rng';
import { buildLane } from './scene/lane';
import { buildEnvironmentMap, buildLights } from './scene/lighting';
import { pinPositions } from './util/units';
import { buildBall } from './scene/ball';
import { buildPinAssets, makePinMesh } from './scene/pins';
import { buildCenterEnvironment } from './scene/environment';
import { PhysicsWorld, type ThrowParams } from './physics/world';
import { Game } from './game/game';
import { Hud } from './ui/hud';
import { SwingInput } from './input/swing';
import { CameraRig } from './scene/cameraRig';

async function boot(): Promise<void> {
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

  const ballMesh = buildBall(rng, flags.fast);
  engine.scene.add(ballMesh);

  const pinAssets = buildPinAssets(rng, flags.fast);
  const pinMeshes = pinPositions().map(() => {
    const pin = makePinMesh(pinAssets, rng, flags.fast);
    engine.scene.add(pin);
    return pin;
  });

  engine.scene.add(buildCenterEnvironment(rng, flags.fast, pinAssets));

  const physics = await PhysicsWorld.create();
  const hud = new Hud(document.body);
  const swing = new SwingInput(container);
  const rig = new CameraRig(engine.camera);
  const game = new Game({ physics, ballMesh, pinMeshes, hud, swing, rig });

  engine.onFixedStep = () => game.fixedStep();
  engine.onFrame = (dt) => game.frame(dt);

  // デバッグ: ?cam=x,y,z,tx,ty,tz で固定アングル確認（破綻チェック用）
  const camParam = new URLSearchParams(location.search).get('cam');
  if (camParam) {
    const [x = 0, y = 1.6, z = -3, tx = 0, ty = 0.3, tz = 10] = camParam.split(',').map(Number);
    rig.setStatic(new THREE.Vector3(x, y, z), new THREE.Vector3(tx, ty, tz));
    engine.onFrame = (dt) => {
      game.frame(dt);
      rig.setStatic(new THREE.Vector3(x, y, z), new THREE.Vector3(tx, ty, tz));
    };
  }

  engine.start();

  // E2E/デバッグ向け決定論API
  window.__game = {
    ready: true,
    flags,
    get state() {
      return game.state;
    },
    advance: (seconds: number) => engine.advance(seconds),
    debugThrow: (p: ThrowParams) => game.throw_(p),
    standingCount: () => physics.standingCount(),
    frames: () => game.score.frames(),
    total: () => game.score.total(),
    rolls: () => [...game.score.rolls],
    ballPose: () => physics.ballPose(),
  };
}

declare global {
  interface Window {
    __game?: {
      ready: boolean;
      flags: unknown;
      state: string;
      advance: (seconds: number) => void;
      debugThrow: (p: ThrowParams) => void;
      standingCount: () => number;
      frames: () => unknown;
      total: () => number | null;
      rolls: () => number[];
      ballPose: () => unknown;
    };
  }
}

void boot();
