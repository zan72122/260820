import * as THREE from 'three';
import { CourseSpline } from '../course/CourseSpline';
import { RaftDynamics } from './RaftDynamics';
import { rubberMaps } from '../world/Textures';
import { PHYSICS } from '../core/Config';
import { clamp } from '../core/Rng';

const PATH_SAMPLES = 56;
const RING_SEGMENTS = 14;
const HALF_LEN = PHYSICS.RAFT_LENGTH / 2;
const HALF_WID = 0.86;
const CORNER = 0.52;
const TUBE_R = 0.3;

/** Rounded-rectangle centre line of the inflatable ring. */
function ringPath(t: number): { x: number; z: number; nx: number; nz: number } {
  const straightLen = (HALF_LEN - CORNER) * 2;
  const straightWid = (HALF_WID - CORNER) * 2;
  const arc = (Math.PI / 2) * CORNER;
  const total = 2 * straightLen + 2 * straightWid + 4 * arc;
  let d = t * total;

  const seg = (len: number) => {
    const take = Math.min(d, len);
    d -= take;
    return take;
  };

  // Start at the middle of the right (front) edge, run anticlockwise.
  let x = HALF_LEN;
  let z = 0;
  let nx = 1;
  let nz = 0;
  let a = seg(straightWid / 2);
  z += a;
  if (d <= 0) return { x, z, nx, nz };

  a = seg(arc);
  let ang = a / CORNER;
  x = HALF_LEN - CORNER + Math.cos(ang) * CORNER;
  z = HALF_WID - CORNER + Math.sin(ang) * CORNER;
  nx = Math.cos(ang);
  nz = Math.sin(ang);
  if (d <= 0) return { x, z, nx, nz };

  a = seg(straightLen);
  x = HALF_LEN - CORNER - a;
  z = HALF_WID;
  nx = 0;
  nz = 1;
  if (d <= 0) return { x, z, nx, nz };

  a = seg(arc);
  ang = Math.PI / 2 + a / CORNER;
  x = -HALF_LEN + CORNER + Math.cos(ang) * CORNER;
  z = HALF_WID - CORNER + Math.sin(ang) * CORNER;
  nx = Math.cos(ang);
  nz = Math.sin(ang);
  if (d <= 0) return { x, z, nx, nz };

  a = seg(straightWid);
  x = -HALF_LEN;
  z = HALF_WID - CORNER - a;
  nx = -1;
  nz = 0;
  if (d <= 0) return { x, z, nx, nz };

  a = seg(arc);
  ang = Math.PI + a / CORNER;
  x = -HALF_LEN + CORNER + Math.cos(ang) * CORNER;
  z = -HALF_WID + CORNER + Math.sin(ang) * CORNER;
  nx = Math.cos(ang);
  nz = Math.sin(ang);
  if (d <= 0) return { x, z, nx, nz };

  a = seg(straightLen);
  x = -HALF_LEN + CORNER + a;
  z = -HALF_WID;
  nx = 0;
  nz = -1;
  if (d <= 0) return { x, z, nx, nz };

  a = seg(arc);
  ang = (3 * Math.PI) / 2 + a / CORNER;
  x = HALF_LEN - CORNER + Math.cos(ang) * CORNER;
  z = -HALF_WID + CORNER + Math.sin(ang) * CORNER;
  nx = Math.cos(ang);
  nz = Math.sin(ang);
  if (d <= 0) return { x, z, nx, nz };

  a = seg(straightWid / 2);
  x = HALF_LEN;
  z = -HALF_WID + CORNER + a;
  nx = 1;
  nz = 0;
  return { x, z, nx, nz };
}

interface RingVertex {
  base: THREE.Vector3;
  /** Outward direction in the horizontal plane. */
  outward: THREE.Vector3;
  ringAngle: number;
  /** -1 at the tail, +1 at the nose. */
  along: number;
}

/**
 * The raft itself: a moulded rubber ring with a wide flat deck, seams, grab
 * handles, and enough give in the rubber that a jet visibly deforms it.
 */
export class RaftView {
  readonly group = new THREE.Group();
  readonly deckAnchor = new THREE.Object3D();
  private readonly body: THREE.Mesh;
  private readonly wetBand: THREE.Mesh;
  private readonly strake: THREE.Mesh;
  private readonly deck: THREE.Mesh;
  private readonly quat = new THREE.Quaternion();
  private readonly basis = new THREE.Matrix4();
  private readonly pos = new THREE.Vector3();

  constructor() {
    const verts: RingVertex[] = [];
    for (let i = 0; i < PATH_SAMPLES; i++) {
      const t = i / PATH_SAMPLES;
      const p = ringPath(t);
      for (let r = 0; r < RING_SEGMENTS; r++) {
        const a = (r / RING_SEGMENTS) * Math.PI * 2;
        // A moulded seam runs round the outer equator of the tube.
        const seam = Math.exp(-Math.pow((Math.cos(a) - 1) * 6, 2)) * 0.012;
        const rad = TUBE_R + seam;
        const outward = new THREE.Vector3(p.nx, 0, p.nz);
        const base = new THREE.Vector3(
          p.x + outward.x * Math.cos(a) * rad,
          TUBE_R + Math.sin(a) * rad,
          p.z + outward.z * Math.cos(a) * rad,
        );
        verts.push({ base, outward, ringAngle: a, along: clamp(p.x / HALF_LEN, -1, 1) });
      }
    }

    const makeGeometry = (filter: (v: RingVertex) => boolean): THREE.BufferGeometry => {
      const positions = new Float32Array(verts.length * 3);
      const uvs = new Float32Array(verts.length * 2);
      const load = new Float32Array(verts.length * 3);
      const jet = new Float32Array(verts.length * 3);
      for (let i = 0; i < verts.length; i++) {
        const v = verts[i];
        positions[i * 3] = v.base.x;
        positions[i * 3 + 1] = v.base.y;
        positions[i * 3 + 2] = v.base.z;
        const pathT = Math.floor(i / RING_SEGMENTS) / PATH_SAMPLES;
        uvs[i * 2] = pathT * 4;
        uvs[i * 2 + 1] = (v.ringAngle / (Math.PI * 2)) * 1.4;

        // Loaded: the tube squats and spreads, the whole hull sits lower.
        load[i * 3] = v.outward.x * 0.035;
        load[i * 3 + 1] = -0.075 - Math.max(0, Math.sin(v.ringAngle)) * 0.05;
        load[i * 3 + 2] = v.outward.z * 0.035;

        // Jet: the tail is pressed in and the nose lifts a little.
        const tail = clamp(-v.along, 0, 1);
        const nose = clamp(v.along, 0, 1);
        jet[i * 3] = tail * 0.14 - nose * 0.02;
        jet[i * 3 + 1] = tail * 0.03 + nose * 0.025;
        jet[i * 3 + 2] = -v.outward.z * tail * 0.05;
      }

      const indices: number[] = [];
      for (let i = 0; i < PATH_SAMPLES; i++) {
        const i2 = (i + 1) % PATH_SAMPLES;
        for (let r = 0; r < RING_SEGMENTS; r++) {
          const r2 = (r + 1) % RING_SEGMENTS;
          const a = i * RING_SEGMENTS + r;
          const b = i * RING_SEGMENTS + r2;
          const c = i2 * RING_SEGMENTS + r;
          const d = i2 * RING_SEGMENTS + r2;
          if (!filter(verts[a]) || !filter(verts[b]) || !filter(verts[c]) || !filter(verts[d])) continue;
          indices.push(a, c, b, b, c, d);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.morphAttributes.position = [
        new THREE.BufferAttribute(addArrays(positions, load), 3),
        new THREE.BufferAttribute(addArrays(positions, jet), 3),
      ];
      geo.morphTargetsRelative = false;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      return geo;
    };

    const maps = rubberMaps();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xeeefe8,
      roughness: 0.62,
      metalness: 0.0,
      map: maps.map,
      roughnessMap: maps.roughnessMap,
      normalMap: maps.normalMap,
      envMapIntensity: 0.75,
    });
    bodyMat.normalScale.set(0.7, 0.7);

    this.body = new THREE.Mesh(makeGeometry(() => true), bodyMat);
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.group.add(this.body);

    // The band that rides in the water reads permanently wet.
    const wetMat = new THREE.MeshStandardMaterial({
      color: 0xbcc5c6,
      roughness: 0.11,
      metalness: 0.0,
      map: maps.map,
      normalMap: maps.normalMap,
      envMapIntensity: 1.5,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.wetBand = new THREE.Mesh(
      makeGeometry((v) => Math.sin(v.ringAngle) < -0.12),
      wetMat,
    );
    this.group.add(this.wetBand);

    // Moulded rubbing strake right round the outside of the tube. It is what
    // makes a white raft read against a white flume from any distance.
    const strakeMat = new THREE.MeshStandardMaterial({
      color: 0x2f3a40,
      roughness: 0.58,
      metalness: 0.0,
      map: maps.map,
      normalMap: maps.normalMap,
      envMapIntensity: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.strake = new THREE.Mesh(
      makeGeometry((v) => Math.cos(v.ringAngle) > 0.945 && Math.sin(v.ringAngle) > -0.3),
      strakeMat,
    );
    this.strake.castShadow = true;
    this.group.add(this.strake);

    // Wide flat cargo deck: the target a child drags ballast onto.
    const deckGeo = new THREE.BoxGeometry(HALF_LEN * 1.55, 0.055, HALF_WID * 1.35);
    deckGeo.translate(0, 0.2, 0);
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x59646b,
      roughness: 0.62,
      metalness: 0,
      map: maps.map,
      normalMap: maps.normalMap,
      envMapIntensity: 0.8,
    });
    this.deck = new THREE.Mesh(deckGeo, deckMat);
    this.deck.castShadow = true;
    this.deck.receiveShadow = true;
    this.group.add(this.deck);

    // Grab handles, moulded on both sides.
    const handleGeo = new THREE.TorusGeometry(0.1, 0.024, 6, 12, Math.PI);
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x3a4348,
      roughness: 0.55,
      metalness: 0.05,
    });
    for (const sx of [-0.62, 0.62]) {
      for (const sz of [-1, 1]) {
        const h = new THREE.Mesh(handleGeo, handleMat);
        h.position.set(sx, 0.42, sz * (HALF_WID + 0.16));
        h.rotation.set(Math.PI / 2, 0, sz > 0 ? 0 : Math.PI);
        h.castShadow = true;
        this.group.add(h);
      }
    }

    this.deckAnchor.position.set(0, 0.23, 0);
    this.group.add(this.deckAnchor);
  }

  /** Deck surface in world space, for ballast snapping. */
  deckPoint(out = new THREE.Vector3()): THREE.Vector3 {
    return out.setFromMatrixPosition(this.deckAnchor.matrixWorld);
  }

  update(spline: CourseSpline, raft: RaftDynamics): void {
    const frame = spline.frameAt(raft.s);
    this.pos
      .copy(frame.position)
      .addScaledVector(frame.up, 0.055 + raft.bob)
      .addScaledVector(frame.side, raft.sway);
    this.group.position.copy(this.pos);

    this.basis.makeBasis(frame.tangent, frame.up, frame.side);
    this.quat.setFromRotationMatrix(this.basis);
    // A little extra nose-up while the water is pushing; never any roll.
    const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), raft.pitch);
    this.group.quaternion.copy(this.quat).multiply(pitch);

    const influences = [raft.loadSquash, raft.jetSquash];
    for (const mesh of [this.body, this.wetBand, this.strake]) {
      if (mesh.morphTargetInfluences) {
        mesh.morphTargetInfluences[0] = influences[0];
        mesh.morphTargetInfluences[1] = influences[1];
      }
    }
    this.deck.position.y = -raft.loadSquash * 0.06;
  }

  /** World point at the tail, where the jets land. */
  tailPoint(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(-HALF_LEN * 0.95, 0.22, 0).applyMatrix4(this.group.matrixWorld);
  }

  /** World point at the nose, where the raft pushes foam ahead of itself. */
  nosePoint(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(HALF_LEN * 0.98, 0.1, 0).applyMatrix4(this.group.matrixWorld);
  }
}

function addArrays(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] + b[i];
  return out;
}
