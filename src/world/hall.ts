import {
  BoxGeometry,
  Color,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
  type Material,
} from 'three/webgpu';
import { LAYOUT } from '../core/config';
import { Rng, clamp01 } from '../core/mathx';
import type { Materials } from '../art/materials';

const S = LAYOUT.stage;
const P = LAYOUT.proscenium;
const H = LAYOUT.house;

function box(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  mat: Material,
): Mesh {
  const m = new Mesh(new BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

/**
 * The building. Static geometry only - no dynamic shadow caster here except the
 * stage deck receiving, so the shadow budget stays with the child and the cloth.
 */
export class Hall {
  readonly group = new Group();
  readonly audienceBody: InstancedMesh;
  readonly audienceHead: InstancedMesh;
  readonly phoneScreens: Mesh[] = [];
  /** Per-parent sway phase, so the crowd is never a frozen wall of dolls. */
  private swayPhase: Float32Array;
  private baseMatrices: { pos: Vector3; scale: number }[] = [];
  private tmpObj = new Object3D();
  private frame = 0;

  constructor(mats: Materials, rng: Rng, fast: boolean) {
    const g = this.group;

    // ---------------------------------------------------------- stage deck
    const deckDepth = S.zBack - (S.zFront - 0.55);
    const deck = new Mesh(new BoxGeometry(S.xMax - S.xMin, LAYOUT.stageY, deckDepth), mats.wingWall);
    deck.position.set(0, LAYOUT.stageY / 2, (S.zFront - 0.55 + S.zBack) / 2);
    g.add(deck);

    // The waxed deck surface is its own plane so it can carry the hero material
    // and receive the spotlight shadows without paying for the box's 5 other faces.
    const deckTop = new Mesh(new PlaneGeometry(S.xMax - S.xMin, deckDepth, 1, 1), mats.stageFloor);
    deckTop.rotation.x = -Math.PI / 2;
    deckTop.position.set(0, LAYOUT.stageY + 0.001, (S.zFront - 0.55 + S.zBack) / 2);
    deckTop.receiveShadow = true;
    g.add(deckTop);

    // Nosing along the apron edge.
    g.add(box(S.xMax - S.xMin, 0.07, 0.09, 0, LAYOUT.stageY - 0.035, S.zFront - 0.595, mats.metalDark));

    // ---------------------------------------------------- proscenium & walls
    const jambW = H.xMax - P.xMax;
    for (const s of [-1, 1]) {
      g.add(
        box(
          jambW,
          H.ceilingY,
          P.wallThickness,
          s * (P.xMax + jambW / 2),
          H.ceilingY / 2,
          P.z,
          mats.wall,
        ),
      );
    }
    g.add(
      box(
        P.xMax - P.xMin,
        H.ceilingY - P.top,
        P.wallThickness,
        0,
        (H.ceilingY + P.top) / 2,
        P.z,
        mats.wall,
      ),
    );
    // Upstage of the proscenium a real hall is black, not painted plaster.
    // Without this the jamb becomes a bright slab beside the child as they walk.
    for (const s2 of [-1, 1]) {
      const mask = new Mesh(new PlaneGeometry(jambW, H.ceilingY, 1, 1), mats.blackout);
      mask.position.set(s2 * (P.xMax + jambW / 2), H.ceilingY / 2, P.z + P.wallThickness / 2 + 0.01);
      g.add(mask);
    }
    const headMask = new Mesh(new PlaneGeometry(P.xMax - P.xMin, H.ceilingY - P.top, 1, 1), mats.blackout);
    headMask.position.set(0, (H.ceilingY + P.top) / 2, P.z + P.wallThickness / 2 + 0.01);
    g.add(headMask);

    // Upstage wall and stage side walls (dark, so the wing reads as a pocket).
    g.add(box(S.xMax - S.xMin, 6.2, 0.3, 0, 3.1, S.zBack + 0.15, mats.wingWall));
    for (const s of [-1, 1]) {
      g.add(box(0.3, 6.2, S.zBack - S.zFront, s * (S.xMax + 0.15), 3.1, (S.zFront + S.zBack) / 2, mats.wingWall));
    }
    // Stage ceiling / grid deck: keeps the wing from leaking to a void above.
    g.add(box(S.xMax - S.xMin, 0.2, S.zBack - S.zFront + 1, 0, 6.6, (S.zFront + S.zBack) / 2, mats.wingWall));

    // Black masking legs further upstage, so the wing has real depth.
    for (const z of [5.7, 6.7]) {
      for (const s of [-1, 1]) {
        const leg = new Mesh(new PlaneGeometry(2.6, 4.4, 1, 1), mats.blackout);
        leg.position.set(s * 7.0, 0.55 + 2.2, z);
        g.add(leg);
      }
    }
    // One overhead border, over the stage where a real one masks the rig.
    const border = new Mesh(new PlaneGeometry(S.xMax - S.xMin, 1.4, 1, 1), mats.blackout);
    border.position.set(0, 5.6, 1.0);
    g.add(border);

    // ------------------------------------------------------------- the house
    const houseDepth = H.zNear - H.zBack;
    const houseFloor = new Mesh(new PlaneGeometry(H.xMax - H.xMin, houseDepth), mats.houseFloor);
    houseFloor.rotation.x = -Math.PI / 2;
    houseFloor.position.set(0, 0, (H.zNear + H.zBack) / 2);
    g.add(houseFloor);

    g.add(box(H.xMax - H.xMin, H.ceilingY, 0.3, 0, H.ceilingY / 2, H.zBack - 0.15, mats.houseWall));
    for (const s of [-1, 1]) {
      g.add(box(0.3, H.ceilingY, houseDepth, s * (H.xMax + 0.15), H.ceilingY / 2, (H.zNear + H.zBack) / 2, mats.houseWall));
    }
    g.add(box(H.xMax - H.xMin, 0.3, houseDepth, 0, H.ceilingY + 0.15, (H.zNear + H.zBack) / 2, mats.houseWall));

    // EXIT signs: the one thing that is always legible in a dark hall, and a
    // free depth cue for the back of the room.
    for (const s of [-1, 1]) {
      const sign = new Mesh(new PlaneGeometry(0.52, 0.24), mats.exitSign);
      sign.position.set(s * 6.4, 2.55, H.zBack + 0.02);
      g.add(sign);
      const halo = new Mesh(new PlaneGeometry(1.5, 0.9), mats.glow);
      (halo.material as MeshBasicMaterial).opacity = 0.14;
      halo.position.set(s * 6.4, 2.55, H.zBack + 0.03);
      g.add(halo);
    }

    // Wall sconces so parents are readable without lifting the house lights.
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const z = -4.2 - i * 3.4;
        const sc = new Mesh(new PlaneGeometry(0.28, 0.5), mats.glow);
        (sc.material as MeshBasicMaterial).opacity = 0.5;
        sc.position.set(s * (H.xMax - 0.05), 2.9, z);
        sc.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
        g.add(sc);
      }
    }

    // ------------------------------------------------------- seats & parents
    const seatCount = LAYOUT.seating.rows * LAYOUT.seating.seatsPerRow;
    const chairPan = new BoxGeometry(0.42, 0.05, 0.4);
    chairPan.translate(0, 0.44, 0);
    const chairBack = new BoxGeometry(0.42, 0.42, 0.05);
    chairBack.translate(0, 0.67, -0.18);
    const seatPan = new InstancedMesh(chairPan, mats.seat, seatCount);
    const seatBack = new InstancedMesh(chairBack, mats.seat, seatCount);
    seatPan.frustumCulled = false;
    seatBack.frustumCulled = false;

    // A seated grown-up: capsule torso, sphere head. Two draw calls for ~190 people.
    const bodyGeo = new CapsuleGeometry(0.18, 0.36, 4, 8);
    bodyGeo.scale(1.32, 1, 0.78);
    bodyGeo.translate(0, 0.9, -0.04);
    const headGeo = new SphereGeometry(0.122, 10, 8);
    headGeo.scale(0.95, 1.1, 1);
    headGeo.translate(0, 1.29, -0.02);
    this.audienceBody = new InstancedMesh(bodyGeo, mats.audience, seatCount);
    this.audienceHead = new InstancedMesh(headGeo, mats.audience, seatCount);
    this.audienceBody.frustumCulled = false;
    this.audienceHead.frustumCulled = false;
    // Coats, cardigans, dark winter jackets - a 発表会 audience in February.
    const COATS: [number, number, number][] = [
      [0.085, 0.09, 0.125], [0.13, 0.105, 0.1], [0.062, 0.07, 0.085],
      [0.15, 0.115, 0.13], [0.095, 0.11, 0.105], [0.17, 0.15, 0.13],
      [0.07, 0.095, 0.14], [0.12, 0.078, 0.085],
    ];
    const HAIRS: [number, number, number][] = [
      [0.045, 0.035, 0.03], [0.07, 0.052, 0.04], [0.032, 0.028, 0.028], [0.11, 0.093, 0.076],
    ];
    const col = new Color();

    this.swayPhase = new Float32Array(seatCount);
    const m = new Matrix4();
    const q = new Quaternion();
    const one = new Vector3(1, 1, 1);
    let n = 0;
    for (let r = 0; r < LAYOUT.seating.rows; r++) {
      const z = LAYOUT.seating.zStart - r * LAYOUT.seating.rowPitch;
      for (let c = 0; c < LAYOUT.seating.seatsPerRow; c++) {
        const centred = c - (LAYOUT.seating.seatsPerRow - 1) / 2;
        const aisle = Math.sign(centred) * LAYOUT.seating.aisleGap * 0.5;
        const x = centred * LAYOUT.seating.seatPitch + aisle + rng.range(-0.03, 0.03);
        const yaw = rng.range(-0.14, 0.14);
        q.setFromAxisAngle(new Vector3(0, 1, 0), yaw);
        m.compose(new Vector3(x, 0, z), q, one);
        seatPan.setMatrixAt(n, m);
        seatBack.setMatrixAt(n, m);
        // Not every chair is filled, and grown-ups come in different sizes.
        const filled = rng.next() > 0.08;
        const scale = filled ? rng.range(0.93, 1.12) : 0.0001;
        m.compose(new Vector3(x, 0, z), q, new Vector3(scale, scale, scale));
        this.audienceBody.setMatrixAt(n, m);
        this.audienceHead.setMatrixAt(n, m);
        const coat = COATS[rng.int(0, COATS.length - 1)];
        const hairC = HAIRS[rng.int(0, HAIRS.length - 1)];
        // Rows further back read darker: cheap, convincing aerial perspective.
        const depthFade = 1 - (r / LAYOUT.seating.rows) * 0.35;
        this.audienceBody.setColorAt(n, col.setRGB(coat[0] * depthFade, coat[1] * depthFade, coat[2] * depthFade));
        this.audienceHead.setColorAt(n, col.setRGB(hairC[0] * depthFade, hairC[1] * depthFade, hairC[2] * depthFade));
        this.baseMatrices.push({ pos: new Vector3(x, 0, z), scale });
        this.swayPhase[n] = rng.range(0, Math.PI * 2);
        n++;
      }
    }
    seatPan.instanceMatrix.needsUpdate = true;
    seatBack.instanceMatrix.needsUpdate = true;
    this.audienceBody.instanceMatrix.needsUpdate = true;
    this.audienceHead.instanceMatrix.needsUpdate = true;
    if (this.audienceBody.instanceColor) this.audienceBody.instanceColor.needsUpdate = true;
    if (this.audienceHead.instanceColor) this.audienceHead.instanceColor.needsUpdate = true;
    g.add(seatPan, seatBack, this.audienceBody, this.audienceHead);

    // A handful of phones held up: instantly reads as "a real 発表会".
    if (!fast) {
      for (let i = 0; i < 9; i++) {
        const r = rng.int(1, LAYOUT.seating.rows - 2);
        const z = LAYOUT.seating.zStart - r * LAYOUT.seating.rowPitch + 0.22;
        const x = rng.range(-3.6, 3.6);
        const scr = new Mesh(new PlaneGeometry(0.07, 0.13), mats.phoneScreen);
        scr.position.set(x, 1.42 + rng.range(-0.06, 0.12), z);
        scr.userData.phase = rng.range(0, 6.28);
        this.phoneScreens.push(scr);
        g.add(scr);
      }
    }

    // ---------------------------------------------------------- the wing set
    this.buildWing(mats, rng);
    this.buildLightingRig(mats);
  }

  private buildWing(mats: Materials, rng: Rng): void {
    const g = this.group;
    const y = LAYOUT.stageY;

    // 立ち位置テープ: vinyl crosses on the deck, one per waiting child.
    const marks: [number, number, boolean][] = [
      [LAYOUT.playerMark.x, LAYOUT.playerMark.z, true],
      [4.78, 2.41, false],
      [5.75, 1.62, false],
      [7.1, 3.0, false],
      [7.5, 5.45, false],
    ];
    for (const [x, z, isPlayer] of marks) {
      const mat = isPlayer ? mats.tape : mats.tapeAlt;
      const a = box(0.34, 0.004, 0.05, x, y + 0.003, z, mat);
      const b = box(0.05, 0.004, 0.34, x, y + 0.003, z, mat);
      g.add(a, b);
    }
    // A tape lane pointing at the gap - a line on the floor, not an arrow on the HUD.
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const x = 6.16 - t * 1.5;
      const z = 3.85 - t * 2.6;
      g.add(box(0.17, 0.004, 0.05, x, y + 0.003, z, mats.tapeAlt));
    }

    // 小道具箱 - prop boxes, cardboard and plastic.
    g.add(box(0.62, 0.42, 0.44, 7.2, y + 0.21, 2.35, mats.cardboard));
    g.add(box(0.56, 0.36, 0.4, 7.14, y + 0.6, 2.32, mats.cardboard));
    const crate = box(0.54, 0.32, 0.38, 7.6, y + 0.16, 3.7, mats.plasticBox);
    g.add(crate);

    // 折り畳み椅子 - a couple of open pipe chairs and a leaning stack.
    for (const [cx, cz, rot] of [
      [7.35, 4.35, -0.9],
      [7.62, 5.6, 0.2],
    ] as const) {
      const chair = new Group();
      chair.add(box(0.4, 0.04, 0.38, 0, 0.44, 0, mats.metalDark));
      chair.add(box(0.4, 0.4, 0.04, 0, 0.66, -0.17, mats.metalDark));
      for (const [ox, oz] of [
        [-0.17, -0.16],
        [0.17, -0.16],
        [-0.17, 0.16],
        [0.17, 0.16],
      ] as const) {
        const leg = new Mesh(new CylinderGeometry(0.014, 0.014, 0.44, 6), mats.metal);
        leg.position.set(ox, 0.22, oz);
        chair.add(leg);
      }
      chair.position.set(cx, y, cz);
      chair.rotation.y = rot;
      g.add(chair);
    }

    // 舞台袖照明 - a clamped work light with a blue gel on a stand.
    const stand = new Group();
    const pole = new Mesh(new CylinderGeometry(0.022, 0.03, 1.85, 8), mats.metal);
    pole.position.y = 0.92;
    stand.add(pole);
    for (let i = 0; i < 3; i++) {
      const foot = new Mesh(new CylinderGeometry(0.012, 0.012, 0.42, 5), mats.metal);
      foot.position.set(Math.cos((i / 3) * 6.283) * 0.17, 0.05, Math.sin((i / 3) * 6.283) * 0.17);
      foot.rotation.z = 0.5;
      foot.rotation.y = -(i / 3) * 6.283;
      stand.add(foot);
    }
    const shade = new Mesh(new CylinderGeometry(0.1, 0.15, 0.2, 10, 1, true), mats.metalDark);
    shade.position.set(0, 1.86, 0);
    shade.rotation.x = 0.55;
    stand.add(shade);
    const gel = new Mesh(new PlaneGeometry(0.24, 0.24), mats.glow);
    (gel.material as MeshBasicMaterial).opacity = 0.35;
    gel.position.set(0, 1.79, 0.08);
    gel.rotation.x = -1.0;
    stand.add(gel);
    stand.position.set(4.86, y, 2.86);
    g.add(stand);

    // Costume rail with a few spare capes: pure set-dressing depth.
    const rail = new Group();
    for (const s of [-1, 1]) {
      const p = new Mesh(new CylinderGeometry(0.018, 0.018, 1.5, 6), mats.metal);
      p.position.set(s * 0.45, 0.75, 0);
      rail.add(p);
    }
    const bar = new Mesh(new CylinderGeometry(0.016, 0.016, 0.95, 6), mats.metal);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 1.48;
    rail.add(bar);
    for (let i = 0; i < 4; i++) {
      const cape = new Mesh(new PlaneGeometry(0.24, 0.52, 2, 3), mats.costume('rail', [0.5, 0.36, 0.62], 'nonwoven'));
      cape.position.set(-0.32 + i * 0.22, 1.18, rng.range(-0.02, 0.02));
      rail.add(cape);
    }
    rail.position.set(7.6, y, 6.2);
    rail.rotation.y = -0.3;
    g.add(rail);
  }

  private buildLightingRig(mats: Materials): void {
    const g = this.group;
    // Overhead electrics: two bars of real fixtures. Hero material #4.
    for (const [z, count] of [
      [0.85, 7],
      [3.2, 5],
    ] as const) {
      const bar = new Mesh(new CylinderGeometry(0.028, 0.028, 9.6, 8), mats.metal);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, 5.15, z);
      g.add(bar);
      for (let i = 0; i < count; i++) {
        const x = ((i - (count - 1) / 2) / Math.max(1, (count - 1) / 2)) * 3.9;
        g.add(this.makeFixture(mats, x, 5.15, z, z < 2 ? 0.42 : 0.28));
      }
    }
    // Front-of-house bar, above the first rows.
    const foh = new Mesh(new CylinderGeometry(0.026, 0.026, 8.2, 8), mats.metal);
    foh.rotation.z = Math.PI / 2;
    foh.position.set(0, 5.3, -2.6);
    g.add(foh);
    for (let i = 0; i < 4; i++) {
      g.add(this.makeFixture(mats, -3 + i * 2, 5.3, -2.6, -0.55));
    }
  }

  private makeFixture(mats: Materials, x: number, y: number, z: number, tilt: number): Group {
    const f = new Group();
    const yoke = new Mesh(new CylinderGeometry(0.012, 0.012, 0.3, 6), mats.metalDark);
    yoke.position.y = -0.15;
    f.add(yoke);
    const body = new Mesh(new CylinderGeometry(0.105, 0.085, 0.34, 12), mats.metal);
    body.rotation.x = Math.PI / 2;
    f.add(body);
    // Barn doors.
    for (const [ox, oy, rot] of [
      [0, 0.12, 0.5],
      [0, -0.12, -0.5],
    ] as const) {
      const d = new Mesh(new BoxGeometry(0.22, 0.16, 0.01), mats.metalDark);
      d.position.set(ox, oy, 0.2);
      d.rotation.x = rot;
      f.add(d);
    }
    const lens = new Mesh(new PlaneGeometry(0.19, 0.19), mats.lampLens);
    lens.position.z = 0.175;
    f.add(lens);
    f.position.set(x, y - 0.2, z);
    f.rotation.x = -Math.PI / 2 + tilt;
    return f;
  }

  update(time: number, stride: number): void {
    // The crowd breathes. Updating a slice per frame keeps 190 people nearly free.
    this.frame++;
    const total = this.baseMatrices.length;
    const chunk = Math.ceil(total / Math.max(1, stride));
    const start = (this.frame % Math.max(1, stride)) * chunk;
    const m = new Matrix4();
    const q = new Quaternion();
    for (let i = start; i < Math.min(total, start + chunk); i++) {
      const b = this.baseMatrices[i];
      if (b.scale < 0.01) continue;
      const ph = this.swayPhase[i];
      const sway = Math.sin(time * 0.6 + ph) * 0.022 + Math.sin(time * 1.7 + ph * 1.6) * 0.008;
      q.setFromAxisAngle(new Vector3(0, 0, 1), sway);
      this.tmpObj.position.copy(b.pos);
      m.compose(b.pos, q, new Vector3(b.scale, b.scale, b.scale));
      this.audienceBody.setMatrixAt(i, m);
      q.setFromAxisAngle(new Vector3(0, 1, 0), sway * 2.4);
      m.compose(b.pos, q, new Vector3(b.scale, b.scale, b.scale));
      this.audienceHead.setMatrixAt(i, m);
    }
    this.audienceBody.instanceMatrix.needsUpdate = true;
    this.audienceHead.instanceMatrix.needsUpdate = true;

    for (const p of this.phoneScreens) {
      const ph = p.userData.phase as number;
      (p.material as MeshBasicMaterial).opacity = 1;
      p.scale.setScalar(0.9 + Math.sin(time * 0.9 + ph) * 0.06);
      p.rotation.z = Math.sin(time * 0.5 + ph) * 0.05;
    }
  }

  /**
   * Lifts the crowd out of the dark for the reveal. Per-instance colour carries
   * the variety, so this only has to scale the whole block.
   */
  setAudienceBrightness(mats: Materials, t: number): void {
    const k = clamp01(t);
    const v = 0.24 + k * 0.7;
    mats.audience.color.setRGB(v, v * 0.97, v * 1.02);
    mats.seat.color.setRGB(0.05 + k * 0.14, 0.045 + k * 0.12, 0.06 + k * 0.16);
  }
}
