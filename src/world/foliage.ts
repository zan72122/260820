import * as THREE from 'three';
import { clamp01, lerp, Rng, rrange } from '../core/util';
import { leafTextures } from '../gfx/textures';

export type LeafUniforms = {
  uTime: THREE.IUniform<number>;
  uWind: THREE.IUniform<number>;
  uSunViewDir: THREE.IUniform<THREE.Vector3>;
  uTrans: THREE.IUniform<number>;
};

/**
 * Sweet-potato foliage is cordate on some vines and palmately lobed on
 * others; both shapes appear on one plot, which is why two outlines exist.
 */
export function makeLeafGeometry(kind: 'heart' | 'lobed', rng: Rng) {
  const s = new THREE.Shape();
  const w = rrange(rng, 0.86, 1.14);
  if (kind === 'heart') {
    s.moveTo(0, -0.06);
    s.bezierCurveTo(0.30 * w, -0.30, 0.62 * w, -0.16, 0.66 * w, 0.16);
    s.bezierCurveTo(0.70 * w, 0.56, 0.34 * w, 0.80, 0.03 * w, 1.0);
    s.bezierCurveTo(-0.30 * w, 0.80, -0.70 * w, 0.56, -0.66 * w, 0.16);
    s.bezierCurveTo(-0.62 * w, -0.16, -0.30 * w, -0.30, 0, -0.06);
  } else {
    s.moveTo(0, -0.05);
    s.bezierCurveTo(0.34 * w, -0.26, 0.60 * w, -0.06, 0.52 * w, 0.22);
    s.bezierCurveTo(0.48 * w, 0.34, 0.30 * w, 0.30, 0.30 * w, 0.42);
    s.bezierCurveTo(0.30 * w, 0.58, 0.52 * w, 0.60, 0.40 * w, 0.78);
    s.bezierCurveTo(0.30 * w, 0.92, 0.12 * w, 0.86, 0.02 * w, 1.02);
    s.bezierCurveTo(-0.12 * w, 0.86, -0.30 * w, 0.92, -0.40 * w, 0.78);
    s.bezierCurveTo(-0.52 * w, 0.60, -0.30 * w, 0.58, -0.30 * w, 0.42);
    s.bezierCurveTo(-0.30 * w, 0.30, -0.48 * w, 0.34, -0.52 * w, 0.22);
    s.bezierCurveTo(-0.60 * w, -0.06, -0.34 * w, -0.26, 0, -0.05);
  }
  const g = new THREE.ShapeGeometry(s, 5);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  const curl = rrange(rng, 0.14, 0.30);
  const twist = rrange(rng, -0.09, 0.09);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // blades cup along the midrib and droop toward the tip
    const z = -curl * x * x * 2.2 + twist * x * y - clamp01(y) * clamp01(y) * 0.20 + Math.sin(y * 4.2) * 0.02;
    pos.setZ(i, z);
    uv[i * 2] = x * 0.5 + 0.5;
    uv[i * 2 + 1] = 1 - clamp01(y * 0.92 + 0.08);
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  // white base colour so per-instance tint has something to multiply
  const white = new Float32Array(pos.count * 3).fill(1);
  g.setAttribute('color', new THREE.BufferAttribute(white, 3));
  g.computeVertexNormals();
  return g;
}

export function makeLeafMaterial(): { material: THREE.MeshStandardMaterial; uniforms: LeafUniforms } {
  const tex = leafTextures();
  const material = new THREE.MeshStandardMaterial({
    map: tex.map,
    alphaMap: tex.alphaMap,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    roughness: 0.78,
    metalness: 0,
    color: 0xffffff,
    vertexColors: true,
  });
  const uniforms: LeafUniforms = {
    uTime: { value: 0 },
    uWind: { value: 1 },
    uSunViewDir: { value: new THREE.Vector3(0, 1, 0) },
    uTrans: { value: 0.34 },
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         uniform float uWind;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         #ifdef USE_INSTANCING
           float ph = instanceMatrix[3][0] * 3.1 + instanceMatrix[3][2] * 2.3;
         #else
           float ph = 0.0;
         #endif
         float bend = clamp(transformed.y, 0.0, 1.4);
         bend = bend * bend;
         float gust = sin(uTime * 1.9 + ph) * 0.6 + sin(uTime * 0.83 + ph * 1.7) * 0.4;
         transformed.x += gust * bend * 0.075 * uWind;
         transformed.z += cos(uTime * 1.35 + ph * 0.8) * bend * 0.055 * uWind;
         transformed.y -= abs(gust) * bend * 0.016 * uWind;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uSunViewDir;
         uniform float uTrans;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         // light bleeding through a thin blade when the sun is behind it
         vec3 vDir = normalize(vViewPosition);
         float back = pow(clamp(-dot(vDir, uSunViewDir), 0.0, 1.0), 3.0);
         gl_FragColor.rgb += diffuseColor.rgb * vec3(1.05, 1.0, 0.55) * back * uTrans;`,
      );
  };
  material.customProgramCacheKey = () => 'leaf-wind-trans';
  return { material, uniforms };
}

export type LeafPlacement = {
  pos: THREE.Vector3;
  /** Direction the blade points (its local +Y). */
  dir: THREE.Vector3;
  scale: number;
  tint: THREE.Color;
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _yAxis = new THREE.Vector3(0, 1, 0);

/** One InstancedMesh per plant so a single plant can gust on its own. */
export class LeafClump {
  readonly group = new THREE.Group();
  readonly meshes: THREE.InstancedMesh[] = [];
  readonly petioles: THREE.InstancedMesh;
  readonly uniforms: LeafUniforms;
  private material: THREE.MeshStandardMaterial;
  private buckets: LeafPlacement[][] = [];
  private rolls: number[][] = [];
  private open = -1;
  private openCentre = new THREE.Vector3();

  constructor(placements: LeafPlacement[], rng: Rng, variants = 3) {
    const { material, uniforms } = makeLeafMaterial();
    this.material = material;
    this.uniforms = uniforms;

    const geos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < variants; i++) {
      geos.push(makeLeafGeometry(rng() > 0.45 ? 'heart' : 'lobed', rng));
    }
    const buckets: LeafPlacement[][] = geos.map(() => []);
    placements.forEach((p, i) => buckets[i % geos.length].push(p));
    this.buckets = buckets;

    buckets.forEach((bucket, gi) => {
      if (!bucket.length) return;
      const im = new THREE.InstancedMesh(geos[gi], material, bucket.length);
      im.castShadow = true;
      im.receiveShadow = true;
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(bucket.length * 3), 3);
      const rolls: number[] = [];
      bucket.forEach((p, i) => {
        const roll = rrange(rng, -0.9, 0.9);
        rolls.push(roll);
        _q.setFromUnitVectors(_yAxis, p.dir.clone().normalize());
        _q.premultiply(new THREE.Quaternion().setFromAxisAngle(p.dir.clone().normalize(), roll));
        _s.setScalar(p.scale);
        _m.compose(p.pos, _q, _s);
        im.setMatrixAt(i, _m);
        im.setColorAt(i, p.tint);
      });
      this.rolls[gi] = rolls;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.frustumCulled = false;
      this.meshes.push(im);
      this.group.add(im);
    });

    // petioles: thin stalks so blades never float free of the vine
    const pg = new THREE.CylinderGeometry(0.0035, 0.0055, 1, 5, 1, true);
    pg.translate(0, 0.5, 0);
    const pm = new THREE.MeshStandardMaterial({ color: 0x6f7a3c, roughness: 0.9, metalness: 0 });
    this.petioles = new THREE.InstancedMesh(pg, pm, placements.length);
    placements.forEach((p, i) => {
      const dir = p.dir.clone().normalize();
      _q.setFromUnitVectors(_yAxis, dir);
      _s.set(1, p.scale * rrange(rng, 0.28, 0.5), 1);
      _m.compose(p.pos.clone().addScaledVector(dir, -p.scale * 0.02), _q, _s);
      this.petioles.setMatrixAt(i, _m);
    });
    this.petioles.instanceMatrix.needsUpdate = true;
    this.petioles.castShadow = true;
    this.petioles.frustumCulled = false;
    this.group.add(this.petioles);
  }

  setWind(v: number) {
    this.uniforms.uWind.value = v;
  }

  /**
   * Sweep the canopy aside so the crown of the hill becomes visible — what
   * a grower does by hand before putting a fork anywhere near the plant.
   */
  setOpen(amount: number, centre: THREE.Vector3) {
    const a = Math.max(0, Math.min(1, amount));
    if (Math.abs(a - this.open) < 0.004 && this.openCentre.equals(centre)) return;
    this.open = a;
    this.openCentre.copy(centre);
    const push = new THREE.Vector3();
    const pos = new THREE.Vector3();
    this.meshes.forEach((im, gi) => {
      const bucket = this.buckets[gi];
      const rolls = this.rolls[gi];
      bucket.forEach((p, i) => {
        push.set(p.pos.x - centre.x, 0, p.pos.z - centre.z);
        const d = push.length();
        const near = 1 - Math.min(1, d / 0.42);
        push.normalize().multiplyScalar(a * near * 0.26);
        pos.copy(p.pos).add(push);
        pos.y -= a * near * 0.035;
        const dir = p.dir.clone().lerp(push.clone().normalize().setY(0.28).normalize(), a * near * 0.85).normalize();
        _q.setFromUnitVectors(_yAxis, dir);
        _q.premultiply(new THREE.Quaternion().setFromAxisAngle(dir, rolls[i]));
        _s.setScalar(p.scale * (1 - a * near * 0.18));
        _m.compose(pos, _q, _s);
        im.setMatrixAt(i, _m);
        // the stalk goes where its blade goes
        const orig = i * this.meshes.length + gi;
        if (orig < this.petioles.count) {
          _q.setFromUnitVectors(_yAxis, dir);
          _s.set(1, p.scale * 0.38, 1);
          _m.compose(pos.clone().addScaledVector(dir, -p.scale * 0.02), _q, _s);
          this.petioles.setMatrixAt(orig, _m);
        }
      });
      im.instanceMatrix.needsUpdate = true;
    });
    this.petioles.instanceMatrix.needsUpdate = true;
  }

  update(time: number, sunViewDir: THREE.Vector3) {
    this.uniforms.uTime.value = time;
    this.uniforms.uSunViewDir.value.copy(sunViewDir);
  }

  dispose() {
    this.material.dispose();
    for (const m of this.meshes) m.geometry.dispose();
  }
}

/** Autumn tint spread: mostly green, some going yellow at the margins. */
export function leafTint(rng: Rng) {
  const yellow = Math.pow(rng(), 1.7);
  return new THREE.Color().setRGB(
    lerp(0.62, 1.15, yellow),
    lerp(0.86, 1.0, yellow * 0.6),
    lerp(0.58, 0.42, yellow),
  );
}
