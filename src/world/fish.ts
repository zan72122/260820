import * as THREE from 'three';
import { clamp, makeRng } from '../util/math';

/**
 * ワカサギ。体長約8.5cmの実物らしい小ささを保つ。
 * クローム金属にせず、濡れた非金属表面として扱う：
 * ・暗い背、明るい体側、薄い腹を頂点カラーで
 * ・銀は曲率と視線角で現れる（clearcoat + 環境反射）
 * ・薄い鰭は半透明
 */

const LEN = 0.085;

function bodyProfile(t: number): { h: number; w: number; yOff: number } {
  // t: 0=尾 → 1=頭
  const bump = Math.sin(Math.PI * clamp(Math.pow(t, 0.8), 0, 1));
  const headTaper = t > 0.86 ? 1 - Math.pow((t - 0.86) / 0.14, 1.6) * 0.75 : 1;
  const h = 0.0075 * (0.22 + 0.78 * bump) * headTaper;
  const w = 0.0042 * (0.2 + 0.8 * bump) * headTaper;
  return { h, w, yOff: 0.0008 * Math.sin(Math.PI * t) };
}

const backColor = new THREE.Color(0x5a6354);
const sideColor = new THREE.Color(0xd6dee2);
const bellyColor = new THREE.Color(0xeef2ee);

export function makeWakasagiBodyGeometry(rings = 18, radial = 10): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const z = (t - 0.5) * LEN;
    const { h, w, yOff } = bodyProfile(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const y = Math.cos(a) * h + yOff;
      const x = Math.sin(a) * w;
      positions.push(x, y, z);
      const nl = Math.hypot(Math.sin(a) / Math.max(w, 1e-5), Math.cos(a) / Math.max(h, 1e-5));
      normals.push(Math.sin(a) / Math.max(w, 1e-5) / nl, Math.cos(a) / Math.max(h, 1e-5) / nl, 0);
      // 背は暗く、体側は明るい銀、腹は薄い
      const vy = Math.cos(a); // 1=背, -1=腹
      let col: THREE.Color;
      if (vy > 0.35) col = backColor.clone().lerp(sideColor, (1 - vy) * 0.9);
      else if (vy > -0.45) col = sideColor.clone();
      else col = sideColor.clone().lerp(bellyColor, (-vy - 0.45) / 0.55);
      // 体側中央をわずかに明るく（銀帯）
      if (Math.abs(vy) < 0.35) col.multiplyScalar(1.06);
      colors.push(col.r, col.g, col.b);
    }
  }
  const stride = radial + 1;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * stride + j;
      const b = a + stride;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  return geo;
}

function makeFinMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0xc9d4cf,
    roughness: 0.4,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false
  });
}

function makeTailFin(mat: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(-0.013, 0.006);
  shape.lineTo(-0.0105, 0.001);
  shape.lineTo(-0.013, -0.005);
  shape.lineTo(0, 0);
  const geo = new THREE.ShapeGeometry(shape);
  // shapeはXY面。-x方向に伸びる尾を -z方向（後方）の縦びれ（YZ面）へ回す
  geo.rotateY(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  return mesh;
}

export class Wakasagi {
  group = new THREE.Group();
  bodyMesh: THREE.Mesh;
  private basePos: Float32Array;
  private tailFin: THREE.Mesh;
  private phase = Math.random() * 10;
  /** 泳ぎの強さ */
  swimAmp = 1;
  swimSpeed = 5;

  constructor(bodyMat: THREE.Material) {
    const geo = makeWakasagiBodyGeometry();
    this.basePos = (geo.getAttribute('position') as THREE.BufferAttribute).array.slice() as Float32Array;
    this.bodyMesh = new THREE.Mesh(geo, bodyMat);
    this.bodyMesh.castShadow = true;
    this.group.add(this.bodyMesh);

    const finMat = makeFinMaterial();
    this.tailFin = makeTailFin(finMat);
    this.tailFin.position.set(0, 0, -LEN / 2 + 0.002);
    this.group.add(this.tailFin);

    // 背びれ・尻びれ・胸びれ
    const dorsal = new THREE.Mesh(new THREE.PlaneGeometry(0.011, 0.005), finMat);
    dorsal.rotation.y = Math.PI / 2;
    dorsal.position.set(0, 0.008, 0.002);
    dorsal.rotation.x = -0.5;
    this.group.add(dorsal);
    const anal = new THREE.Mesh(new THREE.PlaneGeometry(0.008, 0.004), finMat);
    anal.rotation.y = Math.PI / 2;
    anal.position.set(0, -0.006, -0.012);
    anal.rotation.x = 0.6;
    this.group.add(anal);
    for (const s of [-1, 1]) {
      const pec = new THREE.Mesh(new THREE.PlaneGeometry(0.007, 0.0035), finMat);
      pec.position.set(s * 0.004, -0.002, 0.024);
      pec.rotation.y = s * 0.9;
      pec.rotation.z = s * 0.4;
      this.group.add(pec);
    }
    // 眼
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0c1214, roughness: 0.15 });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0016, 8, 8), eyeMat);
      eye.position.set(s * 0.0032, 0.0012, 0.033);
      this.group.add(eye);
    }
  }

  /** 泳ぎの体の曲げ（CPUで頂点を曲げる。個体数が少ないので十分軽い） */
  updateSwim(dt: number, time: number) {
    this.phase += dt * this.swimSpeed;
    const attr = this.bodyMesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const amp = 0.0035 * this.swimAmp;
    for (let i = 0; i < arr.length; i += 3) {
      const z = this.basePos[i + 2];
      const tTail = clamp((0.02 - z) / (LEN * 0.9), 0, 1); // 尾ほど大きく
      arr[i] = this.basePos[i] + Math.sin(this.phase - z * 90) * amp * tTail * tTail;
      arr[i + 1] = this.basePos[i + 1];
      arr[i + 2] = this.basePos[i + 2];
    }
    attr.needsUpdate = true;
    this.tailFin.rotation.y = Math.sin(this.phase - 0.8) * 0.5 * this.swimAmp;
  }
}

export function makeWakasagiBodyMaterial(envMap: THREE.Texture | null): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.24,
    metalness: 0.0,
    clearcoat: 0.85,
    clearcoatRoughness: 0.18,
    envMapIntensity: 0.5
  });
  if (envMap) mat.envMap = envMap;
  return mat;
}

/**
 * 群れ。低詳細個体をinstancingし、ゆっくり回遊する。
 * 餌に反応する個体は別クラス（Wakasagi）で個別に動かす。
 */
export class FishSchool {
  mesh: THREE.InstancedMesh;
  private states: { center: THREE.Vector3; r: number; speed: number; phase: number; yPhase: number }[] = [];
  private dummy = new THREE.Object3D();

  constructor(count = 22, depthCenter = -2.3) {
    const rng = makeRng(77);
    const geo = makeWakasagiBodyGeometry(10, 6);
    // 群れは遠くの暗がりに沈む（明るすぎる白片に見せない）
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, color: 0x70858c });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < count; i++) {
      this.states.push({
        center: new THREE.Vector3((rng() - 0.5) * 1.6, depthCenter + (rng() - 0.5) * 0.9, (rng() - 0.5) * 1.6),
        r: 0.14 + rng() * 0.5,
        speed: 0.25 + rng() * 0.55,
        phase: rng() * Math.PI * 2,
        yPhase: rng() * Math.PI * 2
      });
    }
  }

  setDepth(depthCenter: number) {
    const rng = makeRng(78);
    for (const s of this.states) s.center.y = depthCenter + (rng() - 0.5) * 0.9;
  }

  update(time: number) {
    for (let i = 0; i < this.states.length; i++) {
      const s = this.states[i];
      const a = s.phase + time * s.speed;
      const x = s.center.x + Math.cos(a) * s.r;
      const z = s.center.z + Math.sin(a) * s.r;
      const y = s.center.y + Math.sin(time * 0.4 + s.yPhase) * 0.1;
      this.dummy.position.set(x, y, z);
      // 進行方向を向く（円周の接線）
      this.dummy.rotation.set(0, Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI / 2, 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
