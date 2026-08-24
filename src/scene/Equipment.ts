import * as THREE from 'three';
import { clamp01, lerp, smoothstep } from '../util/math';
import { LAYOUT } from './layout';
import type { Materials } from './Materials';

const tube = (
  points: THREE.Vector3[],
  radius: number,
  mat: THREE.Material,
  segments = 48,
): THREE.Mesh => {
  const curve = new THREE.CatmullRomCurve3(points);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 8, false), mat);
  mesh.castShadow = true;
  return mesh;
};

/**
 * The sphygmomanometer set: trolley, rubber bulb, brass release valve, tubing
 * and the aneroid movement. These are the objects the child actually touches,
 * so this is where the surface detail budget goes.
 */
export class EquipmentRig {
  readonly group = new THREE.Group();

  /** World anchors used by the pointer router and the camera rails. */
  readonly bulbAnchor = LAYOUT.bulbCenter.clone();
  readonly valveAnchor = LAYOUT.valveCenter.clone();

  private bulb!: THREE.Mesh;
  private bulbBase!: Float32Array;
  private valveKnob!: THREE.Group;
  private needle!: THREE.Object3D;
  private bulbTremble = 0;
  private valveTremble = 0;

  constructor(private mats: Materials) {
    this.buildTrolley();
    this.buildBulb();
    this.buildValve();
    this.buildGauge();
    this.buildTubing();
  }

  private buildTrolley(): void {
    const m = this.mats;
    const t = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.026, 0.46), m.laminate);
    top.position.set(0, LAYOUT.trolleyTop - 0.013, 0);
    top.castShadow = true;
    top.receiveShadow = true;
    t.add(top);
    // A raised edge round the tray, the way an instrument trolley is made.
    for (const [w, d, x, z] of [
      [0.62, 0.014, 0, -0.223],
      [0.62, 0.014, 0, 0.223],
      [0.014, 0.46, -0.303, 0],
      [0.014, 0.46, 0.303, 0],
    ]) {
      const rim = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, d), m.steelFrame);
      rim.position.set(x, LAYOUT.trolleyTop + 0.003, z);
      t.add(rim);
    }
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.02, 0.4), m.laminate);
    shelf.position.set(0, 0.34, 0);
    t.add(shelf);
    for (const [dx, dz] of [
      [-0.26, -0.18],
      [0.26, -0.18],
      [-0.26, 0.18],
      [0.26, 0.18],
    ]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, LAYOUT.trolleyTop - 0.05, 8),
        m.steelFrame,
      );
      leg.position.set(dx, (LAYOUT.trolleyTop - 0.05) / 2 + 0.05, dz);
      leg.castShadow = true;
      t.add(leg);
      const caster = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.026, 0.014, 10),
        m.elastomerRim,
      );
      caster.rotation.z = Math.PI / 2;
      caster.position.set(dx, 0.026, dz);
      t.add(caster);
    }
    const sh = m.makeShadowPatch(0.85, 0.68);
    sh.position.set(0, 0.004, 0);
    t.add(sh);
    t.position.set(0.62, 0, 0.72);
    this.group.add(t);

    // Grounding shadow for the bulb resting on the tray.
    const bulbShadow = m.makeShadowPatch(0.11, 0.1);
    bulbShadow.position.set(LAYOUT.bulbCenter.x, LAYOUT.trolleyTop + 0.001, LAYOUT.bulbCenter.z);
    this.group.add(bulbShadow);
  }

  private buildBulb(): void {
    const geo = new THREE.SphereGeometry(0.0335, 30, 22);
    geo.scale(1.35, 1, 1);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    this.bulbBase = (pos.array as Float32Array).slice();
    this.bulb = new THREE.Mesh(geo, this.mats.bulbRubber);
    this.bulb.position.copy(LAYOUT.bulbCenter);
    this.bulb.rotation.y = -0.35;
    this.bulb.castShadow = true;
    this.bulb.receiveShadow = true;
    this.group.add(this.bulb);

    // Mould parting line: a real seam, not a decorative groove.
    const seam = new THREE.Mesh(
      new THREE.TorusGeometry(0.0336, 0.0007, 5, 40),
      new THREE.MeshStandardMaterial({ color: 0x1b1e21, roughness: 0.7 }),
    );
    seam.rotation.x = Math.PI / 2;
    seam.scale.set(1.35, 1, 1);
    seam.position.copy(LAYOUT.bulbCenter);
    seam.rotation.z = -0.35;
    this.group.add(seam);

    // Inlet filter at the tail of the bulb.
    const inlet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.007, 0.012, 10),
      this.mats.steelSatin,
    );
    inlet.rotation.z = Math.PI / 2;
    inlet.position.set(
      LAYOUT.bulbCenter.x - 0.044,
      LAYOUT.bulbCenter.y,
      LAYOUT.bulbCenter.z + 0.016,
    );
    inlet.rotation.y = 0.35;
    this.group.add(inlet);
  }

  private buildValve(): void {
    const m = this.mats;
    const g = new THREE.Group();

    // Body: hex base into the bulb neck, then the knurled adjusting knob.
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.012, 0.018, 6), m.brass);
    base.position.y = -0.012;
    g.add(base);

    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.009, 0.007, 18),
      m.brass,
    );
    collar.position.y = 0.0005;
    g.add(collar);

    // A teaching-set release valve: the same brass body as a clinical one, but
    // with the larger knurled thumbwheel these sets are built with, so a small
    // finger has something real to turn.
    this.valveKnob = new THREE.Group();
    const knob = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.019, 30),
      m.brass,
    );
    this.valveKnob.add(knob);
    // Chamfered edges — machined brass is never left with a sharp corner.
    for (const dy of [0.0095, -0.0095]) {
      const ch = new THREE.Mesh(
        new THREE.CylinderGeometry(dy > 0 ? 0.0136 : 0.016, dy > 0 ? 0.016 : 0.0136, 0.0018, 30),
        m.brass,
      );
      ch.position.y = dy + (dy > 0 ? 0.0009 : -0.0009);
      this.valveKnob.add(ch);
    }
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0136, 0.0136, 0.0018, 30),
      m.steelSatin,
    );
    cap.position.y = 0.0113;
    this.valveKnob.add(cap);
    this.valveKnob.position.y = 0.0165;
    g.add(this.valveKnob);

    // Exhaust port on the side of the body.
    const port = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0022, 0.0022, 0.006, 8),
      m.brass,
    );
    port.rotation.z = Math.PI / 2;
    port.position.set(0.011, -0.004, 0);
    g.add(port);

    g.position.copy(LAYOUT.valveCenter);
    g.rotation.x = -0.42;
    g.rotation.z = 0.16;
    this.group.add(g);
  }

  private buildGauge(): void {
    const m = this.mats;
    const g = new THREE.Group();

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.011, LAYOUT.gaugeCenter.y - LAYOUT.trolleyTop, 10),
      m.steelFrame,
    );
    post.position.y = -(LAYOUT.gaugeCenter.y - LAYOUT.trolleyTop) / 2;
    g.add(post);

    const bodyR = 0.058;
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(bodyR, bodyR, 0.024, 36),
      m.steelSatin,
    );
    body.rotation.x = Math.PI / 2;
    body.castShadow = true;
    g.add(body);

    const face = new THREE.Mesh(new THREE.CircleGeometry(bodyR * 0.94, 40), m.gaugeFace);
    face.position.z = 0.0125;
    g.add(face);

    const bezel = new THREE.Mesh(
      new THREE.TorusGeometry(bodyR * 0.97, 0.0042, 8, 40),
      m.chrome,
    );
    bezel.position.z = 0.0135;
    g.add(bezel);

    const crystal = new THREE.Mesh(new THREE.CircleGeometry(bodyR * 0.93, 40), m.glass);
    crystal.position.z = 0.0142;
    g.add(crystal);

    const needle = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.BoxGeometry(0.0035, bodyR * 0.82, 0.0012),
      m.gaugeNeedle,
    );
    shaft.position.y = bodyR * 0.34;
    needle.add(shaft);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.005, bodyR * 0.2, 0.0012),
      m.gaugeNeedle,
    );
    tail.position.y = -bodyR * 0.1;
    needle.add(tail);
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.005, 0.003, 14),
      m.steelBrushed,
    );
    hub.rotation.x = Math.PI / 2;
    needle.add(hub);
    needle.position.z = 0.0128;
    g.add(needle);
    this.needle = needle;

    g.position.copy(LAYOUT.gaugeCenter);
    g.rotation.y = -0.16;
    g.rotation.x = 0.2;
    this.group.add(g);
  }

  private buildTubing(): void {
    const m = this.mats;
    const cuffPortA = new THREE.Vector3(
      LAYOUT.cuffCenterX + 0.022,
      LAYOUT.armY - 0.06,
      LAYOUT.armZ + 0.045,
    );
    const cuffPortB = new THREE.Vector3(
      LAYOUT.cuffCenterX - 0.022,
      LAYOUT.armY - 0.06,
      LAYOUT.armZ + 0.045,
    );

    // Cuff to bulb: drapes down onto the tray, never a straight rigid rod.
    this.group.add(
      tube(
        [
          cuffPortA,
          new THREE.Vector3(cuffPortA.x + 0.014, cuffPortA.y - 0.02, cuffPortA.z + 0.035),
          // Kept clear of the couch top and of the trolley tray: a tube that
          // dips through either one reads as two broken stubs.
          new THREE.Vector3(0.38, LAYOUT.couchTop + 0.028, 0.26),
          new THREE.Vector3(0.45, LAYOUT.couchTop + 0.012, 0.42),
          new THREE.Vector3(0.5, LAYOUT.trolleyTop + 0.055, 0.52),
          new THREE.Vector3(0.55, LAYOUT.trolleyTop + 0.022, 0.61),
          new THREE.Vector3(LAYOUT.bulbCenter.x - 0.042, LAYOUT.bulbCenter.y, LAYOUT.bulbCenter.z + 0.014),
        ],
        0.0058,
        m.tubing,
      ),
    );

    // Cuff to gauge.
    this.group.add(
      tube(
        [
          cuffPortB,
          new THREE.Vector3(cuffPortB.x - 0.004, cuffPortB.y - 0.022, cuffPortB.z + 0.036),
          new THREE.Vector3(0.3, LAYOUT.couchTop + 0.03, 0.26),
          new THREE.Vector3(0.34, LAYOUT.couchTop + 0.016, 0.42),
          new THREE.Vector3(0.38, LAYOUT.trolleyTop + 0.09, 0.52),
          new THREE.Vector3(LAYOUT.gaugeCenter.x, LAYOUT.gaugeCenter.y - 0.06, LAYOUT.gaugeCenter.z + 0.008),
        ],
        0.0055,
        m.tubing,
      ),
    );

    // Bulb neck to valve body.
    this.group.add(
      tube(
        [
          new THREE.Vector3(LAYOUT.bulbCenter.x + 0.038, LAYOUT.bulbCenter.y + 0.006, LAYOUT.bulbCenter.z + 0.02),
          new THREE.Vector3(LAYOUT.valveCenter.x - 0.004, LAYOUT.valveCenter.y - 0.022, LAYOUT.valveCenter.z - 0.008),
        ],
        0.0062,
        m.tubing,
        12,
      ),
    );
  }

  /* ---------------------------------------------------------- animation -- */

  update(opts: {
    squeeze: number;
    dentBias: number;
    valveAngle: number;
    needle: number;
    bulbHint: number;
    valveHint: number;
    time: number;
  }): void {
    this.deformBulb(opts.squeeze, opts.dentBias);
    this.valveKnob.rotation.y = opts.valveAngle;

    // The aneroid movement sweeps most of a turn over the working range.
    this.needle.rotation.z = -clamp01(opts.needle) * Math.PI * 1.62 - 0.2;

    // Nothing glows to say "touch me". The valve just trembles a little, the
    // way a spring-loaded spindle does when the line behind it is under load.
    this.valveTremble = lerp(this.valveTremble, opts.valveHint, 0.08);
    this.bulbTremble = lerp(this.bulbTremble, opts.bulbHint, 0.08);
    const t = opts.time;
    this.valveKnob.position.x = Math.sin(t * 31) * 0.00016 * this.valveTremble;
    this.valveKnob.position.z = Math.cos(t * 27) * 0.00014 * this.valveTremble;
    this.bulb.position.y =
      LAYOUT.bulbCenter.y + Math.sin(t * 8.5) * 0.0006 * this.bulbTremble;
  }

  private deformBulb(squeeze: number, bias: number): void {
    const attr = this.bulb.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const base = this.bulbBase;
    if (squeeze < 0.001) {
      arr.set(base);
      attr.needsUpdate = true;
      this.bulb.geometry.computeVertexNormals();
      return;
    }
    // Two contact patches of unequal strength: a palm and a finger group.
    const palm = new THREE.Vector3(0.1, 0.24, 0.96).normalize();
    const fingers = new THREE.Vector3(-0.22, -0.3, -0.92).normalize();
    const v = new THREE.Vector3();
    for (let i = 0; i < base.length; i += 3) {
      v.set(base[i], base[i + 1], base[i + 2]);
      const n = v.clone().normalize();
      const dPalm = smoothstep(0.25, 1, n.dot(palm));
      const dFing = smoothstep(0.1, 1, n.dot(fingers));
      const dent =
        (dPalm * (0.62 + bias * 0.25) + dFing * (0.46 - bias * 0.2)) * squeeze * 0.0125;
      // Volume pushes out at the waist rather than vanishing.
      const equator = 1 - Math.abs(n.y);
      const swell = squeeze * 0.0042 * equator * (1 - dPalm * 0.7);
      const k = 1 + (swell - dent) / Math.max(0.0001, v.length());
      arr[i] = v.x * k;
      arr[i + 1] = v.y * k;
      arr[i + 2] = v.z * k;
    }
    attr.needsUpdate = true;
    this.bulb.geometry.computeVertexNormals();
  }
}
