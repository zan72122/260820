import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Scene,
  TorusGeometry,
  Vector3,
} from 'three';
import type { Settings } from '../core/settings';
import { mergeStatics } from './mergeStatics';
import { LAYOUT } from './layout';
import { galvanisedRoughness, galvanisedTexture } from './textures';
import { clamp, damp } from '../core/math';

const LINKS_PER_CHAIN = 60;

/**
 * A real playground swing: two A-frames, a top beam, saddle clamps with shackles,
 * two galvanised chains and a sagging rubber belt seat. Every joint is modelled
 * where a joint actually is, so the structure holds up from any angle.
 */
export class SwingRig {
  readonly group = new Group();
  readonly seat = new Group();
  readonly seatSurface: Mesh;
  readonly leftHang = new Vector3();
  readonly rightHang = new Vector3();

  private chainLinks: InstancedMesh;
  private linkDummy = new Object3D();
  private chainLag = 0;
  private chainLagZ = 0;
  private prevOmega = 0;
  private anchors: Vector3[] = [];

  constructor(scene: Scene, settings: Settings) {
    scene.add(this.group);

    const steel = new MeshStandardMaterial({
      map: galvanisedTexture(),
      roughnessMap: galvanisedRoughness(),
      color: new Color(0.68, 0.70, 0.73),
      roughness: 0.68,
      metalness: 0.72,
    });
    const painted = new MeshStandardMaterial({
      color: new Color(0.16, 0.26, 0.24),
      roughness: 0.48,
      metalness: 0.25,
    });
    const rubber = new MeshStandardMaterial({
      color: new Color(0.10, 0.10, 0.11),
      roughness: 0.88,
      metalness: 0.02,
    });
    const concrete = new MeshStandardMaterial({
      color: new Color(0.44, 0.42, 0.39),
      roughness: 0.95,
      metalness: 0,
    });

    const L = LAYOUT;

    // Top beam, running along Z, the axis the swing turns about.
    const beam = new Mesh(new CylinderGeometry(0.058, 0.058, L.beamHalfSpan * 2 + 0.26, 14), steel);
    beam.rotation.x = Math.PI / 2;
    beam.position.set(0, L.beamY, 0);
    beam.castShadow = settings.shadows;
    this.group.add(beam);
    for (const z of [-1, 1]) {
      const cap = new Mesh(new CylinderGeometry(0.062, 0.062, 0.03, 14), painted);
      cap.rotation.x = Math.PI / 2;
      cap.position.set(0, L.beamY, z * (L.beamHalfSpan + 0.14));
      this.group.add(cap);
    }

    // Two A-frames. Their plane is perpendicular to the beam, so the swing's arc
    // passes clean between them.
    for (const zEnd of [-L.beamHalfSpan, L.beamHalfSpan]) {
      for (const xDir of [-1, 1]) {
        const top = new Vector3(0, L.beamY, zEnd);
        const foot = new Vector3(xDir * L.frameLegSpread, 0, zEnd + Math.sign(zEnd) * 0.16);
        const leg = this.tube(top, foot, 0.048, 0.056, painted);
        leg.castShadow = settings.shadows;
        this.group.add(leg);

        const pad = new Mesh(new BoxGeometry(0.30, 0.10, 0.30), concrete);
        pad.position.set(foot.x, 0.02, foot.z);
        pad.receiveShadow = settings.shadows;
        this.group.add(pad);

        const shoe = new Mesh(new BoxGeometry(0.10, 0.14, 0.10), painted);
        shoe.position.set(foot.x, 0.09, foot.z);
        this.group.add(shoe);
      }
      // Horizontal brace across each A-frame.
      const brace = this.tube(
        new Vector3(-L.frameLegSpread * 0.62, 0.92, zEnd + Math.sign(zEnd) * 0.10),
        new Vector3(L.frameLegSpread * 0.62, 0.92, zEnd + Math.sign(zEnd) * 0.10),
        0.028,
        0.028,
        painted,
      );
      brace.castShadow = settings.shadows;
      this.group.add(brace);
    }

    // Saddle clamp + U-bolt + shackle at each hanger point.
    for (const z of [-L.seatHalfWidth, L.seatHalfWidth]) {
      const clamp2 = new Mesh(new CylinderGeometry(0.075, 0.075, 0.085, 12), steel);
      clamp2.rotation.x = Math.PI / 2;
      clamp2.position.set(0, L.beamY, z);
      clamp2.castShadow = settings.shadows;
      this.group.add(clamp2);

      const plate = new Mesh(new BoxGeometry(0.10, 0.055, 0.10), steel);
      plate.position.set(0, L.beamY - 0.078, z);
      this.group.add(plate);

      const shackle = new Mesh(new TorusGeometry(0.030, 0.0075, 6, 14, Math.PI * 1.35), steel);
      shackle.position.set(0, L.beamY - 0.118, z);
      shackle.rotation.set(0, Math.PI / 2, Math.PI * 0.32);
      this.group.add(shackle);

      const pin = new Mesh(new CylinderGeometry(0.008, 0.008, 0.05, 8), steel);
      pin.rotation.z = Math.PI / 2;
      pin.position.set(0, L.beamY - 0.104, z);
      this.group.add(pin);

      this.anchors.push(new Vector3(0, L.beamY - 0.145, z));
    }

    // The two chains, drawn as real interlocking links.
    const linkGeo = new TorusGeometry(0.0165, 0.0042, 4, 9);
    this.chainLinks = new InstancedMesh(linkGeo, steel, LINKS_PER_CHAIN * 2);
    this.chainLinks.castShadow = settings.shadows;
    this.chainLinks.frustumCulled = false;
    this.group.add(this.chainLinks);

    // Rubber belt seat: it sags across its width and folds up at the edges.
    const seatGeo = new PlaneGeometry(0.17, 0.44, 2, 10);
    const p = seatGeo.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const t = y / 0.22;
      p.setZ(i, -0.028 * Math.cos((t * Math.PI) / 2) + 0.03 * t * t);
    }
    seatGeo.computeVertexNormals();
    seatGeo.rotateX(-Math.PI / 2);
    this.seatSurface = new Mesh(seatGeo, rubber);
    this.seatSurface.castShadow = settings.shadows;
    this.seatSurface.receiveShadow = settings.shadows;
    this.seat.add(this.seatSurface);

    // Clamped steel end fittings the chains actually bolt through.
    for (const z of [-1, 1]) {
      const fit = new Mesh(new BoxGeometry(0.15, 0.020, 0.026), steel);
      fit.position.set(0, 0.006, z * 0.212);
      this.seat.add(fit);
      const eye = new Mesh(new TorusGeometry(0.014, 0.0042, 4, 10), steel);
      eye.position.set(0, 0.035, z * 0.212);
      eye.rotation.y = Math.PI / 2;
      this.seat.add(eye);
    }
    // The seat's own fittings move with it, so they merge into the seat itself.
    mergeStatics(this.seat);
    this.seat.userData.dynamic = true;
    this.chainLinks.userData.dynamic = true;
    this.group.add(this.seat);

    // Frame, fittings and pads never move: one mesh per material from here on.
    mergeStatics(this.group);
  }

  private tube(a: Vector3, b: Vector3, r0: number, r1: number, mat: MeshStandardMaterial): Mesh {
    const dir = new Vector3().subVectors(b, a);
    const len = dir.length();
    const geo = new CylinderGeometry(r0, r1, len, 10);
    const mesh = new Mesh(geo, mat);
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize());
    return mesh;
  }

  /**
   * Place the seat and re-lay the chains. The chains are not a physics rope: they
   * stay taut and pick up a small, damped second-order bow so they read as heavy
   * steel rather than rigid pipe.
   */
  update(theta: number, omega: number, dt: number, time: number): void {
    const L = LAYOUT;
    const seatDist = L.chainLength + 0.02;
    const sx = Math.sin(theta) * seatDist;
    const sy = L.pivot.y - Math.cos(theta) * seatDist;
    this.seat.position.set(sx, sy, 0);
    this.seat.rotation.set(0, 0, theta);

    // Angular acceleration drives the whip in the chain, then it settles.
    const alpha = (omega - this.prevOmega) / Math.max(dt, 1e-4);
    this.prevOmega = omega;
    const targetLag = clamp(-alpha * 0.0045, -0.05, 0.05);
    this.chainLag = damp(this.chainLag, targetLag, 9, dt);
    this.chainLagZ = damp(this.chainLagZ, Math.sin(time * 1.7 + theta * 2) * 0.006 * Math.abs(omega), 5, dt);

    const tangent = new Vector3(Math.cos(theta), Math.sin(theta), 0);
    const a = new Vector3();
    const b = new Vector3();
    const pt = new Vector3();
    let idx = 0;
    for (let c = 0; c < 2; c++) {
      const zSign = c === 0 ? -1 : 1;
      a.copy(this.anchors[c]);
      b.set(sx, sy + 0.035, zSign * 0.212);
      // Chain anchor sits slightly inboard of the seat fitting.
      const total = a.distanceTo(b);
      for (let i = 0; i < LINKS_PER_CHAIN; i++) {
        const t = (i + 0.5) / LINKS_PER_CHAIN;
        pt.lerpVectors(a, b, t);
        const bow = Math.sin(t * Math.PI);
        pt.addScaledVector(tangent, this.chainLag * bow);
        pt.z += this.chainLagZ * bow * zSign;
        this.linkDummy.position.copy(pt);
        this.linkDummy.rotation.set(0, i % 2 === 0 ? 0 : Math.PI / 2, theta + this.chainLag * 0.6 * bow);
        this.linkDummy.scale.set(1, total / (LINKS_PER_CHAIN * 0.0335), 1);
        this.linkDummy.updateMatrix();
        this.chainLinks.setMatrixAt(idx++, this.linkDummy.matrix);
      }
      if (c === 0) this.leftHang.copy(a);
      else this.rightHang.copy(a);
    }
    this.chainLinks.instanceMatrix.needsUpdate = true;
  }

  /** World point a given fraction up the chain from the seat, used for the hands. */
  chainPoint(zSign: number, upFromSeat: number, out: Vector3): Vector3 {
    const seat = this.seat.position;
    const anchor = this.anchors[zSign < 0 ? 0 : 1];
    const dir = new Vector3().subVectors(anchor, new Vector3(seat.x, seat.y + 0.035, zSign * 0.212));
    const len = dir.length();
    dir.normalize();
    out.set(seat.x, seat.y + 0.035, zSign * 0.212).addScaledVector(dir, Math.min(upFromSeat, len));
    return out;
  }
}
