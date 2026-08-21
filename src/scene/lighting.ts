import * as THREE from 'three';
import { LANE_LENGTH } from '../util/units';
import type { Flags } from '../util/flags';

/**
 * 反射用環境マップ: ボウリング場の天井照明列を模した簡易シーンをPMREM化。
 * オイルの効いたレーンに天井灯が縦長に映り込む「あの見た目」の源。
 */
export function buildEnvironmentMap(renderer: THREE.WebGLRenderer): THREE.Texture {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050505);

  const warm = new THREE.MeshBasicMaterial({ color: 0xffd9a6 });
  // 天井の照明列（レーン方向に並ぶ細長い灯具）
  for (let row = -1; row <= 1; row++) {
    for (let i = 0; i < 6; i++) {
      const lamp = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 2.2), warm);
      lamp.position.set(row * 3.4, 3.4, -3 + i * 4.2);
      lamp.rotateX(Math.PI / 2);
      scene.add(lamp);
    }
  }
  // 奥のピンデッキ照明のクールな帯
  const cool = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 0.9),
    new THREE.MeshBasicMaterial({ color: 0x9fb6cc }),
  );
  cool.position.set(0, 0.8, 21);
  cool.rotateY(Math.PI);
  scene.add(cool);
  // 床からのわずかな暖色バウンス
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 60),
    new THREE.MeshBasicMaterial({ color: 0x241a10 }),
  );
  floor.rotateX(-Math.PI / 2);
  floor.position.y = -0.02;
  scene.add(floor);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(scene, 0.04).texture;
  pmrem.dispose();
  return tex;
}

export interface Lights {
  keyLight: THREE.SpotLight;
  pinLight: THREE.SpotLight;
}

export function buildLights(scene: THREE.Scene, flags: Flags): Lights {
  // ベース環境光（暗い室内の底上げ、ごく控えめ）
  const hemi = new THREE.HemisphereLight(0x4a4238, 0x181209, 0.55);
  scene.add(hemi);

  // アプローチ上のダウンライト（プレイヤー付近のキー。影を落とす）
  const key = new THREE.SpotLight(0xffe2b8, 60, 0, 0.95, 0.55, 2);
  key.position.set(0.4, 3.3, -1.6);
  key.target.position.set(0, 0, 1.5);
  key.castShadow = !flags.fast;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 12;
  key.shadow.bias = -0.0004;
  scene.add(key, key.target);

  // レーン中盤の灯り（影なし・減衰で奥は暗く）
  for (const [z, i] of [
    [4.5, 30],
    [9.5, 22],
  ] as const) {
    const s = new THREE.SpotLight(0xffdfae, i, 0, 1.0, 0.7, 2);
    s.position.set(-0.3, 3.5, z);
    s.target.position.set(0, 0, z + 1.5);
    scene.add(s, s.target);
  }

  // ピンデッキ照明（マスキング内から下向き。ピンを最も明るく）
  const pin = new THREE.SpotLight(0xf2ecdd, 26, 0, 0.62, 0.45, 2);
  pin.position.set(0, 1.55, LANE_LENGTH - 1.35);
  pin.target.position.set(0, 0.15, LANE_LENGTH + 0.25);
  pin.castShadow = !flags.fast;
  pin.shadow.mapSize.set(1024, 1024);
  pin.shadow.camera.near = 0.4;
  pin.shadow.camera.far = 4.5;
  pin.shadow.bias = -0.0004;
  scene.add(pin, pin.target);

  return { keyLight: key, pinLight: pin };
}
