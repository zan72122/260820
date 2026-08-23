// Instanced grass and flowers. Each instance carries its own dryness,
// height, and tilt so nothing lines up in rows. Recovery is local:
// blades and flowers read the wet mask under their own roots.

import * as THREE from 'three';
import { mulberry32, fbm2, clamp } from './util';
import { terrainHeight, streamZ, WET_REGION, WetMask } from './world';

const GRASS_VERT = /* glsl */ `
  attribute vec3 iPos;
  attribute vec4 iParam; // scale, yaw, dryness, phase
  varying float vDry;
  varying float vH;
  varying float vWet;
  uniform float time;
  uniform float windAmp;
  uniform sampler2D wetMask;
  uniform vec4 wetRegion;
  void main() {
    float scale = iParam.x; float yaw = iParam.y;
    vDry = iParam.z; float phase = iParam.w;
    vec2 wuv = vec2((iPos.x - wetRegion.x) * wetRegion.z,
                    (iPos.z - wetRegion.y) * wetRegion.w);
    float wet = 0.0;
    if (wuv.x > 0.0 && wuv.x < 1.0 && wuv.y > 0.0 && wuv.y < 1.0)
      wet = texture2D(wetMask, wuv).r;
    vWet = clamp(wet * 1.6, 0.0, 1.0);

    float c = cos(yaw), s = sin(yaw);
    vec3 p = position * scale;
    p = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
    float t = position.y; // 0 at root, 1 at tip (unit blade)
    vH = t;
    // droop: dry blades hang; wet ones stand up and grow a little
    float droop = vDry * (1.0 - vWet * 0.85);
    p.y *= scale * (0.72 + 0.28 * (1.0 - droop) + vWet * 0.15) / max(scale, 0.001);
    p.xz += vec2(c, s) * droop * t * t * 0.45 * scale;
    // wind sway, stronger at tips, per-blade phase
    float sway = sin(time * 1.7 + phase * 6.283 + iPos.x * 0.4) * windAmp;
    p.x += sway * t * t * 0.22;
    p.z += sway * t * t * 0.08;
    vec3 world = iPos + p;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const GRASS_FRAG = /* glsl */ `
  precision highp float;
  varying float vDry;
  varying float vH;
  varying float vWet;
  uniform vec3 fogColor;
  uniform float sunUp;
  void main() {
    vec3 dry = vec3(0.60, 0.51, 0.28);
    vec3 live = vec3(0.33, 0.44, 0.20);
    vec3 fresh = vec3(0.30, 0.50, 0.22);
    vec3 col = mix(live, dry, vDry);
    col = mix(col, fresh, vWet * 0.8);
    col *= 0.62 + 0.38 * vH; // darker at root
    col *= 0.9 + sunUp * 0.25;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Vegetation {
  group = new THREE.Group();
  grassUniforms: Record<string, THREE.IUniform>;
  flowers: Flower[] = [];
  flowerMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private colorAttr: THREE.InstancedBufferAttribute;
  wokenCount = 0;

  constructor(wetMask: WetMask, quality: number, seed = 1234) {
    const rand = mulberry32(seed);

    // ---- grass blades ----
    const grassCount = quality > 0 ? 5200 : 2400;
    const blade = new THREE.BufferGeometry();
    // one tapered blade: 3 quads stacked (unit height)
    const bverts: number[] = [];
    const seg = 3;
    for (let i = 0; i < seg; i++) {
      const y0 = i / seg, y1 = (i + 1) / seg;
      const w0 = 0.045 * (1 - y0 * 0.8), w1 = 0.045 * (1 - y1 * 0.8);
      bverts.push(-w0, y0, 0, w0, y0, 0, -w1, y1, 0);
      bverts.push(w0, y0, 0, w1, y1, 0, -w1, y1, 0);
    }
    blade.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bverts), 3));

    const iPos = new Float32Array(grassCount * 3);
    const iParam = new Float32Array(grassCount * 4);
    let gi = 0;
    let guard = 0;
    while (gi < grassCount && guard++ < grassCount * 30) {
      const x = -46 + rand() * 92;
      const z = -30 + rand() * 58;
      const h = terrainHeight(x, z);
      if (h > 8.5) continue; // not on rock crest
      const cover = fbm2(x * 0.07 + 21, z * 0.07 + 13, 4);
      if (rand() > cover * 1.25) continue;
      const nearStream = Math.exp(-Math.pow(z - streamZ(x), 2) / 30);
      // dryness varies per patch AND per blade — only part of the grass is dry
      const dry = clamp(0.85 - nearStream * 0.55 - (rand() - 0.5) * 0.5, 0.05, 1);
      iPos[gi * 3] = x; iPos[gi * 3 + 1] = h; iPos[gi * 3 + 2] = z;
      iParam[gi * 4] = 0.5 + rand() * 0.75;         // scale
      iParam[gi * 4 + 1] = rand() * Math.PI * 2;    // yaw
      iParam[gi * 4 + 2] = dry;
      iParam[gi * 4 + 3] = rand();                  // phase
      gi++;
    }
    const grassGeo = new THREE.InstancedBufferGeometry();
    grassGeo.index = blade.index;
    grassGeo.attributes.position = blade.attributes.position;
    grassGeo.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos.slice(0, gi * 3), 3));
    grassGeo.setAttribute('iParam', new THREE.InstancedBufferAttribute(iParam.slice(0, gi * 4), 4));
    grassGeo.instanceCount = gi;

    this.grassUniforms = {
      time: { value: 0 },
      windAmp: { value: 1 },
      wetMask: { value: wetMask.tex },
      wetRegion: {
        value: new THREE.Vector4(
          WET_REGION.x0, WET_REGION.z0,
          1 / (WET_REGION.x1 - WET_REGION.x0), 1 / (WET_REGION.z1 - WET_REGION.z0)
        ),
      },
      fogColor: { value: new THREE.Color(0.47, 0.48, 0.51) },
      sunUp: { value: 0 },
    };
    const grassMat = new THREE.ShaderMaterial({
      vertexShader: GRASS_VERT,
      fragmentShader: GRASS_FRAG,
      uniforms: this.grassUniforms,
      side: THREE.DoubleSide,
    });
    const grassMesh = new THREE.Mesh(grassGeo, grassMat);
    grassMesh.frustumCulled = false;
    this.group.add(grassMesh);

    // ---- flowers (CPU-eased recovery so heads rise over ~2 s) ----
    const flowerCount = quality > 0 ? 110 : 70;
    const petalColors = [
      new THREE.Color(0.85, 0.8, 0.78),  // dusty white
      new THREE.Color(0.82, 0.6, 0.62),  // pale pink
      new THREE.Color(0.85, 0.75, 0.45), // pale yellow
      new THREE.Color(0.66, 0.6, 0.78),  // faded violet
    ];
    // head: small cone + disc built as one geometry
    const headGeo = new THREE.ConeGeometry(0.16, 0.1, 6);
    headGeo.rotateX(Math.PI);
    const stemGeo = new THREE.CylinderGeometry(0.02, 0.028, 1, 4);
    stemGeo.translate(0, 0.5, 0);
    // merge stem + head into one geometry (head sits at top, hinged in shader-free way)
    // Simpler: instance = full flower, we bake droop via per-instance matrix each frame.
    const merged = mergeFlower(stemGeo, headGeo);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.flowerMesh = new THREE.InstancedMesh(merged, mat, flowerCount);
    this.flowerMesh.frustumCulled = false;
    this.colorAttr = new THREE.InstancedBufferAttribute(new Float32Array(flowerCount * 3), 3);
    (this.flowerMesh as any).instanceColor = this.colorAttr;

    let fi = 0;
    // a waiting cluster right under the knot's drop zone — the first few
    // drops must land among plants that can visibly answer
    const clusterN = Math.min(26, flowerCount);
    for (; fi < clusterN; fi++) {
      const x = -5 + rand() * 12;
      const z = -22.5 + rand() * 5;
      const h = terrainHeight(x, z);
      const c = petalColors[Math.floor(rand() * petalColors.length)];
      this.flowers.push({
        pos: new THREE.Vector3(x, h, z),
        yaw: rand() * Math.PI * 2,
        scale: 0.8 + rand() * 0.5,
        droop: 0.85 + rand() * 0.12,
        recovery: 0, target: 0,
        color: c.clone(),
        phase: rand() * Math.PI * 2,
        woken: false,
      });
    }
    guard = 0;
    while (fi < flowerCount && guard++ < flowerCount * 60) {
      const x = -34 + rand() * 68;
      const z = -26 + rand() * 48;
      const h = terrainHeight(x, z);
      if (h > 7.5) continue;
      const cover = fbm2(x * 0.09 + 40, z * 0.09 + 2, 3);
      if (rand() > cover * 1.15 + 0.12) continue;
      const c = petalColors[Math.floor(rand() * petalColors.length)];
      this.flowers.push({
        pos: new THREE.Vector3(x, h, z),
        yaw: rand() * Math.PI * 2,
        scale: 0.75 + rand() * 0.6,
        droop: 0.85 + rand() * 0.12,
        recovery: 0,
        target: 0,
        color: c.clone(),
        phase: rand() * Math.PI * 2,
        woken: false,
      });
      fi++;
    }
    this.flowerMesh.count = this.flowers.length;
    this.group.add(this.flowerMesh);
    this.updateFlowerMatrices(0, 0, wetMask);
  }

  update(dt: number, time: number, wetMask: WetMask, windAmp: number, sunUp: number) {
    this.grassUniforms.time.value = time;
    this.grassUniforms.windAmp.value = windAmp;
    this.grassUniforms.sunUp.value = sunUp;
    this.updateFlowerMatrices(dt, time, wetMask, sunUp);
  }

  private updateFlowerMatrices(dt: number, time: number, wetMask: WetMask, sunUp = 0) {
    const d = this.dummy;
    for (let i = 0; i < this.flowers.length; i++) {
      const f = this.flowers[i];
      f.target = Math.max(f.target, clamp(wetMask.sample(f.pos.x, f.pos.z) * 2.2, 0, 1));
      if (f.target > 0.2 && !f.woken) { f.woken = true; this.wokenCount++; }
      // ease head up over ~2s once watered
      f.recovery += (f.target - f.recovery) * (1 - Math.exp(-1.6 * (dt || 0.016)));
      const droopNow = f.droop * (1 - f.recovery * 0.92);
      d.position.copy(f.pos);
      d.rotation.set(0, f.yaw, 0);
      // whole stem tips over when drooping; small sway when alive
      const sway = Math.sin(time * 1.3 + f.phase) * 0.05 * (0.3 + f.recovery);
      d.rotation.z = droopNow * 0.9 + sway;
      const s = f.scale * (0.85 + f.recovery * 0.25);
      d.scale.set(s, s, s);
      d.updateMatrix();
      this.flowerMesh.setMatrixAt(i, d.matrix);
      // color: muted while dry, saturated when awake
      const sat = 0.45 + f.recovery * 0.55 + sunUp * 0.1;
      this.colorAttr.setXYZ(
        i,
        lerpc(0.68, f.color.r * 1.15, sat),
        lerpc(0.66, f.color.g * 1.15, sat),
        lerpc(0.6, f.color.b * 1.15, sat)
      );
    }
    this.flowerMesh.instanceMatrix.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
  }
}

function lerpc(a: number, b: number, t: number) { return a + (b - a) * Math.min(1, t); }

interface Flower {
  pos: THREE.Vector3;
  yaw: number;
  scale: number;
  droop: number;
  recovery: number;
  target: number;
  color: THREE.Color;
  phase: number;
  woken: boolean;
}

function mergeFlower(stem: THREE.CylinderGeometry, head: THREE.ConeGeometry): THREE.BufferGeometry {
  // manual merge with vertex colors: stem greenish-gray, head takes instance color
  const g = new THREE.BufferGeometry();
  const sPos = stem.attributes.position, hPos = head.attributes.position;
  const sN = stem.attributes.normal, hN = head.attributes.normal;
  const total = sPos.count + hPos.count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  for (let i = 0; i < sPos.count; i++) {
    pos.set([sPos.getX(i), sPos.getY(i), sPos.getZ(i)], i * 3);
    nor.set([sN.getX(i), sN.getY(i), sN.getZ(i)], i * 3);
    col.set([0.45, 0.5, 0.38], i * 3);
  }
  for (let i = 0; i < hPos.count; i++) {
    const j = sPos.count + i;
    pos.set([hPos.getX(i), hPos.getY(i) + 1.02, hPos.getZ(i)], j * 3);
    nor.set([hN.getX(i), hN.getY(i), hN.getZ(i)], j * 3);
    col.set([1, 1, 1], j * 3); // multiplied by instance color
  }
  const idx: number[] = [];
  const sIdx = stem.index!, hIdx = head.index!;
  for (let i = 0; i < sIdx.count; i++) idx.push(sIdx.getX(i));
  for (let i = 0; i < hIdx.count; i++) idx.push(hIdx.getX(i) + sPos.count);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
