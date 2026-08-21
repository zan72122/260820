import * as THREE from 'three';

/** Polyline with true elbow radii — reads as fabricated pipework rather than a spline. */
export function roundedPath(points: THREE.Vector3[], radius = 0.42): THREE.CurvePath<THREE.Vector3> {
  const path = new THREE.CurvePath<THREE.Vector3>();
  if (points.length < 2) return path;
  let cursor = points[0].clone();
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const next = points[i + 1];
    const inDir = new THREE.Vector3().subVectors(p, cursor).normalize();
    const outDir = new THREE.Vector3().subVectors(next, p).normalize();
    const inLen = cursor.distanceTo(p);
    const outLen = p.distanceTo(next);
    const r = Math.min(radius, inLen * 0.48, outLen * 0.48);
    const a = new THREE.Vector3().copy(p).addScaledVector(inDir, -r);
    const b = new THREE.Vector3().copy(p).addScaledVector(outDir, r);
    if (cursor.distanceTo(a) > 1e-4) path.add(new THREE.LineCurve3(cursor.clone(), a));
    path.add(new THREE.QuadraticBezierCurve3(a, p.clone(), b));
    cursor = b;
  }
  path.add(new THREE.LineCurve3(cursor, points[points.length - 1].clone()));
  return path;
}

export function pipeMesh(
  curve: THREE.Curve<THREE.Vector3>,
  radius: number,
  material: THREE.Material,
  tubular = 96,
  radial = 18,
): THREE.Mesh {
  const g = new THREE.TubeGeometry(curve, tubular, radius, radial, false);
  const m = new THREE.Mesh(g, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Open half-pipe used for cut-away sections that expose the water column. */
export function cutawayPipe(
  curve: THREE.Curve<THREE.Vector3>,
  radius: number,
  material: THREE.Material,
  wall = 0.022,
  tubular = 40,
): THREE.Group {
  const g = new THREE.Group();
  const outer = new THREE.TubeGeometry(curve, tubular, radius, 22, false);
  const inner = new THREE.TubeGeometry(curve, tubular, radius - wall, 22, false);
  // keep ~62% of the circumference: cut a window without losing the pipe silhouette
  const keep = (i: number, total: number) => {
    const a = (i / total) * Math.PI * 2;
    return Math.cos(a) > -0.42;
  };
  for (const [geo, flip] of [
    [outer, false],
    [inner, true],
  ] as const) {
    const idx = geo.index!;
    const arr: number[] = [];
    const radialSeg = 22;
    for (let t = 0; t < tubular; t++) {
      for (let r = 0; r < radialSeg; r++) {
        if (!keep(r, radialSeg) || !keep(r + 1, radialSeg)) continue;
        const base = (t * (radialSeg + 1) + r) * 6;
        for (let k = 0; k < 6; k++) arr.push(idx.getX(base + k));
      }
    }
    const cut = geo.clone();
    cut.setIndex(arr);
    if (flip) {
      const norm = cut.getAttribute('normal') as THREE.BufferAttribute;
      for (let i = 0; i < norm.count; i++) norm.setXYZ(i, -norm.getX(i), -norm.getY(i), -norm.getZ(i));
      norm.needsUpdate = true;
      const ind = cut.getIndex()!.array as unknown as number[];
      for (let i = 0; i < ind.length; i += 3) {
        const t0 = ind[i];
        ind[i] = ind[i + 2];
        ind[i + 2] = t0;
      }
      cut.getIndex()!.needsUpdate = true;
    }
    const mesh = new THREE.Mesh(cut, material);
    mesh.castShadow = !flip;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}

export function latheProfile(
  pts: [number, number][],
  segments = 32,
  phiStart = 0,
  phiLength = Math.PI * 2,
): THREE.LatheGeometry {
  return new THREE.LatheGeometry(
    pts.map(([x, y]) => new THREE.Vector2(Math.max(x, 0.0001), y)),
    segments,
    phiStart,
    phiLength,
  );
}

const HEX = new THREE.CylinderGeometry(1, 1, 1, 6);
const WASHER = new THREE.CylinderGeometry(1, 1, 1, 12);

/** Ring of hex bolts + washers on a flange face. */
export function boltRing(
  count: number,
  ringRadius: number,
  boltRadius: number,
  height: number,
  material: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  const heads = new THREE.InstancedMesh(HEX, material, count);
  const washers = new THREE.InstancedMesh(WASHER, material, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.13;
    p.set(Math.cos(a) * ringRadius, height * 0.5, Math.sin(a) * ringRadius);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a * 1.7);
    s.set(boltRadius, height, boltRadius);
    heads.setMatrixAt(i, m.compose(p, q, s));
    p.y = height * 0.06;
    s.set(boltRadius * 1.45, height * 0.12, boltRadius * 1.45);
    washers.setMatrixAt(i, m.compose(p, q, s));
  }
  heads.instanceMatrix.needsUpdate = true;
  washers.instanceMatrix.needsUpdate = true;
  heads.castShadow = true;
  washers.castShadow = true;
  g.add(heads, washers);
  return g;
}

export interface FlangeOptions {
  bore: number;
  outer: number;
  thickness?: number;
  bolts?: number;
  material: THREE.Material;
  boltMaterial: THREE.Material;
  gasketMaterial?: THREE.Material;
}

/** Bolted flange joint with a squeezed gasket showing at the parting line. */
export function flangeJoint(o: FlangeOptions): THREE.Group {
  const t = o.thickness ?? 0.055;
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    latheProfile(
      [
        [o.bore, -t],
        [o.outer * 0.98, -t],
        [o.outer, -t * 0.6],
        [o.outer, t * 0.6],
        [o.outer * 0.98, t],
        [o.bore, t],
      ],
      28,
    ),
    o.material,
  );
  ring.castShadow = true;
  ring.receiveShadow = true;
  g.add(ring);
  if (o.gasketMaterial) {
    const gasket = new THREE.Mesh(
      latheProfile(
        [
          [o.bore * 1.02, -0.012],
          [o.outer * 0.78, -0.016],
          [o.outer * 0.8, 0],
          [o.outer * 0.78, 0.016],
          [o.bore * 1.02, 0.012],
        ],
        24,
      ),
      o.gasketMaterial,
    );
    g.add(gasket);
  }
  const bolts = boltRing(o.bolts ?? 8, (o.bore + o.outer) * 0.5, o.outer * 0.1, t * 2.3, o.boltMaterial);
  g.add(bolts);
  return g;
}

export interface HandwheelParts {
  group: THREE.Group;
  rim: THREE.Mesh;
}

/** Cast handwheel: rounded rim, tapered spokes, hub boss and a stainless stem nut. */
export function handwheel(
  outer: number,
  wheelMat: THREE.Material,
  stemMat: THREE.Material,
  spokes = 5,
): HandwheelParts {
  const group = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(outer, outer * 0.115, 12, 44), wheelMat);
  rim.rotation.x = Math.PI / 2;
  rim.castShadow = true;
  rim.receiveShadow = true;
  group.add(rim);

  const hub = new THREE.Mesh(
    latheProfile(
      [
        [outer * 0.09, -outer * 0.16],
        [outer * 0.26, -outer * 0.16],
        [outer * 0.3, -outer * 0.06],
        [outer * 0.28, outer * 0.14],
        [outer * 0.12, outer * 0.2],
        [outer * 0.09, outer * 0.2],
      ],
      20,
    ),
    wheelMat,
  );
  hub.castShadow = true;
  group.add(hub);

  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const spoke = new THREE.Mesh(
      new THREE.CylinderGeometry(outer * 0.052, outer * 0.078, outer * 0.78, 8),
      wheelMat,
    );
    spoke.position.set(Math.cos(a) * outer * 0.55, 0, Math.sin(a) * outer * 0.55);
    spoke.rotation.z = Math.PI / 2;
    spoke.rotation.y = -a;
    spoke.castShadow = true;
    group.add(spoke);
  }

  const nut = new THREE.Mesh(new THREE.CylinderGeometry(outer * 0.115, outer * 0.115, outer * 0.16, 6), stemMat);
  nut.position.y = outer * 0.26;
  nut.castShadow = true;
  group.add(nut);
  return { group, rim };
}

/** Structural channel / angle section used for supports and walkways. */
export function channelSection(length: number, w: number, h: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const web = new THREE.Mesh(new THREE.BoxGeometry(length, h, 0.022), mat);
  g.add(web);
  for (const s of [-1, 1]) {
    const fl = new THREE.Mesh(new THREE.BoxGeometry(length, 0.026, w), mat);
    fl.position.y = (s * h) / 2;
    g.add(fl);
  }
  g.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return g;
}

/** Pipe support: shaped saddle, rubber liner, U-bolt and a floor-fixed post. */
export function pipeSupport(
  pipeRadius: number,
  height: number,
  steel: THREE.Material,
  rubber: THREE.Material,
  bolt: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  const post = channelSection(height, 0.1, 0.11, steel);
  post.rotation.z = Math.PI / 2;
  post.position.y = -height / 2;
  g.add(post);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.022, 0.26), steel);
  base.position.y = -height;
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);
  g.add(boltRing(4, 0.1, 0.018, 0.028, bolt).translateY(-height + 0.012));
  // a formed cradle plate rather than a bare hoop
  const saddle = new THREE.Mesh(
    new THREE.CylinderGeometry(pipeRadius + 0.045, pipeRadius + 0.045, 0.19, 20, 1, true, Math.PI * 0.94, Math.PI * 1.12),
    steel,
  );
  saddle.rotation.z = Math.PI / 2;
  saddle.castShadow = true;
  saddle.receiveShadow = true;
  (saddle.material as THREE.Material).side = THREE.DoubleSide;
  g.add(saddle);
  const liner = new THREE.Mesh(
    new THREE.CylinderGeometry(pipeRadius + 0.012, pipeRadius + 0.012, 0.16, 20, 1, true, Math.PI * 0.9, Math.PI * 1.2),
    rubber,
  );
  liner.rotation.z = Math.PI / 2;
  (liner.material as THREE.Material).side = THREE.DoubleSide;
  g.add(liner);
  const web = new THREE.Mesh(new THREE.BoxGeometry(0.16, pipeRadius * 0.9, 0.024), steel);
  web.position.y = -pipeRadius * 0.55;
  web.castShadow = true;
  g.add(web);
  const strap = new THREE.Mesh(
    new THREE.CylinderGeometry(pipeRadius + 0.05, pipeRadius + 0.05, 0.05, 20, 1, true, -Math.PI * 0.06, Math.PI * 1.12),
    steel,
  );
  strap.rotation.z = Math.PI / 2;
  (strap.material as THREE.Material).side = THREE.DoubleSide;
  strap.castShadow = true;
  g.add(strap);
  return g;
}

/** Indicator lamp — a lens over a diffuser, deliberately dim so it never reads as neon. */
export function indicatorLamp(
  radius: number,
  bezel: THREE.Material,
): { group: THREE.Group; lens: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    latheProfile(
      [
        [radius * 0.5, -radius * 0.9],
        [radius * 1.15, -radius * 0.8],
        [radius * 1.15, radius * 0.1],
        [radius * 0.95, radius * 0.16],
      ],
      16,
    ),
    bezel,
  );
  group.add(body);
  const lens = new THREE.MeshStandardMaterial({
    color: 0x232a2e,
    emissive: 0x000000,
    roughness: 0.28,
    metalness: 0,
    transparent: true,
    opacity: 0.94,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.95, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), lens);
  dome.position.y = radius * 0.1;
  group.add(dome);
  return { group, lens };
}

export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
  });
}
