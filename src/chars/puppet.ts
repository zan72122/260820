import {
  BoxGeometry,
  CapsuleGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  SphereGeometry,
  type Material,
} from 'three/webgpu';
import { clamp, clamp01, damp, dampAngle, lerp } from '../core/mathx';

/**
 * A rigid-hierarchy puppet rather than a skinned mesh.
 *
 * No glTF to download, no skinning cost, and every joint is a plain Object3D we
 * can drive from gameplay code - which matters because the teacher's two
 * gestures ARE the tutorial. Rounded caps hide the joints, and the proportions
 * are real: a 1.03m four-year-old next to a 1.62m adult reads instantly as
 * "child and grown-up" without a word of text.
 */

export interface PuppetSkin {
  skin: Material;
  /** Lower leg covering; children go bare-legged, grown-ups do not. */
  shin?: Material;
  hair: Material;
  top: Material;
  bottom: Material;
  shoe: Material;
  eye: Material;
}

export interface PuppetOpts {
  height: number;
  child: boolean;
  skin: PuppetSkin;
  hairStyle?: 'bob' | 'short' | 'ponytail' | 'buns';
  accessory?: 'none' | 'cape' | 'ears' | 'crown' | 'tail';
  accessoryMaterial?: Material;
}

interface ArmCtl {
  pitch: number; // forward swing (+ = forward)
  spread: number; // out from the body
  twist: number;
  elbow: number;
  wrist: number;
}

const zeroArm = (): ArmCtl => ({ pitch: 0, spread: 0.12, twist: 0, elbow: 0.15, wrist: 0 });

function limb(length: number, radius: number, mat: Material): Group {
  const g = new Group();
  const body = Math.max(0.001, length - radius * 2);
  const geo = new CapsuleGeometry(radius, body, 3, 8);
  geo.translate(0, -length / 2, 0);
  const m = new Mesh(geo, mat);
  m.castShadow = true;
  g.add(m);
  return g;
}

export class Puppet {
  readonly root = new Group();
  readonly hips = new Group();
  readonly chest = new Group();
  readonly neck = new Group();
  readonly head = new Group();
  readonly armL = new Group();
  readonly armR = new Group();
  readonly foreL = new Group();
  readonly foreR = new Group();
  readonly handL = new Group();
  readonly handR = new Group();
  readonly legL = new Group();
  readonly legR = new Group();
  readonly shinL = new Group();
  readonly shinR = new Group();

  readonly height: number;
  readonly hipY: number;
  readonly shoulderY: number;
  readonly eyeY: number;

  /** Target pose. Everything is damped toward these, so gestures never pop. */
  ctl = {
    headYaw: 0,
    headPitch: 0,
    headRoll: 0,
    torsoLean: 0,
    torsoTwist: 0,
    /** 0 = standing, 1 = down at a child's eye level. */
    crouch: 0,
    bounce: 0,
    left: zeroArm(),
    right: zeroArm(),
  };

  /** Metres per second; drives the walk cycle. */
  walkSpeed = 0;
  private phase = 0;
  private breath = 0;
  private blink = 0;
  private blinkTimer = 2;
  private eyeL: Mesh;
  private eyeR: Mesh;
  private thighLen: number;
  private shinLen: number;
  private opts: PuppetOpts;
  /** Fires once per footfall so the audio can put a shoe on the deck. */
  onFootfall: ((strength: number) => void) | null = null;
  private lastFootSign = 0;

  constructor(opts: PuppetOpts) {
    this.opts = opts;
    const h = opts.height;
    this.height = h;
    const child = opts.child;

    this.hipY = h * (child ? 0.46 : 0.5);
    this.shoulderY = h * (child ? 0.795 : 0.805);
    this.eyeY = h * (child ? 0.912 : 0.935);

    const headR = h * (child ? 0.105 : 0.072);
    const upper = h * (child ? 0.145 : 0.155);
    const fore = h * (child ? 0.135 : 0.148);
    this.thighLen = h * (child ? 0.215 : 0.238);
    this.shinLen = h * (child ? 0.205 : 0.245);
    const shoulderX = h * (child ? 0.1 : 0.105);
    const hipX = h * (child ? 0.052 : 0.055);
    const limbR = h * (child ? 0.038 : 0.041);

    this.root.add(this.hips);
    this.hips.position.y = this.hipY;

    // Torso: a slightly barrelled capsule, longer on a small child.
    const torsoLen = this.shoulderY - this.hipY;
    const torsoGeo = new CapsuleGeometry(h * (child ? 0.108 : 0.122), torsoLen * 0.72, 4, 10);
    torsoGeo.scale(1, 1, 0.78);
    torsoGeo.translate(0, torsoLen * 0.5, 0);
    const torso = new Mesh(torsoGeo, opts.skin.top);
    torso.castShadow = true;
    this.hips.add(this.chest);
    this.chest.add(torso);

    // Hips / lower garment.
    const pelvisGeo = new CapsuleGeometry(h * (child ? 0.095 : 0.1), h * 0.05, 3, 10);
    pelvisGeo.scale(1, 1, 0.8);
    const pelvis = new Mesh(pelvisGeo, opts.skin.bottom);
    pelvis.castShadow = true;
    this.hips.add(pelvis);

    // Neck + head.
    this.chest.position.y = 0;
    this.neck.position.y = torsoLen + h * 0.012;
    this.chest.add(this.neck);
    const neckMesh = new Mesh(new CapsuleGeometry(h * 0.032, h * 0.03, 2, 6), opts.skin.skin);
    neckMesh.position.y = h * 0.018;
    this.neck.add(neckMesh);

    this.head.position.y = h * (child ? 0.052 : 0.045) + headR * 0.72;
    this.neck.add(this.head);
    const headGeo = new SphereGeometry(headR, 16, 12);
    headGeo.scale(0.94, 1.03, 0.96);
    const headMesh = new Mesh(headGeo, opts.skin.skin);
    headMesh.castShadow = true;
    this.head.add(headMesh);

    // Hair.
    const style = opts.hairStyle ?? (child ? 'bob' : 'ponytail');
    // The cap has to stop above the brow, or the face disappears under a
    // helmet of hair and the teacher's expression stops being readable.
    const capGeo = new SphereGeometry(headR * 1.045, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.42);
    capGeo.scale(1, 1.06, 1);
    const cap = new Mesh(capGeo, opts.skin.hair);
    cap.position.y = headR * 0.06;
    cap.castShadow = true;
    this.head.add(cap);
    if (style === 'bob') {
      const bobGeo = new SphereGeometry(headR * 1.03, 16, 12, Math.PI * 0.32, Math.PI * 1.36, Math.PI * 0.2, Math.PI * 0.55);
      bobGeo.scale(1.05, 1.12, 1.05);
      const bob = new Mesh(bobGeo, opts.skin.hair);
      bob.position.z = -headR * 0.08;
      this.head.add(bob);
    } else if (style === 'short') {
      const backGeo = new SphereGeometry(headR * 1.03, 14, 10, Math.PI * 0.36, Math.PI * 1.28, Math.PI * 0.16, Math.PI * 0.42);
      const back = new Mesh(backGeo, opts.skin.hair);
      this.head.add(back);
    } else if (style === 'ponytail') {
      const tail = new Mesh(new CapsuleGeometry(headR * 0.3, headR * 0.85, 3, 8), opts.skin.hair);
      tail.position.set(0, headR * 0.1, -headR * 1.02);
      tail.rotation.x = 0.55;
      this.head.add(tail);
    } else if (style === 'buns') {
      for (const s of [-1, 1]) {
        const bun = new Mesh(new SphereGeometry(headR * 0.38, 8, 6), opts.skin.hair);
        bun.position.set(s * headR * 0.92, headR * 0.35, -headR * 0.2);
        this.head.add(bun);
      }
    }

    // A face, because "まだだよ" has to be readable from three metres away.
    const eyeGeo = new SphereGeometry(headR * 0.135, 8, 6);
    eyeGeo.scale(1, 1.15, 0.6);
    this.eyeL = new Mesh(eyeGeo, opts.skin.eye);
    this.eyeR = new Mesh(eyeGeo, opts.skin.eye);
    this.eyeL.position.set(-headR * 0.35, -headR * 0.04, headR * 0.91);
    this.eyeR.position.set(headR * 0.35, -headR * 0.04, headR * 0.91);
    this.head.add(this.eyeL, this.eyeR);
    const mouthGeo = new BoxGeometry(headR * 0.34, headR * 0.075, headR * 0.05);
    const mouth = new Mesh(mouthGeo, opts.skin.eye);
    mouth.position.set(0, -headR * 0.42, headR * 0.9);
    mouth.rotation.x = -0.25;
    this.head.add(mouth);
    // Cheeks: two soft dots. Cheap, and it makes them look four.
    if (child) {
      for (const s of [-1, 1]) {
        const cheek = new Mesh(new SphereGeometry(headR * 0.15, 6, 5), opts.skin.eye);
        cheek.scale.set(1.3, 0.75, 0.28);
        cheek.position.set(s * headR * 0.6, -headR * 0.18, headR * 0.8);
        cheek.visible = false; // kept for future dressing, off by default
        this.head.add(cheek);
      }
    }

    // Arms.
    const buildArm = (side: -1 | 1, shoulder: Group, forearm: Group, hand: Group): void => {
      shoulder.position.set(side * shoulderX, torsoLen * 0.92, 0);
      this.chest.add(shoulder);
      shoulder.add(limb(upper, limbR, opts.skin.skin));
      forearm.position.y = -upper;
      shoulder.add(forearm);
      const elbow = new Mesh(new SphereGeometry(limbR * 1.02, 8, 6), opts.skin.skin);
      elbow.position.y = -upper;
      shoulder.add(elbow);
      forearm.add(limb(fore, limbR * 0.88, opts.skin.skin));
      hand.position.y = -fore;
      forearm.add(hand);
      const palmGeo = new SphereGeometry(limbR * 1.25, 8, 6);
      palmGeo.scale(1, 1.25, 0.6);
      palmGeo.translate(0, -limbR * 0.9, 0);
      const palm = new Mesh(palmGeo, opts.skin.skin);
      palm.castShadow = true;
      hand.add(palm);
    };
    buildArm(-1, this.armL, this.foreL, this.handL);
    buildArm(1, this.armR, this.foreR, this.handR);

    // Legs.
    const buildLeg = (side: -1 | 1, hip: Group, shin: Group): void => {
      hip.position.set(side * hipX, 0, 0);
      this.hips.add(hip);
      hip.add(limb(this.thighLen, limbR * 1.15, opts.skin.bottom));
      shin.position.y = -this.thighLen;
      hip.add(shin);
      const knee = new Mesh(new SphereGeometry(limbR * 1.05, 8, 6), opts.skin.bottom);
      knee.position.y = -this.thighLen;
      hip.add(knee);
      shin.add(limb(this.shinLen, limbR * 0.95, opts.skin.shin ?? opts.skin.skin));
      // 上履き - indoor shoes.
      const shoeGeo = new BoxGeometry(limbR * 2.5, h * 0.045, h * 0.1);
      shoeGeo.translate(0, -this.shinLen - h * 0.018, h * 0.018);
      const shoe = new Mesh(shoeGeo, opts.skin.shoe);
      shoe.castShadow = true;
      shin.add(shoe);
    };
    buildLeg(-1, this.legL, this.shinL);
    buildLeg(1, this.legR, this.shinR);

    this.addAccessory(opts, headR, torsoLen);
  }

  private addAccessory(opts: PuppetOpts, headR: number, torsoLen: number): void {
    const mat = opts.accessoryMaterial ?? opts.skin.top;
    switch (opts.accessory) {
      case 'cape': {
        // Curved around the back, flaring at the hem: a bath-towel cape safety
        // -pinned at the neck, which is what these actually are.
        const w = this.height * 0.26;
        const len = torsoLen * 1.05;
        const geo = new PlaneGeometry(w, len, 6, 5);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const y = pos.getY(i);
          const v = 0.5 - y / len; // 0 at the neck, 1 at the hem
          const flare = 1 + v * 0.45;
          pos.setX(i, x * flare);
          pos.setZ(i, -Math.pow(Math.abs((x * flare) / (w * 0.72)), 2) * this.height * 0.05 - v * this.height * 0.012);
        }
        geo.computeVertexNormals();
        const cape = new Mesh(geo, mat);
        cape.position.set(0, torsoLen * 0.62, -this.height * 0.055);
        cape.rotation.x = -0.06;
        cape.castShadow = true;
        this.chest.add(cape);
        break;
      }
      case 'ears': {
        for (const s of [-1, 1]) {
          const ear = new Mesh(new SphereGeometry(headR * 0.42, 8, 6), mat);
          ear.scale.set(0.75, 1.25, 0.4);
          ear.position.set(s * headR * 0.62, headR * 1.02, -headR * 0.08);
          this.head.add(ear);
        }
        break;
      }
      case 'crown': {
        const band = new Mesh(new CapsuleGeometry(headR * 1.02, 0.001, 2, 14), mat);
        band.scale.set(1, 0.22, 1);
        band.position.y = headR * 0.62;
        this.head.add(band);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const spike = new Mesh(new BoxGeometry(headR * 0.16, headR * 0.3, headR * 0.06), mat);
          spike.position.set(Math.sin(a) * headR * 0.96, headR * 0.82, Math.cos(a) * headR * 0.96);
          spike.rotation.y = a;
          this.head.add(spike);
        }
        break;
      }
      case 'tail': {
        const tail = new Mesh(new CapsuleGeometry(this.height * 0.03, this.height * 0.14, 3, 6), mat);
        tail.position.set(0, this.height * 0.02, -this.height * 0.085);
        tail.rotation.x = -0.9;
        this.hips.add(tail);
        break;
      }
      default:
        break;
    }
  }

  /** Where this puppet's eyes actually are right now, crouch included. */
  get currentEyeY(): number {
    return (
      this.root.position.y +
      this.hips.position.y +
      (this.shoulderY - this.hipY) +
      this.head.position.y +
      (this.eyeY - this.shoulderY) * 0.35
    );
  }

  /** Point the head (and a little of the chest) at a world position. */
  lookAt(x: number, y: number, z: number, weight = 1): void {
    const wp = this.root.position;
    const dx = x - wp.x;
    const dz = z - wp.z;
    const worldYaw = Math.atan2(dx, dz);
    const local = worldYaw - this.root.rotation.y;
    const wrapped = Math.atan2(Math.sin(local), Math.cos(local));
    const dist = Math.hypot(dx, dz);
    const pitch = Math.atan2(y - this.currentEyeY, Math.max(0.2, dist));
    this.ctl.headYaw = clamp(wrapped, -1.15, 1.15) * weight;
    this.ctl.headPitch = clamp(-pitch, -0.6, 0.6) * weight;
  }

  update(dt: number, time: number): void {
    const c = this.ctl;
    const k = 0.0007;

    // Walk cycle. Stride length scales with the puppet, so the child takes
    // small quick steps and the teacher does not mince.
    const stride = this.height * 0.42;
    if (this.walkSpeed > 0.02) {
      this.phase += (this.walkSpeed / stride) * Math.PI * 2 * dt;
    } else {
      this.phase = damp(this.phase % (Math.PI * 2), 0, 0.05, dt);
    }
    const swing = clamp01(this.walkSpeed / 1.1);
    const s = Math.sin(this.phase);
    const cph = Math.cos(this.phase);

    const footSign = Math.sign(s);
    if (swing > 0.15 && footSign !== this.lastFootSign && footSign !== 0) {
      this.lastFootSign = footSign;
      this.onFootfall?.(clamp01(0.4 + swing * 0.8));
    }

    // Legs.
    const hipSwing = s * 0.62 * swing;
    const kneeBend = clamp01(-cph) * 0.9 * swing;
    this.legL.rotation.x = hipSwing;
    this.legR.rotation.x = -hipSwing;
    this.shinL.rotation.x = -(clamp01(cph) * 0.9 * swing) - 0.04;
    this.shinR.rotation.x = -kneeBend - 0.04;

    // Crouch: bend at hips and knees rather than sinking the whole rig, so the
    // teacher's face really does arrive at the child's eye level.
    const crouch = damp(this.hips.position.y, this.hipY - c.crouch * this.height * 0.3, k, dt);
    this.hips.position.y = crouch;
    const crouchAmt = clamp01((this.hipY - crouch) / (this.height * 0.3));
    this.legL.rotation.x += crouchAmt * 1.15;
    this.legR.rotation.x += crouchAmt * 1.15;
    this.shinL.rotation.x -= crouchAmt * 2.0;
    this.shinR.rotation.x -= crouchAmt * 2.0;
    this.legL.rotation.z = crouchAmt * 0.18;
    this.legR.rotation.z = -crouchAmt * 0.18;

    // Breathing + vertical bob from the gait.
    this.breath += dt;
    const bob = Math.abs(Math.sin(this.phase)) * this.height * 0.016 * swing;
    this.hips.position.y += bob + Math.sin(this.breath * 1.6) * this.height * 0.0035 + c.bounce;
    this.hips.rotation.z = -cph * 0.055 * swing;
    this.hips.rotation.y = damp(this.hips.rotation.y, -s * 0.12 * swing + c.torsoTwist * 0.35, k, dt);

    this.chest.rotation.x = damp(this.chest.rotation.x, c.torsoLean + crouchAmt * 0.16, k, dt);
    this.chest.rotation.y = damp(this.chest.rotation.y, c.torsoTwist * 0.65, k, dt);
    this.chest.rotation.z = damp(this.chest.rotation.z, cph * 0.03 * swing, k, dt);

    this.head.rotation.y = dampAngle(this.head.rotation.y, c.headYaw, k, dt);
    this.head.rotation.x = damp(this.head.rotation.x, c.headPitch - crouchAmt * 0.2, k, dt);
    this.head.rotation.z = damp(this.head.rotation.z, c.headRoll, k, dt);

    // Arms: gesture targets, plus the natural counter-swing of walking.
    const applyArm = (
      shoulder: Group,
      forearm: Group,
      hand: Group,
      a: ArmCtl,
      side: -1 | 1,
      walk: number,
    ): void => {
      shoulder.rotation.x = damp(shoulder.rotation.x, a.pitch + walk, k, dt);
      shoulder.rotation.z = damp(shoulder.rotation.z, side * (a.spread + Math.abs(walk) * 0.05), k, dt);
      shoulder.rotation.y = damp(shoulder.rotation.y, a.twist, k, dt);
      forearm.rotation.x = damp(forearm.rotation.x, -Math.abs(a.elbow) - Math.abs(walk) * 0.25, k, dt);
      hand.rotation.x = damp(hand.rotation.x, a.wrist, k, dt);
    };
    applyArm(this.armL, this.foreL, this.handL, c.left, -1, -s * 0.5 * swing);
    applyArm(this.armR, this.foreR, this.handR, c.right, 1, s * 0.5 * swing);

    // Blinking.
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 2.2 + Math.random() * 3.4;
      this.blink = 1;
    }
    this.blink = Math.max(0, this.blink - dt * 9);
    const lid = 1 - this.blink * 0.92;
    this.eyeL.scale.y = lid;
    this.eyeR.scale.y = lid;

    // A four-year-old is never completely still.
    if (this.opts.child && this.walkSpeed < 0.05) {
      this.root.rotation.z = Math.sin(time * 0.9 + this.height) * 0.012;
    }
  }

  /** Sets both arms to a relaxed hang. */
  relaxArms(): void {
    this.ctl.left = zeroArm();
    this.ctl.right = zeroArm();
  }

  setVisible(v: boolean): void {
    this.root.visible = v;
  }

  /** Face a world direction (yaw only). */
  faceDirection(dx: number, dz: number, dt: number, smoothing = 0.0005): void {
    if (Math.abs(dx) + Math.abs(dz) < 1e-5) return;
    const yaw = Math.atan2(dx, dz);
    this.root.rotation.y = dampAngle(this.root.rotation.y, yaw, smoothing, dt);
  }

  /** Blend factor helper for scripted gestures. */
  static ease(t: number): number {
    return lerp(0, 1, clamp01(t));
  }
}
