import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { MaterialKit } from './materials';
import {
  SEG_LEN, SEG_COUNT, BEAM_W, BEAM_H, BEAM_TOP_Y, BEAM_BOT_Y,
  girderHeading, jointPos, guideCurve, driveUnits, crankAngle, trolleys,
  DriveUnitSpec, TrolleySpec,
} from '../game/switchModel';

/**
 * Visual + kinematic assembly of the articulated turnout. Every moving part
 * is driven from the single articulation parameter t (0 = straight route,
 * 1 = curved route), the same value that generates the ride paths.
 */

const SKIN_SAMPLES = 48;
const SKIN_OFFSET = 0.028;             // flex bands sit proud of the box webs
const GAP = 0.05;                      // visible joint gap between girders
const LOCK_OX = 0.92;                  // lock cylinder outboard of the frame
const LOCK_OZ = 0.55;

export class SwitchAssembly {
  readonly group = new THREE.Group();
  readonly girders: THREE.Group[] = [];
  readonly trolleyGroups: THREE.Group[] = [];
  readonly lockRods: THREE.Mesh[] = [];
  readonly crankArms: THREE.Group[] = [];
  readonly motorSpinners: THREE.Mesh[] = [];
  /** world-space focus points for the camera director */
  readonly focus = {
    heel: new THREE.Vector3(0, 1.2, 0),
    mid: new THREE.Vector3(0, 1.2, SEG_COUNT * SEG_LEN * 0.55),
    tipLock: new THREE.Vector3(),
    drive: new THREE.Vector3(),
  };

  private skins: { mesh: THREE.Mesh; side: 1 | -1; y0: number; y1: number }[] = [];
  private driveSpecs: DriveUnitSpec[];
  private trolleySpecs: TrolleySpec[];
  private wheelSpin = 0;
  private lastT = 0;
  /** lock extension 0 = raised (unlocked), 1 = seated */
  lockExt = 1;
  t = 1; // articulation parameter — game starts on the curved route

  constructor(private mats: MaterialKit) {
    this.driveSpecs = driveUnits();
    this.trolleySpecs = trolleys();
    this.buildGirders();
    this.buildSkins();
    this.buildHeel();
    this.buildTrolleys();
    this.buildRailsAndPlates();
    this.buildDriveUnits();
    this.update(this.t, 0);
  }

  // -- girder box bodies ----------------------------------------------------
  private buildGirders(): void {
    const m = this.mats;
    for (let k = 0; k < SEG_COUNT; k++) {
      const g = new THREE.Group();
      const len = SEG_LEN - GAP;

      const box = new THREE.BoxGeometry(BEAM_W, BEAM_H, len);
      box.translate(0, BEAM_BOT_Y + BEAM_H / 2, len / 2 + GAP / 2);
      const boxMats = [
        m.beamPaint, m.beamPaint,        // +x / -x webs
        m.runningSurface, m.beamPaint,   // top / bottom
        m.beamPaint, m.beamPaint,        // ends
      ];
      const body = new THREE.Mesh(box, boxMats);
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);

      // bottom flange edge (the webs stay smooth behind the flex bands)
      const flange = new THREE.BoxGeometry(BEAM_W + 0.08, 0.06, len);
      flange.translate(0, BEAM_BOT_Y + 0.03, len / 2 + GAP / 2);
      const ribMesh = new THREE.Mesh(flange, m.beamPaint);
      ribMesh.castShadow = true;
      g.add(ribMesh);

      // articulation hinge at the leading (far) end of each girder except
      // the free tip: top + bottom plates with a vertical pin, plus a dark
      // seam filling the gap so the four-girder segmentation stays legible.
      if (k < SEG_COUNT - 1) {
        const hingeParts: THREE.BufferGeometry[] = [];
        for (const y of [BEAM_TOP_Y - 0.07, BEAM_BOT_Y + 0.07]) {
          const plate = new THREE.CylinderGeometry(0.2, 0.2, 0.045, 18);
          plate.translate(0, y, len + GAP / 2);
          hingeParts.push(plate);
        }
        const hinge = new THREE.Mesh(mergeGeometries(hingeParts), m.beamPaintSide);
        hinge.castShadow = true;
        g.add(hinge);
        const pin = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.06, BEAM_H - 0.1, 12),
          m.steelDark,
        );
        pin.position.set(0, BEAM_BOT_Y + BEAM_H / 2, len + GAP / 2);
        g.add(pin);
        const seam = new THREE.Mesh(
          new THREE.BoxGeometry(BEAM_W - 0.03, BEAM_H - 0.06, GAP + 0.012),
          m.grease,
        );
        seam.position.set(0, BEAM_BOT_Y + BEAM_H / 2, len + GAP / 2);
        g.add(seam);
      }

      // arm guide channel near the tail of girders 2 and 4 — the slot the
      // crank roller rides in while pushing the girder sideways
      if (k === 1 || k === 3) {
        const ch = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.16, 1.7),
          m.steelDark,
        );
        ch.position.set(0, BEAM_BOT_Y - 0.09, len - 0.78);
        ch.castShadow = true;
        g.add(ch);
      }

      this.girders.push(g);
      this.group.add(g);
    }
  }

  // -- flexing guide / stabilising face bands -------------------------------
  private buildSkins(): void {
    // two bands per side: guide face (upper, where guide wheels run) and
    // stabilising face (lower). Confirmed feature of the 関節可撓式 turnout.
    const bands = [
      { y0: BEAM_TOP_Y - 0.42, y1: BEAM_TOP_Y - 0.10 }, // 案内面
      { y0: BEAM_BOT_Y + 0.10, y1: BEAM_BOT_Y + 0.38 }, // 安定面
    ];
    for (const side of [1, -1] as const) {
      for (const b of bands) {
        const geo = new THREE.PlaneGeometry(1, 1, SKIN_SAMPLES - 1, 1);
        const mesh = new THREE.Mesh(geo, this.mats.beamPaintSide);
        mesh.castShadow = true;
        mesh.frustumCulled = false;
        this.skins.push({ mesh, side, y0: b.y0, y1: b.y1 });
        this.group.add(mesh);
      }
    }
    // bending-device brackets: compact spring-box assemblies at each joint
    // on both webs (the hardware that flexes the bands).
    const parts: THREE.BufferGeometry[] = [];
    for (let j = 1; j < SEG_COUNT; j++) {
      for (const s of [-1, 1]) {
        const box = new THREE.BoxGeometry(0.1, 0.5, 0.34);
        // will be positioned in update via girder parenting: attach to the
        // girder that owns this joint's leading end
        box.translate(s * (BEAM_W / 2 + 0.075), BEAM_TOP_Y - BEAM_H / 2, SEG_LEN - GAP - 0.28);
        parts.push(box);
      }
    }
    // one bracket set per girder except the last (joints 1..3)
    for (let k = 0; k < SEG_COUNT - 1; k++) {
      const geo = new THREE.BoxGeometry(0.1, 0.5, 0.34);
      for (const s of [-1, 1]) {
        const m = new THREE.Mesh(geo, this.mats.steelDark);
        m.position.set(s * (BEAM_W / 2 + 0.075), BEAM_BOT_Y + BEAM_H / 2, SEG_LEN - 0.35);
        m.castShadow = true;
        this.girders[k].add(m);
      }
    }
  }

  private buildHeel(): void {
    // fixed articulation pedestal at the heel: concrete block + pivot bearing
    const ped = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.55, 1.2),
      this.mats.concreteDark,
    );
    ped.position.set(0, 0.28, -0.3);
    ped.receiveShadow = true; ped.castShadow = true;
    this.group.add(ped);
    const bearing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.34, 0.22, 18),
      this.mats.steelDark,
    );
    bearing.position.set(0, 0.66, 0);
    bearing.castShadow = true;
    this.group.add(bearing);
    const heelShadow = contactShadow(2.4, 2.0);
    heelShadow.position.set(0, 0.007, -0.3);
    this.group.add(heelShadow);
  }

  // -- transfer trolleys with lock cylinders --------------------------------
  private buildTrolleys(): void {
    const m = this.mats;
    for (const spec of this.trolleySpecs) {
      const g = new THREE.Group();

      // welded H-frame under the girder
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 0.9), m.steelDark);
      frame.position.y = 0.42;
      frame.castShadow = true;
      g.add(frame);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.5), m.steelDark);
      post.position.y = 0.62;
      g.add(post);

      // four flanged wheels rolling on the ground rails (axis along girder)
      const wheelGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.09, 18);
      wheelGeo.rotateX(Math.PI / 2); // axis -> z (girder axis); rolls in x
      for (const wx of [-0.6, 0.6]) {
        for (const wz of [-0.36, 0.36]) {
          const w = new THREE.Mesh(wheelGeo, m.steelDark);
          w.position.set(wx, 0.17, wz);
          w.castShadow = true;
          g.add(w);
        }
      }

      // lock cylinder: vertical hydraulic body cantilevered outside the
      // frame on a bracket, so the rod visibly seats on the bed plate
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.24), m.steelDark);
      bracket.position.set(LOCK_OX - 0.16, 0.52, LOCK_OZ);
      g.add(bracket);
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.34, 14), m.steelBlue);
      cyl.position.set(LOCK_OX, 0.68, LOCK_OZ);
      cyl.castShadow = true;
      g.add(cyl);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.5, 12), m.machined);
      rod.position.set(LOCK_OX, 0.32, LOCK_OZ);
      g.add(rod);
      this.lockRods.push(rod);

      this.trolleyGroups.push(g);
      this.group.add(g);
    }
  }

  // -- ground rails + bed plates -------------------------------------------
  private buildRailsAndPlates(): void {
    const m = this.mats;
    const railGeos: THREE.BufferGeometry[] = [];
    const plinthGeos: THREE.BufferGeometry[] = [];
    const plateGeos: THREE.BufferGeometry[] = [];
    const socketGeos: THREE.BufferGeometry[] = [];
    const stainGeos: THREE.BufferGeometry[] = [];

    for (const spec of this.trolleySpecs) {
      // rail direction at each trace point = local girder axis; rails offset
      // fore/aft of the joint so the four wheels always sit on steel.
      const tr = spec.trace;
      for (const off of [-0.36, 0.36]) {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i < tr.length; i++) {
          const t = i / (tr.length - 1);
          const h = girderHeading(Math.min(spec.joint, SEG_COUNT - 1), t);
          const dx = Math.sin(h) * off, dz = Math.cos(h) * off;
          pts.push(new THREE.Vector3(tr[i].x + dx, 0.06, tr[i].y + dz));
        }
        // extend both ends slightly
        const first = pts[0].clone().add(pts[0].clone().sub(pts[1]).setLength(0.4));
        const last = pts[pts.length - 1].clone().add(
          pts[pts.length - 1].clone().sub(pts[pts.length - 2]).setLength(0.4));
        pts.unshift(first); pts.push(last);
        railGeos.push(ribbonAlong(pts, 0.09, 0.12));
        plinthGeos.push(ribbonAlong(pts.map(p => new THREE.Vector3(p.x, 0.01, p.z)), 0.3, 0.1));
        // work stain: dirt and grease darken the deck along the travel path
        stainGeos.push(ribbonAlong(pts.map(p => new THREE.Vector3(p.x, 0.003, p.z)), 0.62, 0.004));
      }
      // machined bed plates at both end positions, under the lock rod,
      // each with a socket boss the rod tip drops into
      for (const t of [0, 1]) {
        const j = jointPos(spec.joint, t);
        const h = girderHeading(Math.min(spec.joint, SEG_COUNT - 1), t);
        const lx = j.x + Math.sin(h) * LOCK_OZ + Math.cos(h) * LOCK_OX;
        const lz = j.y + Math.cos(h) * LOCK_OZ - Math.sin(h) * LOCK_OX;
        const plate = new THREE.BoxGeometry(0.5, 0.07, 0.5);
        plate.rotateY(h);
        plate.translate(lx, 0.035, lz);
        plateGeos.push(plate);
        const socket = new THREE.CylinderGeometry(0.085, 0.095, 0.06, 14);
        socket.translate(lx, 0.1, lz);
        socketGeos.push(socket);
        // anchor bolts at the plate corners
        for (const bx of [-0.2, 0.2]) {
          for (const bz of [-0.2, 0.2]) {
            const bolt = new THREE.CylinderGeometry(0.022, 0.022, 0.05, 8);
            bolt.translate(lx + bx, 0.085, lz + bz);
            socketGeos.push(bolt);
          }
        }
      }
    }
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x9aa0a3, roughness: 0.45, metalness: 0.5,
    });
    const rails = new THREE.Mesh(mergeGeometries(railGeos), railMat);
    rails.receiveShadow = true;
    this.group.add(rails);
    const plinths = new THREE.Mesh(mergeGeometries(plinthGeos), m.concreteDark);
    plinths.receiveShadow = true;
    this.group.add(plinths);
    const plates = new THREE.Mesh(mergeGeometries(plateGeos), m.machined);
    plates.receiveShadow = true;
    this.group.add(plates);
    const sockets = new THREE.Mesh(mergeGeometries(socketGeos), m.steelDark);
    sockets.castShadow = true;
    this.group.add(sockets);
    const stains = new THREE.Mesh(mergeGeometries(stainGeos),
      new THREE.MeshStandardMaterial({
        color: 0x3c3a36, roughness: 1, transparent: true, opacity: 0.28,
        depthWrite: false,
      }));
    this.group.add(stains);
  }

  // -- drive units ----------------------------------------------------------
  private buildDriveUnits(): void {
    const m = this.mats;
    for (const spec of this.driveSpecs) {
      const base = new THREE.Group();
      base.position.set(spec.center.x, 0, spec.center.y);

      const bed = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 1.1), m.concreteDark);
      bed.position.y = 0.06;
      bed.receiveShadow = true;
      base.add(bed);

      // motor with fan cover, mounted horizontally
      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.48, 16), m.steelBlue);
      motor.rotation.z = Math.PI / 2;
      motor.position.set(-0.58, 0.27, 0);
      motor.castShadow = true;
      base.add(motor);
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.08, 16), m.steelDark);
      fan.rotation.z = Math.PI / 2;
      fan.position.set(-0.86, 0.27, 0);
      base.add(fan);
      this.motorSpinners.push(fan);

      // reducer gearbox with vertical output shaft (the crank axis)
      const gearbox = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.4, 0.52), m.steelBlue);
      gearbox.position.set(0, 0.32, 0);
      gearbox.castShadow = true;
      base.add(gearbox);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 12), m.steelDark);
      shaft.position.set(0, 0.55, 0);
      base.add(shaft);

      // horizontal crank arm below the girder soffit, roller up into the guide
      const armLen = spec.crankR;
      const arm = new THREE.Group();
      arm.position.set(0, 0.56, 0);
      const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, armLen), m.steelBlue);
      armMesh.position.z = armLen / 2;
      armMesh.castShadow = true;
      arm.add(armMesh);
      const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.18, 14), m.grease);
      roller.position.set(0, 0.1, armLen - 0.05);
      arm.add(roller);
      this.crankArms.push(arm);
      base.add(arm);

      // flexible conduit from the gearbox down into the deck cable trench
      const conduit = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.028, 8, 12, Math.PI / 2),
        this.mats.grease,
      );
      conduit.position.set(-0.26, 0.32, -0.26);
      conduit.rotation.y = Math.PI / 2;
      base.add(conduit);
      const conduitRun = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.028, 1.2, 8),
        this.mats.grease,
      );
      conduitRun.rotation.z = Math.PI / 2;
      conduitRun.position.set(-1.2, 0.04, -0.26);
      base.add(conduitRun);

      // soft contact shadow under the unit
      base.add(contactShadow(2.1, 1.5));

      this.group.add(base);
    }
  }

  // -- per-frame drive ------------------------------------------------------
  update(t: number, dt: number): void {
    this.t = t;
    const moved = Math.abs(t - this.lastT);
    this.lastT = t;

    // rigid girders
    for (let k = 0; k < SEG_COUNT; k++) {
      const p = jointPos(k, t);
      const g = this.girders[k];
      g.position.set(p.x, 0, p.y);
      g.rotation.y = girderHeading(k, t);
    }

    // flexing face bands follow the smooth spline
    const curve = guideCurve(t, SKIN_SAMPLES);
    for (const skin of this.skins) {
      const pos = skin.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < SKIN_SAMPLES; i++) {
        const p = curve[i];
        const iNext = Math.min(i + 1, SKIN_SAMPLES - 1);
        const iPrev = Math.max(i - 1, 0);
        const tx = curve[iNext].x - curve[iPrev].x;
        const tz = curve[iNext].y - curve[iPrev].y;
        const tl = Math.hypot(tx, tz) || 1;
        // outward normal
        const nx = (tz / tl) * skin.side, nz = (-tx / tl) * skin.side;
        const ox = p.x + nx * (BEAM_W / 2 + SKIN_OFFSET);
        const oz = p.y + nz * (BEAM_W / 2 + SKIN_OFFSET);
        // PlaneGeometry(1,1,N-1,1): row0 = top edge, row1 = bottom edge
        pos.setXYZ(i, ox, skin.y1, oz);
        pos.setXYZ(SKIN_SAMPLES + i, ox, skin.y0, oz);
      }
      pos.needsUpdate = true;
      skin.mesh.geometry.computeVertexNormals();
    }

    // trolleys track their joints, oriented with the local girder axis
    this.wheelSpin += moved * 40;
    for (let i = 0; i < this.trolleySpecs.length; i++) {
      const spec = this.trolleySpecs[i];
      const j = jointPos(spec.joint, t);
      const h = girderHeading(Math.min(spec.joint, SEG_COUNT - 1), t);
      const g = this.trolleyGroups[i];
      g.position.set(j.x, 0, j.y);
      g.rotation.y = h;
      for (const child of g.children) {
        if (child instanceof THREE.Mesh && (child.geometry as THREE.CylinderGeometry).parameters?.height === 0.09) {
          child.rotation.z = this.wheelSpin;
        }
      }
    }

    // lock rods
    for (const rod of this.lockRods) {
      rod.position.y = 0.32 + (1 - this.lockExt) * 0.22;
    }

    // cranks + motor fans
    for (let i = 0; i < this.driveSpecs.length; i++) {
      this.crankArms[i].rotation.y = crankAngle(this.driveSpecs[i], t);
    }
    if (moved > 0.000001 && dt > 0) {
      for (const f of this.motorSpinners) f.rotation.x += dt * 40;
    }

    // camera focus points
    const tipJ = jointPos(SEG_COUNT, t);
    const tipH = girderHeading(SEG_COUNT - 1, t);
    this.focus.tipLock.set(
      tipJ.x + Math.sin(tipH) * LOCK_OZ + Math.cos(tipH) * LOCK_OX,
      0.45,
      tipJ.y + Math.cos(tipH) * LOCK_OZ - Math.sin(tipH) * LOCK_OX,
    );
    const d = this.driveSpecs[1];
    this.focus.drive.set(d.center.x, 0.9, d.center.y);
    const midJ = jointPos(2, t);
    this.focus.mid.set(midJ.x, 1.2, midJ.y);
  }
}

/** radial-gradient contact-shadow quad, laid on the deck */
export function contactShadow(w: number, d: number, opacity = 0.32): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, `rgba(20,20,22,${opacity})`);
  g.addColorStop(1, 'rgba(20,20,22,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.006;
  return mesh;
}

/** Sweep a small w×h rectangular section along a polyline (top face up). */
function ribbonAlong(pts: THREE.Vector3[], w: number, h: number): THREE.BufferGeometry {
  const verts: number[] = [];
  const idx: number[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b.x - a.x, dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    const nx = dz, nz = -dx;
    // 4 corners of the section: two top, two bottom
    verts.push(
      p.x + nx * w / 2, p.y + h, p.z + nz * w / 2,
      p.x - nx * w / 2, p.y + h, p.z - nz * w / 2,
      p.x + nx * w / 2, p.y, p.z + nz * w / 2,
      p.x - nx * w / 2, p.y, p.z - nz * w / 2,
    );
    if (i > 0) {
      const c = i * 4, q = (i - 1) * 4;
      // top
      idx.push(q, q + 1, c, q + 1, c + 1, c);
      // sides
      idx.push(q + 2, q, c + 2, q, c, c + 2);
      idx.push(q + 1, q + 3, c + 1, q + 3, c + 3, c + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  // flat faces — otherwise the small rectangular section shades like a tube
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}
