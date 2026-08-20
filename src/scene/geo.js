import * as THREE from 'three';

// Geometry helpers. Everything in the foreground is generated at runtime: the
// game ships no meshes, which keeps it a single small download and lets the
// hand be tuned by editing numbers rather than re-exporting a model.

/**
 * A tube of varying radius along a curve, with a per-vertex "thin" value that
 * the skin shader uses for subsurface scattering (fingertips glow, palms do not).
 */
export function tubeGeometry(curve, tubularSegments, radialSegments, radiusAt, thinAt) {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions = [];
  const normals = [];
  const uvs = [];
  const thins = [];
  const indices = [];

  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const v = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    curve.getPointAt(t, P);
    N.copy(frames.normals[i]);
    B.copy(frames.binormals[i]);
    const r = radiusAt(t);
    const th = thinAt ? thinAt(t) : 0.4;
    for (let j = 0; j <= radialSegments; j++) {
      const a = (j / radialSegments) * Math.PI * 2;
      const sin = Math.sin(a);
      const cos = -Math.cos(a);
      v.set(N.x * cos + B.x * sin, N.y * cos + B.y * sin, N.z * cos + B.z * sin);
      normals.push(v.x, v.y, v.z);
      positions.push(P.x + v.x * r, P.y + v.y * r, P.z + v.z * r);
      uvs.push(j / radialSegments, t);
      thins.push(th);
    }
  }

  for (let i = 1; i <= tubularSegments; i++) {
    for (let j = 1; j <= radialSegments; j++) {
      const a = (radialSegments + 1) * (i - 1) + (j - 1);
      const b = (radialSegments + 1) * i + (j - 1);
      const c = (radialSegments + 1) * i + j;
      const d = (radialSegments + 1) * (i - 1) + j;
      indices.push(a, b, d, b, c, d);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setIndex(indices);
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('thin', new THREE.Float32BufferAttribute(thins, 1));
  return g;
}

/** Squashed sphere with a constant "thin" attribute -- palm mass, nails, knuckles. */
export function blobGeometry(rx, ry, rz, widthSeg, heightSeg, thin = 0.15) {
  const g = new THREE.SphereGeometry(1, widthSeg, heightSeg);
  g.scale(rx, ry, rz);
  const n = g.attributes.position.count;
  g.setAttribute('thin', new THREE.Float32BufferAttribute(new Float32Array(n).fill(thin), 1));
  g.computeVertexNormals();
  return g;
}

/** Merge geometries that all share position/normal/uv/thin. Index-safe. */
export function mergeAll(geometries) {
  let vertexCount = 0;
  let indexCount = 0;
  for (const g of geometries) {
    vertexCount += g.attributes.position.count;
    indexCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const position = new Float32Array(vertexCount * 3);
  const normal = new Float32Array(vertexCount * 3);
  const uv = new Float32Array(vertexCount * 2);
  const thin = new Float32Array(vertexCount);
  const index = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);

  let vo = 0;
  let io = 0;
  for (const g of geometries) {
    const p = g.attributes.position.array;
    const nm = g.attributes.normal.array;
    const u = g.attributes.uv ? g.attributes.uv.array : null;
    const th = g.attributes.thin ? g.attributes.thin.array : null;
    const count = g.attributes.position.count;
    position.set(p, vo * 3);
    normal.set(nm, vo * 3);
    if (u) uv.set(u, vo * 2);
    if (th) thin.set(th, vo);
    if (g.index) {
      const gi = g.index.array;
      for (let i = 0; i < gi.length; i++) index[io + i] = gi[i] + vo;
      io += gi.length;
    } else {
      for (let i = 0; i < count; i++) index[io + i] = i + vo;
      io += count;
    }
    vo += count;
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('thin', new THREE.BufferAttribute(thin, 1));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeBoundingSphere();
  return out;
}

export function transformed(geometry, matrix) {
  const g = geometry.clone();
  g.applyMatrix4(matrix);
  return g;
}
