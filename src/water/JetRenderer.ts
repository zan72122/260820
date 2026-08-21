import * as THREE from 'three';
import { BlastZone } from '../course/BlastZone';
import { NozzleInstance } from '../course/NozzleBank';
import { clamp, smoothstep } from '../core/Rng';

export interface JetQuality {
  rings: number;
  segments: number;
  sleeve: boolean;
}

/**
 * High-flow jets. Not a mist: a continuous water column with a dense core,
 * a foaming sleeve around it, and a tip that stops exactly where the water
 * meets the raft so the contact point is never lost.
 */
export class JetRenderer {
  readonly group = new THREE.Group();
  private readonly core: THREE.Mesh;
  private readonly sleeve: THREE.Mesh | null;
  private readonly rings: number;
  private readonly segments: number;
  private readonly corePos: Float32Array;
  private readonly coreCol: Float32Array;
  private readonly sleevePos: Float32Array | null;
  private readonly sleeveCol: Float32Array | null;
  private time = 0;
  /** World-space points where jets are currently hitting the raft. */
  readonly contacts: THREE.Vector3[] = [];

  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly nrm = new THREE.Vector3();
  private readonly bin = new THREE.Vector3();
  private readonly tan = new THREE.Vector3();

  constructor(
    private readonly instances: NozzleInstance[],
    private readonly blast: BlastZone,
    quality: JetQuality,
  ) {
    this.rings = quality.rings;
    this.segments = quality.segments;
    const count = instances.length;
    const vertsPerJet = this.rings * this.segments;

    const buildGeometry = (): { geo: THREE.BufferGeometry; pos: Float32Array; col: Float32Array } => {
      const pos = new Float32Array(count * vertsPerJet * 3);
      const col = new Float32Array(count * vertsPerJet * 4);
      const idx: number[] = [];
      for (let j = 0; j < count; j++) {
        const base = j * vertsPerJet;
        for (let r = 0; r < this.rings - 1; r++) {
          for (let s = 0; s < this.segments; s++) {
            const s2 = (s + 1) % this.segments;
            const a = base + r * this.segments + s;
            const b = base + r * this.segments + s2;
            const c = base + (r + 1) * this.segments + s;
            const d = base + (r + 1) * this.segments + s2;
            idx.push(a, c, b, b, c, d);
          }
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
      geo.setIndex(idx);
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(30, 4, 0), 60);
      return { geo, pos, col };
    };

    const coreParts = buildGeometry();
    this.corePos = coreParts.pos;
    this.coreCol = coreParts.col;
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xf2fbff,
      roughness: 0.09,
      metalness: 0.0,
      transparent: true,
      vertexColors: true,
      depthWrite: false,
      envMapIntensity: 1.9,
      side: THREE.DoubleSide,
    });
    this.core = new THREE.Mesh(coreParts.geo, coreMat);
    this.core.renderOrder = 6;
    this.core.frustumCulled = false;
    this.group.add(this.core);

    if (quality.sleeve) {
      const sleeveParts = buildGeometry();
      this.sleevePos = sleeveParts.pos;
      this.sleeveCol = sleeveParts.col;
      const sleeveMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        vertexColors: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.sleeve = new THREE.Mesh(sleeveParts.geo, sleeveMat);
      this.sleeve.renderOrder = 5;
      this.sleeve.frustumCulled = false;
      this.group.add(this.sleeve);
    } else {
      this.sleeve = null;
      this.sleevePos = null;
      this.sleeveCol = null;
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.contacts.length = 0;
    const vertsPerJet = this.rings * this.segments;

    for (let j = 0; j < this.instances.length; j++) {
      const inst = this.instances[j];
      const n = this.blast.nozzles[inst.station];
      const flow = n.supplied ? n.flow : 0;
      const length = flow > 0.02 ? n.throwLength : 0;
      const base = j * vertsPerJet;

      if (flow <= 0.02 || length <= 0.05) {
        // Collapse the jet to a point rather than paying for a branch later.
        for (let v = 0; v < vertsPerJet; v++) {
          const p = (base + v) * 3;
          this.corePos[p] = inst.position.x;
          this.corePos[p + 1] = inst.position.y;
          this.corePos[p + 2] = inst.position.z;
          const c = (base + v) * 4;
          this.coreCol[c + 3] = 0;
          if (this.sleevePos && this.sleeveCol) {
            this.sleevePos[p] = inst.position.x;
            this.sleevePos[p + 1] = inst.position.y;
            this.sleevePos[p + 2] = inst.position.z;
            this.sleeveCol[c + 3] = 0;
          }
        }
        continue;
      }

      const speed = 9.5 + 9 * flow;
      const droop = (0.5 * 9.81) / (speed * speed);
      const wobble = Math.sin(this.time * 26 + j * 1.7) * 0.006 * flow;
      const radius = (0.046 + 0.022 * flow) * (1 + wobble * 4);

      if (n.hitsRaft) {
        this.tmpB
          .copy(inst.position)
          .addScaledVector(inst.direction, length)
          .addScaledVector(UP, -droop * length * length);
        this.contacts.push(this.tmpB.clone());
      }

      for (let r = 0; r < this.rings; r++) {
        const u = r / (this.rings - 1);
        const d = u * length;
        // Ballistic centre line, so the water arcs onto the raft's tail.
        this.tmpA
          .copy(inst.position)
          .addScaledVector(inst.direction, d)
          .addScaledVector(UP, -droop * d * d);

        // Frame: derivative of the same curve.
        this.tan.copy(inst.direction).addScaledVector(UP, -2 * droop * d).normalize();
        this.nrm.copy(this.tan).cross(UP);
        if (this.nrm.lengthSq() < 1e-6) this.nrm.set(0, 0, 1);
        this.nrm.normalize();
        this.bin.copy(this.tan).cross(this.nrm).normalize();

        // A jet swells slightly then breaks up; the tip only tapers when the
        // water is flying free rather than landing on rubber.
        const swell = 1 + u * 0.22;
        const breakUp = n.hitsRaft ? 1 : 1 - smoothstep(0.55, 1, u) * 0.55;
        const rr = radius * swell * breakUp * (0.45 + 0.55 * flow);
        const alphaCore = clamp((0.55 + 0.45 * flow) * (n.hitsRaft ? 1 : breakUp), 0, 1);

        for (let s = 0; s < this.segments; s++) {
          const a = (s / this.segments) * Math.PI * 2;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const idx = base + r * this.segments + s;
          const p = idx * 3;
          this.corePos[p] = this.tmpA.x + (this.nrm.x * ca + this.bin.x * sa) * rr;
          this.corePos[p + 1] = this.tmpA.y + (this.nrm.y * ca + this.bin.y * sa) * rr;
          this.corePos[p + 2] = this.tmpA.z + (this.nrm.z * ca + this.bin.z * sa) * rr;
          const c = idx * 4;
          this.coreCol[c] = 1;
          this.coreCol[c + 1] = 1;
          this.coreCol[c + 2] = 1;
          this.coreCol[c + 3] = alphaCore;

          if (this.sleevePos && this.sleeveCol) {
            const foam = rr * (1.75 + Math.sin(this.time * 18 + r * 2.1 + s) * 0.12);
            this.sleevePos[p] = this.tmpA.x + (this.nrm.x * ca + this.bin.x * sa) * foam;
            this.sleevePos[p + 1] = this.tmpA.y + (this.nrm.y * ca + this.bin.y * sa) * foam;
            this.sleevePos[p + 2] = this.tmpA.z + (this.nrm.z * ca + this.bin.z * sa) * foam;
            this.sleeveCol[c] = 1;
            this.sleeveCol[c + 1] = 1;
            this.sleeveCol[c + 2] = 1;
            this.sleeveCol[c + 3] = 0.16 * flow * (0.35 + u * 0.65);
          }
        }
      }
    }

    (this.core.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.core.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    if (this.sleeve) {
      (this.sleeve.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (this.sleeve.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }
  }
}

const UP = new THREE.Vector3(0, 1, 0);
