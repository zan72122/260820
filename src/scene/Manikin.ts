import * as THREE from 'three';
import { clamp01, lerp, smoothstep } from '../util/math';
import { lumenAt, turbulenceAt } from '../core/TrainingArmReveal';
import { LAYOUT } from './layout';
import type { Materials } from './Materials';
import { buildLimb, buildLimbPatch, type LimbHole } from './geometry';

const ARM_X0 = 0.02;
const ARM_X1 = 1.02;

/** Radius of the arm module along its length. Not a smooth taper: a limb. */
export const armProfile = (u: number): number => {
  if (u < 0.05) return lerp(0.084, 0.066, smoothstep(0, 0.05, u));
  if (u < 0.085) return lerp(0.066, 0.0615, smoothstep(0.05, 0.085, u)) - 0.0025;
  if (u < 0.46) return lerp(0.062, 0.0525, smoothstep(0.085, 0.46, u));
  if (u < 0.56)
    return 0.0525 + Math.sin((u - 0.46) / 0.1 * Math.PI) * 0.0035 - (u - 0.46) * 0.03;
  if (u < 0.84) return lerp(0.0475, 0.0335, smoothstep(0.56, 0.84, u));
  return lerp(0.0335, 0.0295, smoothstep(0.84, 1, u));
};

/** The inspection slot sits directly under the middle of the cuff. */
const SLOT: LimbHole = { u0: 0.238, u1: 0.322, halfAngle: 0.86 };

const limbOpts = {
  x0: ARM_X0,
  x1: ARM_X1,
  segsX: 108,
  segsR: 30,
  profile: armProfile,
  squashZ: 0.94,
  centreY: LAYOUT.armY,
  centreZ: LAYOUT.armZ,
  hole: SLOT,
};

export interface ManikinState {
  cuffTension: number;
  cuffPressure: number;
  chestpiecePos: THREE.Vector3 | null;
  contact: number;
  exposure: number;
  beatPhase: number;
  pulse: number;
  lowQuality: boolean;
}

/**
 * The training manikin: a skills simulator, not a person. Part lines, a
 * replaceable arm module and a moulded synthetic skin are all visible, and the
 * face is left as a plain moulded form because the render budget belongs to the
 * equipment.
 */
export class ManikinRig {
  readonly group = new THREE.Group();
  /** World position of the middle of the antecubital acceptance region. */
  readonly fossa = LAYOUT.fossa.clone();

  private armMesh!: THREE.Mesh;
  private armBase!: Float32Array;
  private armUs!: Float32Array;
  private armAngles!: Float32Array;
  private skinPatch!: THREE.Mesh;
  private skinPatchMat!: THREE.MeshStandardMaterial;
  private moduleInterior!: THREE.Mesh;
  private vessel!: THREE.Mesh;
  private vesselBase!: Float32Array;
  private vesselRing!: Int32Array;
  private vesselX!: Float32Array;
  private interiorLight!: THREE.PointLight;
  private flow!: THREE.Points;
  private flowBase!: Float32Array;
  private flowPhase!: Float32Array;
  private flowMat!: THREE.PointsMaterial;
  private chestTwitch = 0;
  private moduleBox!: THREE.Mesh;
  private lastDeform = { tension: -1, contact: -1, u: -1 };

  constructor(private mats: Materials) {
    this.buildCouch();
    this.buildTorso();
    this.buildArm();
    this.buildModule();
  }

  /* ------------------------------------------------------------- couch --- */

  private buildCouch(): void {
    const m = this.mats;
    const couch = new THREE.Group();
    const pad = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.11, 0.68), m.couchVinyl);
    pad.position.set(-0.05, LAYOUT.couchTop - 0.055, 0);
    pad.castShadow = true;
    pad.receiveShadow = true;
    couch.add(pad);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.06, 0.64), m.steelFrame);
    frame.position.set(-0.05, LAYOUT.couchTop - 0.14, 0);
    couch.add(frame);

    for (const dx of [-0.92, 0.78]) {
      for (const dz of [-0.26, 0.26]) {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.018, LAYOUT.couchTop - 0.17, 8),
          m.steelFrame,
        );
        leg.position.set(-0.05 + dx, (LAYOUT.couchTop - 0.17) / 2, dz);
        leg.castShadow = true;
        couch.add(leg);
      }
    }
    const shadow = m.makeShadowPatch(2.3, 0.95);
    shadow.position.set(-0.05, 0.005, 0);
    couch.add(shadow);

    // Small arm support the module rests on, so nothing hovers.
    const support = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.085, 0.5, 20),
      m.couchVinyl,
    );
    support.rotation.z = Math.PI / 2;
    support.position.set(0.72, LAYOUT.armY - 0.055, LAYOUT.armZ);
    support.castShadow = true;
    support.receiveShadow = true;
    couch.add(support);

    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xbfbeb6, roughness: 0.97 }),
    );
    paper.rotation.x = -Math.PI / 2;
    paper.position.set(-0.2, LAYOUT.couchTop + 0.001, 0.02);
    paper.receiveShadow = true;
    couch.add(paper);

    this.group.add(couch);
  }

  /* ------------------------------------------------------------ torso ---- */

  private buildTorso(): void {
    const m = this.mats;
    const torso = new THREE.Group();

    const chest = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.17, 0.34, 6, 20),
      m.skin,
    );
    chest.rotation.z = Math.PI / 2;
    chest.scale.set(1, 1, 0.78);
    chest.position.set(-0.36, LAYOUT.couchTop + 0.15, 0.0);
    chest.castShadow = true;
    chest.receiveShadow = true;
    torso.add(chest);

    // Part line where the chest plate meets the shoulder block.
    const seam = new THREE.Mesh(
      new THREE.TorusGeometry(0.171, 0.0022, 6, 30),
      m.skinSeam,
    );
    seam.rotation.y = Math.PI / 2;
    seam.scale.set(1, 0.78, 1);
    seam.position.set(-0.16, LAYOUT.couchTop + 0.15, 0);
    torso.add(seam);

    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.062, 0.08, 16),
      m.skin,
    );
    neck.rotation.z = Math.PI / 2;
    neck.position.set(-0.6, LAYOUT.couchTop + 0.14, 0);
    torso.add(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.095, 20, 16), m.skin);
    head.scale.set(1.18, 1, 0.86);
    head.position.set(-0.73, LAYOUT.couchTop + 0.135, 0);
    head.castShadow = true;
    torso.add(head);

    // The pulse module lives in the chest; its motion is the opening puzzle.
    const port = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.006, 18),
      m.steelSatin,
    );
    port.rotation.x = Math.PI / 2;
    port.position.set(-0.36, LAYOUT.couchTop + 0.315, 0.02);
    torso.add(port);
    const diaphragmPlate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.004, 18),
      m.elastomerRim,
    );
    diaphragmPlate.rotation.x = Math.PI / 2;
    diaphragmPlate.position.set(-0.36, LAYOUT.couchTop + 0.317, 0.021);
    torso.add(diaphragmPlate);
    this.moduleBox = diaphragmPlate;

    const gown = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.02, 0.42),
      new THREE.MeshStandardMaterial({ color: 0xa9bcc0, roughness: 0.92 }),
    );
    gown.position.set(-0.55, LAYOUT.couchTop + 0.3, -0.03);
    gown.rotation.z = 0.03;
    torso.add(gown);

    this.group.add(torso);
  }

  /* -------------------------------------------------------------- arm ---- */

  private buildArm(): void {
    const m = this.mats;
    const limb = buildLimb(limbOpts);
    this.armBase = limb.base;
    this.armUs = limb.us;
    this.armAngles = limb.angles;
    this.armMesh = new THREE.Mesh(limb.geometry, m.skin);
    this.armMesh.castShadow = true;
    this.armMesh.receiveShadow = true;
    this.group.add(this.armMesh);

    // Shoulder ball: closes the end of the module and seats into the torso.
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.085, 22, 16), m.skin);
    shoulder.scale.set(1.05, 1, 0.94);
    shoulder.position.set(ARM_X0 - 0.016, LAYOUT.armY + 0.004, LAYOUT.armZ);
    shoulder.castShadow = true;
    shoulder.receiveShadow = true;
    this.group.add(shoulder);

    // Module joint ring: this arm unclips from the torso.
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.0635, 0.0035, 8, 32),
      m.steelSatin,
    );
    ring.rotation.y = Math.PI / 2;
    ring.scale.set(0.94, 1, 1);
    ring.position.set(ARM_X0 + 0.085 * (ARM_X1 - ARM_X0), LAYOUT.armY, LAYOUT.armZ);
    this.group.add(ring);

    // Hand: a closed, relaxed moulded form. No finger detail is needed here.
    const hand = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.05, 4, 14), m.skin);
    hand.rotation.z = Math.PI / 2;
    hand.scale.set(1, 1, 0.72);
    hand.position.set(1.06, LAYOUT.armY - 0.002, LAYOUT.armZ);
    hand.castShadow = true;
    this.group.add(hand);
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.0085, 0.032, 3, 8),
        m.skin,
      );
      finger.rotation.z = Math.PI / 2 - 0.35;
      finger.position.set(1.115, LAYOUT.armY - 0.018, LAYOUT.armZ - 0.024 + i * 0.016);
      this.group.add(finger);
    }
  }

  /* ---------------------------------------------------------- module ----- */

  private buildModule(): void {
    const m = this.mats;

    // Dark casing behind the aperture so the arm does not read as hollow.
    const casing = buildLimb({
      ...limbOpts,
      segsX: 40,
      segsR: 20,
      profile: (u) => armProfile(u) - 0.02,
      hole: undefined,
    });
    this.moduleInterior = new THREE.Mesh(
      casing.geometry,
      new THREE.MeshStandardMaterial({
        color: 0x1b1e21,
        roughness: 0.8,
        metalness: 0.08,
        side: THREE.BackSide,
      }),
    );
    this.group.add(this.moduleInterior);

    // Vessel: a translucent training tube running the length of the module.
    const segsX = 72;
    const segsR = 14;
    const vx0 = 0.12;
    const vx1 = 0.66;
    const radius = 0.008;
    const vy = LAYOUT.armY + 0.031;
    const vz = LAYOUT.armZ + 0.004;
    const vCount = (segsX + 1) * (segsR + 1);
    const pos = new Float32Array(vCount * 3);
    const uv = new Float32Array(vCount * 2);
    this.vesselRing = new Int32Array(vCount);
    this.vesselX = new Float32Array(segsX + 1);
    for (let i = 0; i <= segsX; i++) {
      const t = i / segsX;
      const x = lerp(vx0, vx1, t);
      this.vesselX[i] = x;
      for (let j = 0; j <= segsR; j++) {
        const a = (j / segsR) * Math.PI * 2;
        const idx = i * (segsR + 1) + j;
        pos[idx * 3] = x;
        pos[idx * 3 + 1] = vy + Math.cos(a) * radius;
        pos[idx * 3 + 2] = vz + Math.sin(a) * radius;
        uv[idx * 2] = t;
        uv[idx * 2 + 1] = j / segsR;
        this.vesselRing[idx] = i;
      }
    }
    const idxs: number[] = [];
    for (let i = 0; i < segsX; i++) {
      for (let j = 0; j < segsR; j++) {
        const a0 = i * (segsR + 1) + j;
        const b0 = a0 + 1;
        const c0 = a0 + segsR + 1;
        const d0 = c0 + 1;
        idxs.push(a0, b0, c0, b0, d0, c0);
      }
    }
    const vg = new THREE.BufferGeometry();
    vg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    vg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    vg.setIndex(idxs);
    vg.computeVertexNormals();
    this.vesselBase = pos.slice();
    this.vessel = new THREE.Mesh(vg, m.vesselWall);
    this.vessel.visible = false;
    this.group.add(this.vessel);

    // Flow markers inside the vessel: they crowd and scatter at the pinch.
    const n = 150;
    const fpos = new Float32Array(n * 3);
    this.flowBase = new Float32Array(n * 3);
    this.flowPhase = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      this.flowPhase[i] = t;
      const ring = ((i * 7919) % 97) / 97;
      const a = ring * Math.PI * 2;
      const rr = radius * 0.55 * (0.35 + ((i * 104729) % 61) / 61);
      this.flowBase[i * 3] = 0;
      this.flowBase[i * 3 + 1] = Math.cos(a) * rr;
      this.flowBase[i * 3 + 2] = Math.sin(a) * rr;
      fpos[i * 3] = lerp(vx0, vx1, t);
      fpos[i * 3 + 1] = vy;
      fpos[i * 3 + 2] = vz;
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
    this.flowMat = new THREE.PointsMaterial({
      size: 0.0055,
      color: 0xf0dcd6,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.flow = new THREE.Points(fg, this.flowMat);
    this.flow.visible = false;
    this.group.add(this.flow);

    // Acrylic pane sitting flush in the aperture, plus its machined bezel.
    const pane = new THREE.Mesh(buildLimbPatch(limbOpts, -0.0015), m.acrylic);
    this.group.add(pane);

    const bezel = new THREE.Mesh(
      new THREE.TorusGeometry(0.036, 0.0022, 6, 32),
      m.steelSatin,
    );
    bezel.rotation.x = Math.PI / 2;
    bezel.scale.set(1.0, 0.8, 1.0);
    bezel.position.set(
      ARM_X0 + ((SLOT.u0 + SLOT.u1) / 2) * (ARM_X1 - ARM_X0),
      LAYOUT.armY + armProfile((SLOT.u0 + SLOT.u1) / 2) - 0.004,
      LAYOUT.armZ,
    );
    this.group.add(bezel);

    // The skin patch that normally covers the pane and fades away on reveal.
    this.skinPatchMat = new THREE.MeshStandardMaterial({
      map: m.skin.map,
      normalMap: m.skin.normalMap,
      roughnessMap: m.skin.roughnessMap,
      roughness: 0.86,
      metalness: 0,
      transparent: true,
      opacity: 1,
    });
    this.skinPatch = new THREE.Mesh(buildLimbPatch(limbOpts, 0.0002), this.skinPatchMat);
    this.group.add(this.skinPatch);

    this.interiorLight = new THREE.PointLight(0xd6ecf7, 0, 0.3, 1.6);
    this.interiorLight.position.set(
      ARM_X0 + ((SLOT.u0 + SLOT.u1) / 2) * (ARM_X1 - ARM_X0),
      LAYOUT.armY + 0.02,
      LAYOUT.armZ + 0.01,
    );
    this.group.add(this.interiorLight);
  }

  /* ----------------------------------------------------------- update ---- */

  update(s: ManikinState, dt: number): void {
    this.deformArm(s);
    this.updateModule(s, dt);
    // The pulse module's own faceplate twitches; visible before any sound.
    this.chestTwitch = s.pulse;
    const k = 1 + this.chestTwitch * 0.06;
    this.moduleBox.scale.set(k, 1, k);
    this.moduleBox.position.z = 0.021 + this.chestTwitch * 0.0016;
  }

  private deformArm(s: ManikinState): void {
    const contactU = s.chestpiecePos
      ? clamp01((s.chestpiecePos.x - ARM_X0) / (ARM_X1 - ARM_X0))
      : -1;
    // Rewriting and re-normalling 3k vertices is only worth doing when the
    // cuff or the chestpiece has actually moved.
    const d = this.lastDeform;
    if (
      Math.abs(d.tension - s.cuffTension) < 2e-4 &&
      Math.abs(d.contact - s.contact) < 2e-4 &&
      Math.abs(d.u - contactU) < 2e-4
    ) {
      return;
    }
    d.tension = s.cuffTension;
    d.contact = s.contact;
    d.u = contactU;

    const attr = this.armMesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const base = this.armBase;
    const cuffU0 = 0.208;
    const cuffU1 = 0.352;
    const contactLocal = s.chestpiecePos
      ? {
          u: clamp01((s.chestpiecePos.x - ARM_X0) / (ARM_X1 - ARM_X0)),
          strength: s.contact,
        }
      : null;

    for (let i = 0; i < this.armUs.length; i++) {
      const u = this.armUs[i];
      const a = this.armAngles[i];
      let inset = 0;

      // Woven shell pressing the synthetic tissue in, strongest mid-band.
      if (u > cuffU0 - 0.03 && u < cuffU1 + 0.03) {
        const band = smoothstep(cuffU0 - 0.03, cuffU0 + 0.01, u) *
          (1 - smoothstep(cuffU1 - 0.01, cuffU1 + 0.03, u));
        inset += band * s.cuffTension * 0.0075;
      }
      // Local dimple where the chestpiece rim sits.
      if (contactLocal && contactLocal.strength > 0.01) {
        const du = Math.abs(u - contactLocal.u);
        const dimple =
          (1 - smoothstep(0, 0.05, du)) * (1 - smoothstep(0, 0.85, Math.abs(a)));
        inset += dimple * contactLocal.strength * 0.0055;
      }

      if (inset === 0) {
        arr[i * 3 + 1] = base[i * 3 + 1];
        arr[i * 3 + 2] = base[i * 3 + 2];
        continue;
      }
      const cy = Math.cos(a);
      const sz = Math.sin(a);
      arr[i * 3 + 1] = base[i * 3 + 1] - cy * inset;
      arr[i * 3 + 2] = base[i * 3 + 2] - sz * inset * 0.94;
    }
    attr.needsUpdate = true;
    this.armMesh.geometry.computeVertexNormals();
  }

  private updateModule(s: ManikinState, dt: number): void {
    const visible = s.exposure > 0.02;
    this.vessel.visible = visible;
    this.flow.visible = visible && !s.lowQuality;
    this.moduleInterior.visible = true;
    this.skinPatchMat.opacity = 1 - smoothstep(0.05, 0.85, s.exposure);
    this.skinPatch.visible = this.skinPatchMat.opacity > 0.005;
    this.interiorLight.intensity = s.exposure * 1.5;
    if (!visible) return;

    // Vessel cross-section: pinched flat under the cuff, round elsewhere.
    const attr = this.vessel.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const base = this.vesselBase;
    const vy = LAYOUT.armY + 0.031;
    const vz = LAYOUT.armZ + 0.004;
    const lumen = lumenAt(s.cuffPressure, s.beatPhase);
    for (let i = 0; i < this.vesselRing.length; i++) {
      const ring = this.vesselRing[i];
      const x = this.vesselX[ring];
      const under =
        smoothstep(0.2, 0.245, x) * (1 - smoothstep(0.355, 0.4, x));
      const l = lerp(1, lumen, under * clamp01(s.cuffTension * 1.6));
      const sy = 0.1 + 0.9 * l;
      const sz2 = 1 + (1 - l) * 0.55;
      arr[i * 3 + 1] = vy + (base[i * 3 + 1] - vy) * sy;
      arr[i * 3 + 2] = vz + (base[i * 3 + 2] - vz) * sz2;
    }
    attr.needsUpdate = true;
    this.vessel.geometry.computeVertexNormals();

    if (this.flow.visible) {
      const turb = turbulenceAt(lumen);
      const fattr = this.flow.geometry.getAttribute('position') as THREE.BufferAttribute;
      const farr = fattr.array as Float32Array;
      const speed = (0.06 + lumen * 0.5) * dt;
      for (let i = 0; i < this.flowPhase.length; i++) {
        this.flowPhase[i] += speed;
        if (this.flowPhase[i] > 1) this.flowPhase[i] -= 1;
        const t = this.flowPhase[i];
        const x = lerp(0.12, 0.66, t);
        const under = smoothstep(0.2, 0.245, x) * (1 - smoothstep(0.355, 0.4, x));
        const l = lerp(1, lumen, under * clamp01(s.cuffTension * 1.6));
        // Deterministic scatter downstream of the constriction.
        const jitter =
          turb * under * Math.sin(t * 61 + i * 2.399) * 0.0026 * smoothstep(0.28, 0.4, x);
        farr[i * 3] = x;
        farr[i * 3 + 1] = vy + this.flowBase[i * 3 + 1] * (0.15 + 0.85 * l) + jitter;
        farr[i * 3 + 2] =
          vz + this.flowBase[i * 3 + 2] * (1 + (1 - l) * 0.5) + jitter * 0.7;
      }
      fattr.needsUpdate = true;
      this.flowMat.opacity = 0.85 * s.exposure;
    }
  }
}
