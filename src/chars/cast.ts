import { Group, MeshStandardMaterial, Vector3 } from 'three/webgpu';
import { LAYOUT, CHILD_HEIGHT, TEACHER_HEIGHT } from '../core/config';
import { Rng, clamp01, damp, lerp, smoothstep } from '../core/mathx';
import type { Materials } from '../art/materials';
import { Puppet, type PuppetOpts } from './puppet';

const COSTUMES: { key: string; rgb: [number, number, number]; kind: 'satin' | 'nonwoven'; acc: PuppetOpts['accessory'] }[] = [
  { key: 'sun', rgb: [0.95, 0.72, 0.2], kind: 'satin', acc: 'crown' },
  { key: 'sky', rgb: [0.35, 0.6, 0.92], kind: 'nonwoven', acc: 'cape' },
  { key: 'leaf', rgb: [0.42, 0.74, 0.42], kind: 'nonwoven', acc: 'ears' },
  { key: 'plum', rgb: [0.82, 0.42, 0.68], kind: 'satin', acc: 'cape' },
  { key: 'snow', rgb: [0.93, 0.93, 0.95], kind: 'satin', acc: 'crown' },
  { key: 'fox', rgb: [0.92, 0.55, 0.28], kind: 'nonwoven', acc: 'ears' },
  { key: 'mint', rgb: [0.5, 0.85, 0.78], kind: 'nonwoven', acc: 'tail' },
];

const HAIR: NonNullable<PuppetOpts['hairStyle']>[] = ['bob', 'short', 'ponytail', 'buns'];

export function makeChild(mats: Materials, rng: Rng, costumeIndex: number): Puppet {
  const c = COSTUMES[costumeIndex % COSTUMES.length];
  const top = mats.costume(c.key, c.rgb, c.kind);
  const bottomRgb: [number, number, number] = [c.rgb[0] * 0.7, c.rgb[1] * 0.7, c.rgb[2] * 0.78];
  const bottom = mats.costume(`${c.key}-b`, bottomRgb, c.kind === 'satin' ? 'nonwoven' : 'satin');
  const eye = new MeshStandardMaterial({ color: 0x241a18, roughness: 0.5 });
  return new Puppet({
    height: CHILD_HEIGHT * rng.range(0.95, 1.05),
    child: true,
    hairStyle: rng.pick(HAIR),
    accessory: c.acc,
    accessoryMaterial: top,
    skin: { skin: mats.skin, hair: mats.hair, top, bottom, shoe: mats.shoe, eye },
  });
}

export type TeacherMode =
  /** Watching the stage, half an eye on the children. */
  | 'watch'
  /** Turned to the player: palm down, "not yet". */
  | 'wait'
  /** Down at eye level, one hand opening toward the stage: "now". */
  | 'cue'
  /** Child is out; she stays low and watches them go. */
  | 'sendOff';

/**
 * The teacher is the entire tutorial. Everything she communicates is posture,
 * gaze and one hand - no text, no arrows, no voice-over. "まだだよ" is a
 * palm-down pat with a smile; "今だよ" is a crouch to eye level and an open
 * hand toward the stage. A four-year-old reads both without being taught.
 */
export class Teacher {
  readonly puppet: Puppet;
  private mode: TeacherMode = 'watch';
  private t = 0;
  private glance = 0;
  private glanceTimer = 1.4;
  private lookTarget = new Vector3();
  private rng: Rng;
  /** Small round-to-round variation in how she cues. */
  variant = 0;

  constructor(mats: Materials, rng: Rng) {
    this.rng = rng;
    const eye = new MeshStandardMaterial({ color: 0x241a18, roughness: 0.5 });
    const skirt = mats.costume('teacher-b', [0.22, 0.24, 0.3], 'nonwoven');
    this.puppet = new Puppet({
      height: TEACHER_HEIGHT,
      child: false,
      hairStyle: 'ponytail',
      accessory: 'none',
      skin: {
        skin: mats.skinTeacher,
        shin: skirt,
        hair: mats.hair,
        top: mats.teacherWear,
        bottom: skirt,
        shoe: mats.shoeAdult,
        eye,
      },
    });
    this.puppet.root.position.set(LAYOUT.teacherMark.x, LAYOUT.stageY, LAYOUT.teacherMark.z);
    // Standing a little turned, so the wing composition has a diagonal in it.
    // Facing the stage to begin with; she turns to the child as she checks.
    this.puppet.root.rotation.y = Math.PI * 0.78;
  }

  setMode(m: TeacherMode): void {
    if (this.mode === m) return;
    this.mode = m;
    this.t = 0;
  }

  get currentMode(): TeacherMode {
    return this.mode;
  }

  /** How far through the current gesture, 0..1+. */
  get gestureTime(): number {
    return this.t;
  }

  update(dt: number, time: number, playerPos: Vector3, gapPos: Vector3): void {
    this.t += dt;
    const p = this.puppet;
    const c = p.ctl;

    switch (this.mode) {
      case 'watch': {
        // Her gaze walks between the curtain and the child. That alternation is
        // the first and softest hint the game ever gives.
        this.glanceTimer -= dt;
        if (this.glanceTimer <= 0) {
          this.glance = this.glance > 0.5 ? 0 : 1;
          this.glanceTimer = this.glance > 0.5 ? this.rng.range(1.0, 1.8) : this.rng.range(2.0, 3.4);
        }
        const w = damp(this.lookTarget.x, this.glance, 0.002, dt);
        this.lookTarget.x = w;
        const tx = lerp(gapPos.x, playerPos.x, w);
        const ty = lerp(gapPos.y, playerPos.y, w);
        const tz = lerp(gapPos.z, playerPos.z, w);
        p.lookAt(tx, ty, tz);
        c.crouch = 0;
        c.torsoLean = 0.04;
        c.torsoTwist = (w - 0.5) * 0.22;
        // Body mostly to the stage, turning a little toward the child as she
        // checks on them - the alternation IS the first hint.
        const bx = lerp(gapPos.x, playerPos.x, 0.25 + w * 0.4) - p.root.position.x;
        const bz = lerp(gapPos.z, playerPos.z, 0.25 + w * 0.4) - p.root.position.z;
        p.faceDirection(bx, bz, dt, 0.004);
        // Hands lightly clasped in front.
        c.left = { pitch: -0.42, spread: -0.02, twist: 0.1, elbow: 1.5, wrist: 0.15 };
        c.right = { pitch: -0.42, spread: -0.02, twist: -0.1, elbow: 1.5, wrist: 0.15 };
        break;
      }

      case 'wait': {
        // Turn to the child, smile, and pat the air down twice. Warm, not a "no".
        p.lookAt(playerPos.x, playerPos.y, playerPos.z);
        p.faceDirection(playerPos.x - p.root.position.x, playerPos.z - p.root.position.z, dt, 0.0009);
        c.crouch = smoothstep(0, 0.5, this.t) * 0.24;
        c.torsoLean = 0.1;
        c.torsoTwist = 0.12;
        const raise = smoothstep(0.05, 0.4, this.t);
        const pat = Math.sin(Math.max(0, this.t - 0.4) * 6.4) * 0.16 * smoothstep(1.9, 1.2, this.t);
        c.right = {
          pitch: -1.0 * raise + pat,
          spread: 0.34 * raise,
          twist: -0.5 * raise,
          // Forearm out flat so the palm faces the floor: the "wait" shape.
          elbow: 0.95 * raise,
          wrist: -0.9 * raise,
        };
        c.left = { pitch: -0.2, spread: 0.1, twist: 0, elbow: 0.35, wrist: 0 };
        break;
      }

      case 'cue': {
        // Down to eye level first, then the hand opens toward the stage.
        const down = smoothstep(0, 0.9, this.t);
        c.crouch = down * 0.92;
        c.torsoLean = 0.18 * down;
        p.lookAt(playerPos.x, playerPos.y, playerPos.z);
        p.faceDirection(playerPos.x - p.root.position.x, playerPos.z - p.root.position.z, dt, 0.0009);

        const open = smoothstep(0.55, 1.35, this.t);
        // Variant A: a wide open-handed sweep. Variant B: a beckon-then-point.
        const beckon = this.variant % 2 === 1 ? Math.sin(this.t * 4.2) * 0.1 * open : 0;
        // She stands between the child and the gap facing them, so the stage
        // lies off her left hand. That is the arm that has to open, or the
        // signal points them back into the wing.
        c.left = {
          pitch: -1.05 * open + beckon,
          spread: 0.18 + 0.98 * open,
          twist: 0.5 * open,
          elbow: 0.2,
          wrist: 0.32 * open,
        };
        c.right = { pitch: -0.26, spread: 0.12, twist: 0, elbow: 0.62, wrist: 0 };
        // A small encouraging nod on the beat.
        c.headPitch += Math.sin(this.t * 3.1) * 0.05 * open;
        break;
      }

      case 'sendOff': {
        // She stays low and just watches them go. A big wave here would swing
        // an arm straight across the lens as the camera follows the child out.
        c.crouch = damp(c.crouch, 0.72, 0.002, dt);
        p.lookAt(playerPos.x, playerPos.y + 0.1, playerPos.z);
        const wave = Math.sin(this.t * 3.6) * 0.1;
        c.left = { pitch: -0.62 + wave, spread: 0.16, twist: 0.12, elbow: 1.15, wrist: 0.2 };
        c.right = { pitch: -0.5, spread: 0.12, twist: 0, elbow: 1.0, wrist: 0 };
        c.torsoLean = 0.12;
        break;
      }
    }

    p.update(dt, time);
  }
}

/**
 * The other children in the wing. They fidget, they queue on their tape marks,
 * and one of them can demonstrate the peek when the player has stalled.
 */
export class WaitingChildren {
  readonly group = new Group();
  readonly puppets: Puppet[] = [];
  private homes: Vector3[] = [];
  private demoTimer = -1;
  private demoIndex = 0;
  private demoKind: 'peek' | 'go' = 'peek';
  private ambientTimer = 2;
  private rng: Rng;

  constructor(mats: Materials, rng: Rng, round: number) {
    this.rng = rng;
    const spots: [number, number, number][] = [
      [4.78, 2.41, Math.PI * 1.14],
      [5.75, 1.62, Math.PI * 1.0],
      [7.1, 3.0, Math.PI * 0.86],
      [7.5, 5.45, Math.PI * 0.95],
    ];
    spots.forEach(([x, z, yaw], i) => {
      const p = makeChild(mats, rng, i + 1 + round);
      p.root.position.set(x, LAYOUT.stageY, z);
      p.root.rotation.y = yaw;
      p.relaxArms();
      this.puppets.push(p);
      this.homes.push(new Vector3(x, LAYOUT.stageY, z));
      this.group.add(p.root);
    });
  }

  /**
   * Hint stage 2: somebody else does it first.
   * 'peek' slips forward to the gap and back; 'go' takes two steps toward the
   * stage and thinks better of it. Neither is ever explained.
   */
  playPeekDemo(kind: 'peek' | 'go' = 'peek'): void {
    if (this.demoTimer >= 0) return;
    this.demoTimer = 0;
    this.demoKind = kind;
    // Only the two who already stand near the curtain demonstrate: the ones
    // further back would have to walk straight through the player to get there.
    this.demoIndex = this.rng.int(0, Math.min(1, this.puppets.length - 1));
  }

  get demoActive(): boolean {
    return this.demoTimer >= 0;
  }

  update(dt: number, time: number, gap: Vector3, playerPos: Vector3): void {
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = this.rng.range(1.6, 4.2);
      const p = this.rng.pick(this.puppets);
      // A shuffle, a look at the curtain, a small hop: children waiting.
      p.ctl.bounce = 0.02;
      p.lookAt(gap.x, gap.y, gap.z);
    }

    for (let i = 0; i < this.puppets.length; i++) {
      const p = this.puppets[i];
      p.ctl.bounce = damp(p.ctl.bounce, 0, 0.002, dt);
      if (this.demoTimer < 0 || i !== this.demoIndex) {
        p.walkSpeed = damp(p.walkSpeed, 0, 0.0001, dt);
        p.root.position.lerp(this.homes[i], 1 - Math.pow(0.02, dt));
        if (this.rng.next() < dt * 0.5) {
          const look = this.rng.next() < 0.6 ? gap : playerPos;
          p.lookAt(look.x, look.y, look.z, 0.85);
        }
      }
      p.update(dt, time + i * 1.7);
    }

    if (this.demoTimer >= 0) {
      this.demoTimer += dt;
      const p = this.puppets[this.demoIndex];
      const t = this.demoTimer;
      const peekSpot =
        this.demoKind === 'go'
          ? new Vector3(gap.x + 0.15, LAYOUT.stageY, gap.z - 0.25)
          : new Vector3(gap.x + 0.55, LAYOUT.stageY, gap.z + 0.62);
      if (t < 1.5) {
        // Out to the curtain.
        const k = smoothstep(0, 1.5, t);
        p.root.position.lerpVectors(this.homes[this.demoIndex], peekSpot, k);
        p.walkSpeed = 0.55;
        p.faceDirection(peekSpot.x - p.root.position.x, peekSpot.z - p.root.position.z, dt, 0.0005);
        p.lookAt(gap.x, gap.y, gap.z);
      } else if (t < 2.6) {
        // A quick look through, leaning in.
        p.walkSpeed = 0;
        p.ctl.torsoLean = 0.3;
        p.lookAt(gap.x - 0.4, gap.y, gap.z - 1);
      } else if (t < 4.2) {
        // And straight back, a bit sheepish.
        const k = smoothstep(2.6, 4.2, t);
        p.ctl.torsoLean = 0;
        p.root.position.lerpVectors(peekSpot, this.homes[this.demoIndex], k);
        p.walkSpeed = 0.5;
        p.faceDirection(
          this.homes[this.demoIndex].x - p.root.position.x,
          this.homes[this.demoIndex].z - p.root.position.z,
          dt,
          0.0005,
        );
      } else {
        p.walkSpeed = 0;
        this.demoTimer = -1;
      }
    }
  }
}

/**
 * The act before yours: five children mid-number, upstage, seen only through
 * the gap. They finish, bow, and file off - which is what makes the wait end.
 */
export class PreviousAct {
  readonly group = new Group();
  private puppets: Puppet[] = [];
  private phase: 'dance' | 'bow' | 'exit' | 'gone' = 'dance';
  private t = 0;
  private starts: Vector3[] = [];

  constructor(mats: Materials, rng: Rng, round: number) {
    for (let i = 0; i < 5; i++) {
      const p = makeChild(mats, rng, i + round * 2);
      const x = -1.9 + i * 0.95;
      const z = 2.45 + (i % 2) * 0.5;
      p.root.position.set(x, LAYOUT.stageY, z);
      p.root.rotation.y = Math.PI; // facing the house
      this.starts.push(new Vector3(x, LAYOUT.stageY, z));
      this.puppets.push(p);
      this.group.add(p.root);
    }
  }

  finish(): void {
    if (this.phase === 'dance') {
      this.phase = 'bow';
      this.t = 0;
    }
  }

  get done(): boolean {
    return this.phase === 'gone';
  }

  update(dt: number, time: number): void {
    this.t += dt;
    for (let i = 0; i < this.puppets.length; i++) {
      const p = this.puppets[i];
      const off = i * 0.7;
      if (this.phase === 'dance') {
        // A simple 発表会 number: sway, arms up, sway.
        const beat = time * 2.1 + off;
        p.ctl.left = {
          pitch: -0.6 + Math.sin(beat) * 0.9,
          spread: 0.5 + Math.sin(beat) * 0.45,
          twist: 0,
          elbow: 0.3,
          wrist: 0,
        };
        p.ctl.right = {
          pitch: -0.6 - Math.sin(beat) * 0.9,
          spread: 0.5 - Math.sin(beat) * 0.45,
          twist: 0,
          elbow: 0.3,
          wrist: 0,
        };
        p.ctl.bounce = Math.abs(Math.sin(beat)) * 0.03;
        p.root.rotation.y = Math.PI + Math.sin(beat * 0.5) * 0.4;
      } else if (this.phase === 'bow') {
        p.ctl.left = { pitch: -0.1, spread: 0.06, twist: 0, elbow: 0.2, wrist: 0 };
        p.ctl.right = { pitch: -0.1, spread: 0.06, twist: 0, elbow: 0.2, wrist: 0 };
        p.ctl.bounce = 0;
        p.root.rotation.y = Math.PI;
        p.ctl.torsoLean = smoothstep(0.15, 0.7, this.t) * (1 - smoothstep(1.5, 2.1, this.t)) * 1.15;
        if (this.t > 2.5) {
          this.phase = 'exit';
          this.t = 0;
        }
      } else if (this.phase === 'exit') {
        // Off to stage left, in a wobbly line, the way they always do.
        const target = new Vector3(-7.2, LAYOUT.stageY, this.starts[i].z + 0.4);
        const k = clamp01((this.t - i * 0.18) / 3.2);
        p.root.position.lerpVectors(this.starts[i], target, smoothstep(0, 1, k));
        p.walkSpeed = k > 0 && k < 1 ? 0.85 : 0;
        p.ctl.torsoLean = 0;
        p.faceDirection(-1, 0.06, dt, 0.0006);
        if (k >= 1 && i === this.puppets.length - 1) {
          this.phase = 'gone';
          this.group.visible = false;
        }
      }
      p.update(dt, time + off);
    }
  }

  reset(): void {
    this.phase = 'dance';
    this.t = 0;
    this.group.visible = true;
    for (let i = 0; i < this.puppets.length; i++) {
      this.puppets[i].root.position.copy(this.starts[i]);
      this.puppets[i].walkSpeed = 0;
      this.puppets[i].ctl.torsoLean = 0;
    }
  }
}

export { COSTUMES };
