import * as THREE from 'three';
import { clamp, smoothstep } from '../core/util';
import { frpNormal, roughnessCloud } from '../core/textures';

export interface Frame {
  p: THREE.Vector3;
  t: THREE.Vector3;
  /** Unit vector pointing at the floor of the flume at this station. */
  d: THREE.Vector3;
  /** Unit vector across the flume, completing the frame. */
  r: THREE.Vector3;
}

/** Half width of the interactive repair window, in radians around the floor line. */
export const WORK_THETA = 0.22;
/** Half length of the interactive repair window, in metres along the flume. */
export const WORK_HALF_LEN = 0.22;

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

/**
 * The moulded slide itself: one continuous curve, an inner gelcoat surface built
 * as real geometry, and a high resolution collar of real geometry at every
 * moulding joint so a lifted lip can actually catch the light.
 */
export class Slide {
  readonly curve: THREE.CatmullRomCurve3;
  readonly radius = 1.5;
  readonly wall = 0.075;
  readonly length: number;
  /** Arc-length parameters of every moulding joint, from mouth to exit. */
  readonly seams: number[];
  readonly root = new THREE.Group();

  innerMaterial!: THREE.MeshStandardMaterial;
  shell!: THREE.Mesh;

  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private axisSamples: THREE.Vector3[] = [];

  constructor() {
    const pts = [
      new THREE.Vector3(0, 9.4, -2.6),
      new THREE.Vector3(0, 9.1, 2.0),
      new THREE.Vector3(0.9, 8.3, 7.4),
      new THREE.Vector3(3.0, 7.2, 12.4),
      new THREE.Vector3(3.9, 5.9, 17.8),
      new THREE.Vector3(2.1, 4.7, 23.0),
      new THREE.Vector3(-1.1, 3.7, 28.0),
      new THREE.Vector3(-2.6, 2.9, 33.2),
      new THREE.Vector3(-1.0, 2.25, 38.4),
      new THREE.Vector3(1.6, 1.85, 42.6),
    ];
    this.curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    this.curve.arcLengthDivisions = 900;
    this.length = this.curve.getLength();
    this.root.name = 'slide';

    // Joints sit a little further apart than a real 3 m mould section so a young
    // player never has two candidate seams inside one camera framing.
    this.seams = [0.16, 0.28, 0.41, 0.545, 0.675, 0.8];
  }

  /**
   * True when a point lies within the bore.
   *
   * Used to drop the translucent outer shell while the camera is inside: it is
   * full screen overdraw that buys nothing from in there.
   */
  isInside(p: THREE.Vector3): boolean {
    let best = Infinity;
    for (const s of this.axisSamples) {
      const d = s.distanceToSquared(p);
      if (d < best) best = d;
    }
    return best < this.radius * this.radius * 0.94;
  }

  frame(u: number, out?: Frame): Frame {
    const uu = clamp(u, 0, 1);
    const p = this.curve.getPointAt(uu, out?.p ?? new THREE.Vector3());
    const t = this.curve.getTangentAt(uu, out?.t ?? new THREE.Vector3()).normalize();
    const d = (out?.d ?? new THREE.Vector3()).copy(DOWN);
    d.addScaledVector(t, -DOWN.dot(t)).normalize();
    const r = (out?.r ?? new THREE.Vector3()).crossVectors(t, d).normalize();
    return { p, t, d, r };
  }

  /** Direction from the flume axis towards the wall at angle `theta` (0 = floor). */
  radial(u: number, theta: number, out = new THREE.Vector3()): THREE.Vector3 {
    const f = this.frame(u, SCRATCH_FRAME);
    out.copy(f.d).multiplyScalar(Math.cos(theta)).addScaledVector(f.r, Math.sin(theta));
    return out.normalize();
  }

  /** A point on the inner wall. `inward` lifts the point off the surface. */
  pointAt(u: number, theta: number, inward = 0, out = new THREE.Vector3()): THREE.Vector3 {
    const f = this.frame(u, SCRATCH_FRAME);
    this.tmpA
      .copy(f.d)
      .multiplyScalar(Math.cos(theta))
      .addScaledVector(f.r, Math.sin(theta))
      .normalize();
    return out.copy(f.p).addScaledVector(this.tmpA, this.radius - inward);
  }

  /** Inward pointing surface normal (towards the flume axis). */
  normalAt(u: number, theta: number, out = new THREE.Vector3()): THREE.Vector3 {
    return this.radial(u, theta, out).multiplyScalar(-1);
  }

  /** Centre of the floor line, where inspection water runs. */
  floorAt(u: number, lift = 0, out = new THREE.Vector3()): THREE.Vector3 {
    return this.pointAt(u, 0, lift, out);
  }

  /** Converts a distance along the flume into a curve parameter delta. */
  metersToU(m: number): number {
    return m / this.length;
  }

  /**
   * Baked ambient occlusion for the inside of the flume.
   *
   * Daylight only reaches a little way past each opening, so the middle of the
   * run is dim while both ends stay visible. This is what keeps the pipe reading
   * as a calm inspection space instead of a black tunnel, without a single extra
   * light or shadow map.
   */
  ambientAt(u: number, theta: number): number {
    const dm = Math.min(u, 1 - u) * this.length;
    const end = 1 - smoothstep(clamp(dm / 11, 0, 1));
    const ceiling = 1 - 0.28 * smoothstep(clamp((Math.abs(theta) - 1.2) / 1.4, 0, 1));
    return (0.44 + 0.56 * end) * ceiling;
  }

  /** Base wall relief shared by every joint: a moulded caulk groove. */
  grooveDepth(dMeters: number): number {
    const half = 0.055;
    const a = clamp(Math.abs(dMeters) / half, 0, 1);
    // rounded U shaped channel, chamfered at the lip
    return (1 - smoothstep(a)) * 0.022;
  }

  build(envMap: THREE.Texture): void {
    const normal = frpNormal();
    normal.wrapS = THREE.RepeatWrapping;
    normal.wrapT = THREE.RepeatWrapping;

    const rough = roughnessCloud(0.11, 0.05, 31, 'frpRough');
    rough.wrapS = THREE.RepeatWrapping;
    rough.wrapT = THREE.RepeatWrapping;
    rough.repeat.set(5, 10);

    // Deliberately MeshStandard rather than MeshPhysical: the long run of pipe
    // fills the screen, and a clearcoat lobe over that many fragments is the
    // single most expensive thing a phone GPU would be asked to do here. Low
    // roughness plus a strong probe reads as wet gelcoat for a fraction of it.
    this.innerMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0,
      normalMap: normal,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughnessMap: rough,
      envMap,
      envMapIntensity: 0.62,
      side: THREE.FrontSide,
    });
    this.innerMaterial.normalMap!.repeat.set(27, 27);

    this.root.add(this.buildInner(), this.buildShell(), this.buildFlange());
    const step = 1 / 47;
    for (let i = 0; i <= 47; i++) this.axisSamples.push(this.curve.getPointAt(i * step));
  }

  /**
   * Ring stations for the long runs between joints.
   *
   * Each run ends exactly on the boundary of the next joint collar, so the two
   * meshes share a rim instead of leaving a sliver of missing wall.
   */
  private sections(): { u0: number; u1: number }[] {
    const half = this.metersToU(WORK_HALF_LEN);
    const runs: { u0: number; u1: number }[] = [];
    let start = 0;
    for (const s of this.seams) {
      if (s - half > start + 1e-6) runs.push({ u0: start, u1: s - half });
      start = s + half;
    }
    if (start < 1 - 1e-6) runs.push({ u0: start, u1: 1 });
    return runs;
  }

  private buildInner(): THREE.Mesh {
    const M = 44;
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const gel = new THREE.Color(0xdfeae6).convertSRGBToLinear();
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    let vertexCount = 0;

    for (const run of this.sections()) {
      const lenM = (run.u1 - run.u0) * this.length;
      const rings = Math.max(2, Math.round(lenM / 0.13) + 1);
      const base = vertexCount;
      for (let i = 0; i < rings; i++) {
        const u = run.u0 + ((run.u1 - run.u0) * i) / (rings - 1);
        for (let j = 0; j <= M; j++) {
          const theta = -Math.PI + (2 * Math.PI * j) / M;
          this.pointAt(u, theta, 0, p);
          this.normalAt(u, theta, n);
          positions.push(p.x, p.y, p.z);
          normals.push(n.x, n.y, n.z);
          uvs.push(
            u * (this.length / (2 * Math.PI * this.radius)),
            (theta + Math.PI) / (2 * Math.PI),
          );
          const ao = this.ambientAt(u, theta);
          colors.push(gel.r * ao, gel.g * ao, gel.b * ao);
          vertexCount++;
        }
      }
      for (let i = 0; i < rings - 1; i++) {
        const a = base + i * (M + 1);
        const b = base + (i + 1) * (M + 1);
        for (let j = 0; j < M; j++) {
          indices.push(a + j, b + j, a + j + 1, a + j + 1, b + j, b + j + 1);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeBoundingSphere();

    const mesh = new THREE.Mesh(geo, this.innerMaterial);
    mesh.name = 'flume-inner';
    mesh.frustumCulled = false;
    return mesh;
  }

  private buildShell(): THREE.Mesh {
    const N = 190;
    const M = 30;
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    const aqua = new THREE.Color(0x27a9cd).convertSRGBToLinear();
    const pale = new THREE.Color(0xeff9fb).convertSRGBToLinear();

    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const band = Math.floor(u * this.length / 3.1) % 2 === 0 ? aqua : pale;
      for (let j = 0; j <= M; j++) {
        const theta = -Math.PI + (2 * Math.PI * j) / M;
        this.pointAt(u, theta, -this.wall, p);
        this.radial(u, theta, n);
        positions.push(p.x, p.y, p.z);
        normals.push(n.x, n.y, n.z);
        colors.push(band.r, band.g, band.b);
      }
    }
    for (let i = 0; i < N; i++) {
      const a = i * (M + 1);
      const b = (i + 1) * (M + 1);
      for (let j = 0; j < M; j++) {
        indices.push(a + j, a + j + 1, b + j, a + j + 1, b + j + 1, b + j);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeBoundingSphere();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.12,
      metalness: 0,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    this.shell = mesh;
    mesh.name = 'flume-shell';
    mesh.renderOrder = 4;
    mesh.frustumCulled = false;
    return mesh;
  }

  /** Rolled lip at the mouth and the exit, so the tube reads as a moulded part. */
  private buildFlange(): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xe9f6f8,
      roughness: 0.28,
      metalness: 0,
    });
    for (const u of [0, 1]) {
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(this.radius + this.wall * 0.5, this.wall * 0.9, 8, 40),
        mat,
      );
      const f = this.frame(u);
      torus.position.copy(f.p);
      torus.lookAt(this.tmpB.copy(f.p).add(f.t));
      g.add(torus);
    }
    g.name = 'flanges';
    return g;
  }
}

const SCRATCH_FRAME: Frame = {
  p: new THREE.Vector3(),
  t: new THREE.Vector3(),
  d: new THREE.Vector3(),
  r: new THREE.Vector3(),
};

export { UP };
