import * as THREE from 'three';

/**
 * A strip of surface hugging the bottom of a flume: the water film.
 * Built as a thin ribbon whose lateral arc widens with flow, with the front
 * exposed through drawRange so the leading edge really travels down the slide.
 */
export class FlowRibbon {
  readonly mesh: THREE.Mesh;
  private readonly segs: number;
  private readonly lat: number;
  private readonly frames: { p: THREE.Vector3; down: THREE.Vector3; side: THREE.Vector3 }[] = [];
  private readonly position: THREE.BufferAttribute;
  private lastArc = -1;

  constructor(
    curve: THREE.Curve<THREE.Vector3>,
    private readonly radius: number,
    material: THREE.Material,
    segs = 120,
    lat = 6,
  ) {
    this.segs = segs;
    this.lat = lat;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t).normalize();
      // "down" is gravity projected into the section plane — water always lies at the invert
      const down = new THREE.Vector3(0, -1, 0);
      down.addScaledVector(tan, -down.dot(tan));
      if (down.lengthSq() < 1e-6) down.set(0, 0, -1);
      down.normalize();
      const side = new THREE.Vector3().crossVectors(tan, down).normalize();
      this.frames.push({ p, down, side });
    }

    const count = (segs + 1) * (lat + 1);
    const pos = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const idx: number[] = [];
    for (let i = 0; i <= segs; i++) {
      for (let j = 0; j <= lat; j++) {
        const k = (i * (lat + 1) + j) * 2;
        uv[k] = i / segs;
        uv[k + 1] = j / lat;
      }
    }
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < lat; j++) {
        const a = i * (lat + 1) + j;
        const b = a + lat + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    this.position = new THREE.BufferAttribute(pos, 3);
    this.position.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.position);
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.writeArc(0.35, 0);
    geo.setDrawRange(0, 0);
  }

  private writeArc(halfArc: number, lift: number) {
    const arr = this.position.array as Float32Array;
    for (let i = 0; i <= this.segs; i++) {
      const f = this.frames[i];
      for (let j = 0; j <= this.lat; j++) {
        const th = -halfArc + (j / this.lat) * halfArc * 2;
        const r = this.radius - lift;
        const k = (i * (this.lat + 1) + j) * 3;
        arr[k] = f.p.x + f.down.x * r * Math.cos(th) + f.side.x * r * Math.sin(th);
        arr[k + 1] = f.p.y + f.down.y * r * Math.cos(th) + f.side.y * r * Math.sin(th);
        arr[k + 2] = f.p.z + f.down.z * r * Math.cos(th) + f.side.z * r * Math.sin(th);
      }
    }
    this.position.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.lastArc = halfArc;
  }

  /** front 0..1 down the flume, width 0..1 from a trickle to a full sheet. */
  setState(front: number, width: number, time: number, speed = 1) {
    const halfArc = 0.12 + width * 1.05;
    if (Math.abs(halfArc - this.lastArc) > 0.02) this.writeArc(halfArc, 0.012 + width * 0.01);
    const perRow = this.lat * 6;
    const rows = Math.max(0, Math.min(this.segs, Math.floor(front * this.segs)));
    this.mesh.geometry.setDrawRange(0, rows * perRow);
    this.mesh.visible = rows > 0 && width > 0.01;
    const m = this.mesh.material as THREE.MeshStandardMaterial;
    if (m.normalMap) m.normalMap.offset.y = -time * (0.5 + speed * 2.2);
    m.opacity = 0.34 + width * 0.46;
  }
}

/** Flume shell built from the same ribbon frames — an open channel, not a tube. */
export function channelShell(
  curve: THREE.Curve<THREE.Vector3>,
  radius: number,
  halfArc: number,
  material: THREE.Material,
  segs = 110,
  lat = 12,
  arcCentre = 0,
): THREE.Mesh {
  const count = (segs + 1) * (lat + 1);
  const pos = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const down = new THREE.Vector3(0, -1, 0);
    down.addScaledVector(tan, -down.dot(tan)).normalize();
    const side = new THREE.Vector3().crossVectors(tan, down).normalize();
    for (let j = 0; j <= lat; j++) {
      const th = arcCentre - halfArc + (j / lat) * halfArc * 2;
      const k = (i * (lat + 1) + j) * 3;
      pos[k] = p.x + down.x * radius * Math.cos(th) + side.x * radius * Math.sin(th);
      pos[k + 1] = p.y + down.y * radius * Math.cos(th) + side.y * radius * Math.sin(th);
      pos[k + 2] = p.z + down.z * radius * Math.cos(th) + side.z * radius * Math.sin(th);
      const u = (i * (lat + 1) + j) * 2;
      uv[u] = t * 12;
      uv[u + 1] = j / lat;
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < lat; j++) {
      const a = i * (lat + 1) + j;
      const b = a + lat + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Cheap spray at a discharge point: a handful of instanced droplets on loops. */
export class Splash {
  readonly mesh: THREE.InstancedMesh;
  private readonly seeds: { ph: number; vx: number; vz: number; vy: number; s: number }[];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly sc = new THREE.Vector3();

  constructor(private readonly origin: THREE.Vector3, count: number, material: THREE.Material, spread = 1) {
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 5), material, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.seeds = Array.from({ length: count }, (_, i) => ({
      ph: i / count + Math.random() * 0.08,
      vx: (Math.random() - 0.5) * 1.5 * spread,
      vz: (Math.random() - 0.5) * 1.5 * spread,
      vy: 0.6 + Math.random() * 1.4,
      s: 0.035 + Math.random() * 0.05,
    }));
  }

  update(t: number, intensity: number) {
    const n = this.seeds.length;
    const active = Math.round(intensity * n);
    for (let i = 0; i < n; i++) {
      const s = this.seeds[i];
      const u = (t * 0.9 + s.ph) % 1;
      const alive = i < active;
      this.p.set(
        this.origin.x + s.vx * u,
        this.origin.y + s.vy * u - 4.2 * u * u,
        this.origin.z + s.vz * u,
      );
      this.sc.setScalar(alive ? s.s * (1 - u * 0.4) : 0.0001);
      this.mesh.setMatrixAt(i, this.m.compose(this.p, this.q, this.sc));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
