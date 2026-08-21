import * as THREE from 'three';
import { CourseSpline } from './CourseSpline';

/** Cross-section of the moulded flume, right half, inner surface upward.
 *  Units are metres in the local frame: [across, out of floor]. */
const INNER_HALF: ReadonlyArray<readonly [number, number]> = [
  [0.0, 0.0],
  [0.34, 0.004],
  [0.62, 0.024],
  [0.86, 0.086],
  [1.04, 0.19],
  [1.18, 0.32],
  [1.28, 0.47],
  [1.34, 0.6],
  [1.41, 0.665],
  [1.5, 0.68],
];

/** Outer skin of the same moulding, walked back down to the keel. */
const OUTER_HALF: ReadonlyArray<readonly [number, number]> = [
  [1.56, 0.63],
  [1.45, 0.56],
  [1.38, 0.43],
  [1.31, 0.28],
  [1.17, 0.14],
  [0.98, 0.04],
  [0.7, -0.045],
  [0.35, -0.062],
  [0.0, -0.068],
];

function closedShellProfile(): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = INNER_HALF.length - 1; i >= 0; i--) {
    pts.push([-INNER_HALF[i][0], INNER_HALF[i][1]]);
  }
  for (let i = 1; i < INNER_HALF.length; i++) {
    pts.push([INNER_HALF[i][0], INNER_HALF[i][1]]);
  }
  for (const [z, y] of OUTER_HALF) pts.push([z, y]);
  for (let i = OUTER_HALF.length - 2; i >= 0; i--) {
    pts.push([-OUTER_HALF[i][0], OUTER_HALF[i][1]]);
  }
  return pts;
}

/** Just the wetted part of the inner surface, where the water film lives. */
function filmProfile(): Array<[number, number]> {
  const half = INNER_HALF.filter(([z]) => z <= 1.22);
  const pts: Array<[number, number]> = [];
  for (let i = half.length - 1; i >= 1; i--) pts.push([-half[i][0], half[i][1]]);
  for (let i = 0; i < half.length; i++) pts.push([half[i][0], half[i][1]]);
  return pts;
}

export interface SweepOptions {
  from?: number;
  to?: number;
  /** Sample spacing along the course, metres. */
  step?: number;
  closed?: boolean;
  /** Outward offset along the local profile normal, metres. */
  offset?: number;
  /** Texture metres per repeat: [across, along]. */
  uvScale?: [number, number];
}

/**
 * Sweeps a 2D profile along the course centre line. This one function builds
 * the flume shell, the water film and the pools, which is what keeps them
 * perfectly registered with each other and with the physics.
 */
export function sweepProfile(
  spline: CourseSpline,
  profile: ReadonlyArray<readonly [number, number]>,
  options: SweepOptions = {},
): THREE.BufferGeometry {
  const from = options.from ?? 0;
  const to = options.to ?? spline.length;
  const step = options.step ?? 0.5;
  const closed = options.closed ?? false;
  const offset = options.offset ?? 0;
  const [uAcross, vAlong] = options.uvScale ?? [2.4, 3.2];

  const rows = Math.max(2, Math.ceil((to - from) / step) + 1);
  const cols = profile.length;
  const positions = new Float32Array(rows * cols * 3);
  const uvs = new Float32Array(rows * cols * 2);

  // Per-profile-point outward normals, in profile space.
  const pn: Array<[number, number]> = profile.map((_, i) => {
    const prev = profile[Math.max(0, i - 1)];
    const next = profile[Math.min(cols - 1, i + 1)];
    const tx = next[0] - prev[0];
    const ty = next[1] - prev[1];
    const len = Math.hypot(tx, ty) || 1;
    return [-ty / len, tx / len];
  });

  // Arc length across the profile, for the u coordinate.
  const across: number[] = [0];
  for (let i = 1; i < cols; i++) {
    across.push(across[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]));
  }

  const frame = spline.frameAt(from);
  for (let r = 0; r < rows; r++) {
    const s = from + ((to - from) * r) / (rows - 1);
    spline.frameAt(s, frame);
    for (let c = 0; c < cols; c++) {
      const z = profile[c][0] + pn[c][0] * offset;
      const y = profile[c][1] + pn[c][1] * offset;
      const idx = (r * cols + c) * 3;
      positions[idx] = frame.position.x + frame.side.x * z + frame.up.x * y;
      positions[idx + 1] = frame.position.y + frame.side.y * z + frame.up.y * y;
      positions[idx + 2] = frame.position.z + frame.side.z * z + frame.up.z * y;
      const uv = (r * cols + c) * 2;
      uvs[uv] = across[c] / uAcross;
      uvs[uv + 1] = s / vAlong;
    }
  }

  const indices: number[] = [];
  const lastCol = closed ? cols : cols - 1;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < lastCol; c++) {
      const c2 = (c + 1) % cols;
      const a = r * cols + c;
      const b = r * cols + c2;
      const d = (r + 1) * cols + c;
      const e = (r + 1) * cols + c2;
      indices.push(a, d, b, b, d, e);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

export function flumeShellGeometry(spline: CourseSpline): THREE.BufferGeometry {
  return sweepProfile(spline, closedShellProfile(), {
    step: 0.42,
    closed: true,
    uvScale: [2.2, 3.0],
  });
}

export function waterFilmGeometry(spline: CourseSpline): THREE.BufferGeometry {
  return sweepProfile(spline, filmProfile(), {
    step: 0.4,
    offset: 0.018,
    uvScale: [2.0, 2.6],
  });
}

/** Flat water surface filling the channel between two stations. */
export function poolGeometry(
  spline: CourseSpline,
  sFrom: number,
  sTo: number,
  level: number,
  halfWidth = 1.24,
): THREE.BufferGeometry {
  const rows = Math.max(2, Math.ceil((sTo - sFrom) / 0.5) + 1);
  const cols = 5;
  const positions = new Float32Array(rows * cols * 3);
  const uvs = new Float32Array(rows * cols * 2);
  const p = new THREE.Vector3();
  for (let r = 0; r < rows; r++) {
    const s = sFrom + ((sTo - sFrom) * r) / (rows - 1);
    spline.positionAt(s, p);
    for (let c = 0; c < cols; c++) {
      const z = -halfWidth + (2 * halfWidth * c) / (cols - 1);
      const i = (r * cols + c) * 3;
      positions[i] = p.x;
      positions[i + 1] = level;
      positions[i + 2] = z;
      const uv = (r * cols + c) * 2;
      uvs[uv] = (z + halfWidth) / 2.0;
      uvs[uv + 1] = s / 2.6;
    }
  }
  const indices: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = r * cols + c + 1;
      const d = (r + 1) * cols + c;
      const e = (r + 1) * cols + c + 1;
      indices.push(a, d, b, b, d, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Solid plate that closes off the moulding at the end of the course. */
export function endCapGeometry(spline: CourseSpline, s: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const profile = closedShellProfile();
  shape.moveTo(profile[0][0], profile[0][1]);
  for (let i = 1; i < profile.length; i++) shape.lineTo(profile[i][0], profile[i][1]);
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  const frame = spline.frameAt(s);
  const m = new THREE.Matrix4().makeBasis(frame.side, frame.up, frame.tangent);
  m.setPosition(frame.position);
  geo.applyMatrix4(m);
  return geo;
}
