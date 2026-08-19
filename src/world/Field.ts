import * as THREE from 'three';
import { riceAtlas } from './textures';
import { COLS, HILL_DX, HILL_DZ, ROWS } from '../game/constants';

/* ------------------------------------------------------------------ *
 * The rice.
 *
 * Every hill (株) is one instance of a small bundle of blades and
 * drooping panicles.  A vertex-shader hook does two jobs: it breathes
 * wind through the whole crop, and it drags the hills nearest the
 * header mouth toward it so the crop visibly *leans in* a moment before
 * it is swallowed.  Cutting a hill hides the instance, drops a tuft of
 * stubble in its place, and hands a copy to the ingest flight.
 * ------------------------------------------------------------------ */

const UV_PANICLE = { u0: 0.045, u1: 0.455 };
const UV_LEAF = { u0: 0.60, u1: 0.90 };

/** One curved, tapering ribbon of geometry. */
function pushRibbon(
  pos: number[], uv: number[], hgt: number[], idx: number[],
  base: THREE.Vector3, ctrl: THREE.Vector3, tip: THREE.Vector3,
  widthBase: number, widthTip: number,
  uRange: { u0: number; u1: number },
  segments: number
) {
  const start = pos.length / 3;
  const p = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  // ribbon runs radially outward; widen across the perpendicular
  const radial = new THREE.Vector3(tip.x - base.x, 0, tip.z - base.z);
  if (radial.lengthSq() < 1e-6) radial.set(1, 0, 0);
  radial.normalize();
  const side = new THREE.Vector3(-radial.z, 0, radial.x);

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    p.set(
      mt * mt * base.x + 2 * mt * t * ctrl.x + t * t * tip.x,
      mt * mt * base.y + 2 * mt * t * ctrl.y + t * t * tip.y,
      mt * mt * base.z + 2 * mt * t * ctrl.z + t * t * tip.z
    );
    const w = (widthBase + (widthTip - widthBase) * t) * 0.5;
    a.copy(p).addScaledVector(side, -w);
    b.copy(p).addScaledVector(side, w);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    uv.push(uRange.u0, t, uRange.u1, t);
    hgt.push(t, t);
  }
  for (let i = 0; i < segments; i++) {
    const o = start + i * 2;
    idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
  }
}

/** A whole hill of ripe rice: leaf blades plus heavy, nodding panicles. */
export function buildRiceHill(seed = 1): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const hgt: number[] = [];
  const idx: number[] = [];
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  const O = new THREE.Vector3();

  // 6 leaf blades fanning out and arching over
  const blades = 6;
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + rnd() * 0.6;
    const len = 0.56 + rnd() * 0.30;
    const reach = 0.30 + rnd() * 0.26;
    const base = O.clone().set(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04);
    const tip = new THREE.Vector3(Math.cos(a) * reach, len * 0.60, Math.sin(a) * reach);
    const ctrl = new THREE.Vector3(Math.cos(a) * reach * 0.26, len * 0.84, Math.sin(a) * reach * 0.26);
    pushRibbon(pos, uv, hgt, idx, base, ctrl, tip, 0.105, 0.025, UV_LEAF, 3);
  }

  // 6 panicles: up on a stiff culm, then bowed over by the weight of grain
  const ears = 6;
  for (let i = 0; i < ears; i++) {
    const a = (i / ears) * Math.PI * 2 + 0.7 + rnd() * 0.7;
    const h = 0.78 + rnd() * 0.24;
    const droop = 0.18 + rnd() * 0.18;
    const base = new THREE.Vector3(Math.cos(a) * 0.035, 0, Math.sin(a) * 0.035);
    const ctrl = new THREE.Vector3(Math.cos(a) * 0.06, h * 1.03, Math.sin(a) * 0.06);
    const tip = new THREE.Vector3(Math.cos(a) * droop * 2.0, h * 0.68, Math.sin(a) * droop * 2.0);
    pushRibbon(pos, uv, hgt, idx, base, ctrl, tip, 0.135, 0.075, UV_PANICLE, 3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aH', new THREE.Float32BufferAttribute(hgt, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // Foliage lit off its true normals goes black on the back faces; bias
  // everything skyward so the crop stays readable from any angle.
  const n = geo.attributes.normal as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < n.count; i++) {
    v.set(n.getX(i), n.getY(i), n.getZ(i)).multiplyScalar(0.4).add(new THREE.Vector3(0, 0.9, 0)).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeBoundingSphere();
  return geo;
}

/** What is left standing after the header has been through. */
function buildStubble(): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const hgt: number[] = [];
  const idx: number[] = [];
  let s = 7;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rnd() * 0.8;
    const r = 0.04 + rnd() * 0.11;
    const h = 0.10 + rnd() * 0.09;
    const base = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    const tip = new THREE.Vector3(Math.cos(a) * (r + 0.03), h, Math.sin(a) * (r + 0.03));
    const ctrl = new THREE.Vector3(Math.cos(a) * r, h * 0.6, Math.sin(a) * r);
    pushRibbon(pos, uv, hgt, idx, base, ctrl, tip, 0.045, 0.03, { u0: 0.66, u1: 0.84 }, 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aH', new THREE.Float32BufferAttribute(hgt, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

interface Flying {
  active: boolean;
  from: THREE.Vector3;
  ctrl: THREE.Vector3;
  t: number;
  dur: number;
  spin: number;
  scale: number;
}

export class Field {
  readonly group = new THREE.Group();

  readonly standing: THREE.InstancedMesh;
  readonly stubble: THREE.InstancedMesh;
  private ingest: THREE.InstancedMesh;

  /** per hill: alive flag */
  private alive: Uint8Array;
  private hillX: Float32Array;
  private hillZ: Float32Array;
  private hillRot: Float32Array;
  private hillScale: Float32Array;
  private stubbleCount = 0;

  private flights: Flying[] = [];
  private readonly MAX_FLIGHTS = 44;

  private uniforms = {
    uTime: { value: 0 },
    uWind: { value: 0.045 },
    uHeadPos: { value: new THREE.Vector3(0, 0, 9999) },
    uHeadR: { value: 2.6 },
  };

  /** world-space point the ingested hills fly into; the game keeps it current */
  readonly ingestTarget = new THREE.Vector3();

  /** hills left standing */
  remaining = 0;
  readonly total: number;

  constructor(scene: THREE.Scene, density: number) {
    scene.add(this.group);

    const atlas = riceAtlas();
    const cols = Math.max(6, Math.round(COLS * Math.sqrt(density)));
    const rows = Math.max(8, Math.round(ROWS * Math.sqrt(density)));
    const dx = (COLS * HILL_DX) / cols;
    const dz = (ROWS * HILL_DZ) / rows;
    const count = cols * rows;
    this.total = count;
    this.cols = cols;
    this.rows = rows;
    this.dx = dx;
    this.dz = dz;

    this.alive = new Uint8Array(count).fill(1);
    this.hillX = new Float32Array(count);
    this.hillZ = new Float32Array(count);
    this.hillRot = new Float32Array(count);
    this.hillScale = new Float32Array(count);
    this.remaining = count;

    const hillGeo = buildRiceHill(3);

    const mat = new THREE.MeshStandardMaterial({
      map: atlas,
      transparent: false,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      roughness: 0.86,
      metalness: 0,
      color: 0xffffff,
    });
    this.hookWind(mat);

    this.standing = new THREE.InstancedMesh(hillGeo, mat, count);
    this.standing.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.standing.frustumCulled = false;
    this.standing.receiveShadow = true;
    this.group.add(this.standing);

    // stubble reuses the atlas but never bends
    const stubMat = new THREE.MeshStandardMaterial({
      map: atlas,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      roughness: 0.95,
      color: 0xc8bd86,
    });
    this.stubble = new THREE.InstancedMesh(buildStubble(), stubMat, count);
    this.stubble.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.stubble.frustumCulled = false;
    this.stubble.receiveShadow = true;
    this.stubble.count = 0;
    this.group.add(this.stubble);

    const ingMat = new THREE.MeshStandardMaterial({
      map: atlas,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      roughness: 0.8,
      color: 0xfff3d0,
    });
    this.ingest = new THREE.InstancedMesh(hillGeo, ingMat, this.MAX_FLIGHTS);
    this.ingest.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ingest.frustumCulled = false;
    this.ingest.count = 0;
    this.group.add(this.ingest);

    for (let i = 0; i < this.MAX_FLIGHTS; i++) {
      this.flights.push({
        active: false,
        from: new THREE.Vector3(),
        ctrl: new THREE.Vector3(),
        t: 0, dur: 0.42, spin: 0, scale: 1,
      });
    }

    this.plant();
  }

  private cols: number;
  private rows: number;
  private dx: number;
  private dz: number;

  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3();

  /** (Re)fill the paddy with standing rice. */
  plant() {
    const halfW = (this.cols * this.dx) / 2;
    const halfL = (this.rows * this.dz) / 2;
    let n = 0;
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        const i = c * this.rows + r;
        // hand-transplanted rows are regular but never perfect
        const jx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
        const jz = (Math.sin(i * 78.233) * 12345.6789) % 1;
        const x = -halfW + (c + 0.5) * this.dx + jx * this.dx * 0.22;
        const z = -halfL + (r + 0.5) * this.dz + jz * this.dz * 0.22;
        this.hillX[i] = x;
        this.hillZ[i] = z;
        this.hillRot[i] = ((jx + jz) * 3.14159) % (Math.PI * 2);
        this.hillScale[i] = 1.08 + Math.abs(jz) * 0.4;
        this.alive[i] = 1;
        this.writeStanding(i, 1);
        n++;
      }
    }
    this.remaining = n;
    this.standing.count = n;
    this.standing.instanceMatrix.needsUpdate = true;
    this.stubbleCount = 0;
    this.stubble.count = 0;
  }

  private writeStanding(i: number, scale: number) {
    this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.hillRot[i]);
    this.v.set(this.hillX[i], 0, this.hillZ[i]);
    const s = this.hillScale[i] * scale;
    this.sc.set(s, s, s);
    this.m.compose(this.v, this.q, this.sc);
    this.standing.setMatrixAt(i, this.m);
  }

  private hookWind(mat: THREE.MeshStandardMaterial) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.uniforms.uWind = this.uniforms.uWind;
      shader.uniforms.uHeadPos = this.uniforms.uHeadPos;
      shader.uniforms.uHeadR = this.uniforms.uHeadR;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           attribute float aH;
           uniform float uTime;
           uniform float uWind;
           uniform vec3  uHeadPos;
           uniform float uHeadR;`
        )
        .replace(
          '#include <project_vertex>',
          /* glsl */ `
          vec4 mvPosition = vec4( transformed, 1.0 );
          #ifdef USE_INSTANCING
            mvPosition = instanceMatrix * mvPosition;
            vec3 iOrigin = ( modelMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0) ).xyz;
          #else
            vec3 iOrigin = ( modelMatrix * vec4(0.0,0.0,0.0,1.0) ).xyz;
          #endif
          vec4 wPos = modelMatrix * mvPosition;
          float h = pow(clamp(aH, 0.0, 1.0), 1.45);
          float ph = iOrigin.x * 0.85 + iOrigin.z * 0.55;
          float gust = 0.65 + 0.35 * sin(uTime * 0.37 + iOrigin.z * 0.05);
          wPos.x += (sin(uTime * 1.55 + ph) * 0.62 + sin(uTime * 2.9 + ph * 1.7) * 0.38) * h * uWind * gust;
          wPos.z += cos(uTime * 1.12 + ph * 0.6) * h * uWind * 0.5 * gust;
          // the header's draught: stalks bow into the mouth before they go in
          vec2 toH = uHeadPos.xz - iOrigin.xz;
          float dH = length(toH);
          float pull = 1.0 - smoothstep(uHeadR * 0.18, uHeadR, dH);
          pull *= pull;
          vec2 dir = dH > 0.0001 ? toH / dH : vec2(0.0);
          wPos.xz += dir * pull * h * 0.5;
          wPos.y  -= pull * h * 0.22;
          mvPosition = viewMatrix * wPos;
          gl_Position = projectionMatrix * mvPosition;
          `
        );
    };
    mat.customProgramCacheKey = () => 'riceWind';
  }

  /** Header mouth, in world space — drives the suction bend. */
  setHeader(p: THREE.Vector3, radius: number) {
    this.uniforms.uHeadPos.value.copy(p);
    this.uniforms.uHeadR.value = radius;
  }

  /**
   * Cut everything inside the header's swept footprint.
   * Returns how many hills went in this frame.
   */
  harvest(
    machinePos: THREE.Vector3,
    forward: THREE.Vector3,
    right: THREE.Vector3,
    halfWidth: number,
    zMin: number,
    zMax: number,
    onCut: (x: number, z: number) => void
  ): number {
    const halfW = (this.cols * this.dx) / 2;
    const halfL = (this.rows * this.dz) / 2;
    // only scan the grid cells the header can possibly touch
    const reach = zMax + halfWidth + 1.0;
    const cx = machinePos.x + forward.x * ((zMin + zMax) * 0.5);
    const cz = machinePos.z + forward.z * ((zMin + zMax) * 0.5);
    const c0 = Math.max(0, Math.floor((cx - reach + halfW) / this.dx) - 1);
    const c1 = Math.min(this.cols - 1, Math.ceil((cx + reach + halfW) / this.dx) + 1);
    const r0 = Math.max(0, Math.floor((cz - reach + halfL) / this.dz) - 1);
    const r1 = Math.min(this.rows - 1, Math.ceil((cz + reach + halfL) / this.dz) + 1);

    let cut = 0;
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        const i = c * this.rows + r;
        if (!this.alive[i]) continue;
        const dx = this.hillX[i] - machinePos.x;
        const dz = this.hillZ[i] - machinePos.z;
        const lz = dx * forward.x + dz * forward.z;
        if (lz < zMin || lz > zMax) continue;
        const lx = dx * right.x + dz * right.z;
        if (lx < -halfWidth || lx > halfWidth) continue;
        this.cutHill(i);
        onCut(this.hillX[i], this.hillZ[i]);
        cut++;
      }
    }
    if (cut > 0) {
      this.standing.instanceMatrix.needsUpdate = true;
      this.stubble.instanceMatrix.needsUpdate = true;
      this.ingest.instanceMatrix.needsUpdate = true;
    }
    return cut;
  }

  private cutHill(i: number) {
    this.alive[i] = 0;
    this.remaining--;
    // hide the standing instance
    this.m.makeScale(0, 0, 0);
    this.m.setPosition(this.hillX[i], -20, this.hillZ[i]);
    this.standing.setMatrixAt(i, this.m);

    // leave stubble behind
    if (this.stubbleCount < this.stubble.instanceMatrix.count) {
      const s = 0.9 + (i % 7) * 0.05;
      this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.hillRot[i]);
      this.v.set(this.hillX[i], 0, this.hillZ[i]);
      this.sc.set(s, s, s);
      this.m.compose(this.v, this.q, this.sc);
      this.stubble.setMatrixAt(this.stubbleCount++, this.m);
      this.stubble.count = this.stubbleCount;
    }

    // and launch the bundle toward the header throat
    this.launch(this.hillX[i], this.hillZ[i], this.hillScale[i]);
  }

  private launch(x: number, z: number, scale: number) {
    for (let k = 0; k < this.flights.length; k++) {
      const f = this.flights[k];
      if (f.active) continue;
      f.active = true;
      f.t = 0;
      f.dur = 0.30 + Math.random() * 0.14;
      f.from.set(x, 0, z);
      f.ctrl.set(
        (x + this.ingestTarget.x) * 0.5 + (Math.random() - 0.5) * 0.35,
        1.15 + Math.random() * 0.4,
        (z + this.ingestTarget.z) * 0.5 + (Math.random() - 0.5) * 0.35
      );
      f.spin = (Math.random() - 0.5) * 22;
      f.scale = scale;
      if (k + 1 > this.ingest.count) this.ingest.count = k + 1;
      return;
    }
  }

  update(dt: number, time: number) {
    this.uniforms.uTime.value = time;

    let any = false;
    const p = this.v;
    for (let k = 0; k < this.flights.length; k++) {
      const f = this.flights[k];
      if (!f.active) continue;
      any = true;
      f.t += dt / f.dur;
      if (f.t >= 1) {
        f.active = false;
        this.m.makeScale(0, 0, 0);
        this.m.setPosition(0, -50, 0);
        this.ingest.setMatrixAt(k, this.m);
        continue;
      }
      const t = f.t;
      const mt = 1 - t;
      const target = this.ingestTarget;
      p.set(
        mt * mt * f.from.x + 2 * mt * t * f.ctrl.x + t * t * target.x,
        mt * mt * f.from.y + 2 * mt * t * f.ctrl.y + t * t * target.y,
        mt * mt * f.from.z + 2 * mt * t * f.ctrl.z + t * t * target.z
      );
      // tumble head-first into the throat, shrinking as it is drawn in
      this.q.setFromEuler(new THREE.Euler(f.spin * t * 0.25, f.spin * t, f.spin * t * 0.4));
      const s = f.scale * (1 - t * t * 0.85);
      this.sc.set(s, s, s);
      this.m.compose(p, this.q, this.sc);
      this.ingest.setMatrixAt(k, this.m);
    }
    if (any) this.ingest.instanceMatrix.needsUpdate = true;
  }

  /** How much of the paddy is still standing, 0..1 */
  get standingFraction() {
    return this.remaining / this.total;
  }

  /** Nearest still-standing hill's Z along a lane, or null. */
  laneHasCrop(centerX: number, halfWidth: number): boolean {
    const halfW = (this.cols * this.dx) / 2;
    const c0 = Math.max(0, Math.floor((centerX - halfWidth + halfW) / this.dx));
    const c1 = Math.min(this.cols - 1, Math.ceil((centerX + halfWidth + halfW) / this.dx));
    for (let c = c0; c <= c1; c++) {
      for (let r = 0; r < this.rows; r++) {
        if (this.alive[c * this.rows + r]) return true;
      }
    }
    return false;
  }
}
