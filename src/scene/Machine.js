// The hand-crank ice shaver. Everything is real geometry at real scale:
// a cast-iron foot on the counter, an enamelled body, a chromed blade table,
// and an exposed 24:15 spur pair so you can *see* that the handle drives the ice.

import {
  Group, Mesh, BoxGeometry, CylinderGeometry, TorusGeometry, SphereGeometry,
  MeshStandardMaterial, MeshPhysicalMaterial, Color, Vector3, DoubleSide,
  CanvasTexture, SRGBColorSpace, LatheGeometry, Vector2, Shape, ExtrudeGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { paintedMetalMaps, castIronMaps, chromeMaps, woodMaps } from '../util/procTextures.js';

// ---- machine datum -----------------------------------------------------------
// y = 0 is the counter top. z = +Z is toward the player.
export const M = {
  baseTop: 0.034,
  tableTop: 0.1975,
  tableR: 0.082,
  iceCenter: new Vector3(0, 0, 0.004),
  iceSize: new Vector3(0.116, 0.146, 0.116),
  bladeZ: 0.040,
  bladeHalfX: 0.062,
  // the table is cut flat in front of the blade so the snow leaves in open view
  tableFrontZ: 0.048,
  spoutY: 0.1880,
  crankAxis: new Vector3(0.072911, 0.4460, -0.028),
  crankR: 0.095,
  gearY: 0.4305,
  bracketY: 0.4050,
  gearBigR: 0.0490,
  gearSmallR: 0.0490 / 1.6,
  gearRatio: 24 / 15,
  columnZ: -0.088,
  shaftTop: 0.4250,
};

function gearGeometry(pitchR, teeth, thickness) {
  const module = (2 * Math.PI * pitchR) / teeth;   // circular pitch
  const add = module * 0.32;                        // addendum
  const ded = module * 0.40;                        // dedendum
  const bodyR = pitchR - ded;
  const parts = [new CylinderGeometry(bodyR, bodyR, thickness, Math.max(20, teeth * 2))];
  const tw = module * 0.46;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const g = new BoxGeometry(tw, thickness, add + ded);
    g.translate(0, 0, bodyR + (add + ded) * 0.5);
    g.rotateY(-a);
    parts.push(g);
  }
  // hub + lightening ring so it reads as a cast part, not a disc
  const hub = new CylinderGeometry(pitchR * 0.24, pitchR * 0.24, thickness * 1.9, 14);
  parts.push(hub);
  return mergeGeometries(parts, false);
}

/** ExtrudeGeometry emits object-space UVs; rescale them to 0..1 across the part. */
function normaliseUV(geo, span) {
  const uv = geo.attributes.uv;
  if (!uv) return;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) / span + 0.5, uv.getY(i) / span + 0.5);
  }
  uv.needsUpdate = true;
}

function namePlate() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#d9b46a'); g.addColorStop(0.5, '#a9832f'); g.addColorStop(1, '#c8a154');
  x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  x.strokeStyle = 'rgba(60,40,10,.55)'; x.lineWidth = 5;
  x.strokeRect(9, 9, 238, 110);
  x.fillStyle = 'rgba(50,32,8,.82)';
  x.font = '600 74px "Hiragino Mincho ProN", "Yu Mincho", serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('氷', 84, 66);
  x.font = '500 26px "Hiragino Mincho ProN", serif';
  x.fillText('削 氷 機', 172, 56);
  x.font = '400 15px serif';
  x.fillText('三 号', 172, 88);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export class Machine {
  constructor(parent, quality) {
    this.quality = quality;
    this.group = new Group();
    parent.add(this.group);

    const paint = paintedMetalMaps(quality.paintTex, [0.505, 0.140, 0.118]);
    const iron = castIronMaps(512);
    const chrome = chromeMaps(512);
    this.maps = { paint, iron, chrome };

    this.paintMat = new MeshPhysicalMaterial({
      map: paint.map, roughnessMap: paint.roughnessMap, normalMap: paint.normalMap,
      metalnessMap: paint.metalnessMap,
      metalness: 1.0, roughness: 1.0, color: 0xffffff,
      clearcoat: 0.62, clearcoatRoughness: 0.24,
      envMapIntensity: 1.0,
    });
    this.paintMat.normalScale.set(0.34, 0.34);

    this.ironMat = new MeshStandardMaterial({
      map: iron.map, roughnessMap: iron.roughnessMap, normalMap: iron.normalMap,
      metalness: 0.12, roughness: 1.0, color: 0xffffff, envMapIntensity: 0.6,
    });

    this.chromeMat = new MeshStandardMaterial({
      color: new Color(0.86, 0.87, 0.89), metalness: 1.0, roughness: 1.0,
      roughnessMap: chrome.roughnessMap, metalnessMap: chrome.metalnessMap,
      normalMap: chrome.normalMap, envMapIntensity: 1.05,
    });
    this.chromeMat.normalScale.set(0.14, 0.14);

    this.steelMat = new MeshStandardMaterial({
      color: new Color(0.52, 0.525, 0.535), metalness: 1.0, roughness: 0.52,
      roughnessMap: chrome.roughnessMap, envMapIntensity: 0.75,
    });
    this.steelMat.roughness = 1.0;

    const gw = woodMaps(256);
    gw.map.repeat.set(2.4, 1.0); gw.roughnessMap.repeat.copy(gw.map.repeat); gw.normalMap.repeat.copy(gw.map.repeat);
    this.woodMat = new MeshStandardMaterial({
      map: gw.map, roughnessMap: gw.roughnessMap, normalMap: gw.normalMap,
      color: new Color(0.86, 0.74, 0.62), roughness: 0.95, metalness: 0.0,
    });
    this.woodMat.normalScale.set(0.35, 0.35);

    this._base();
    this._column();
    this._table();
    this._holder();
    this._drive();

    this.group.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });

    // Phase the two gears so a tooth always meets a gap on the line of centres.
    // With an exact 24:15 ratio this holds for every angle, not just the first.
    const mu = Math.atan2(M.iceCenter.z - M.crankAxis.z, M.iceCenter.x - M.crankAxis.x);
    this.phaseBig = Math.PI / 2 - mu;
    this.phaseSmall = Math.PI / 2 + Math.PI - mu + Math.PI / 15;

    this.crankAngle = 0;
    this.iceAngle = 0;
  }

  _base() {
    const g = new Group();
    // A U-shaped foot: the back carries the column, two rails run forward, and the
    // middle is left open so the bowl stands on the counter itself.
    const back = new Mesh(new RoundedBoxGeometry(0.256, 0.024, 0.104, 3, 0.009), this.ironMat);
    back.position.set(0, 0.022, -0.070);
    g.add(back);
    for (const sx of [-1, 1]) {
      const rail = new Mesh(new RoundedBoxGeometry(0.026, 0.019, 0.244, 3, 0.007), this.ironMat);
      rail.position.set(sx * 0.116, 0.0185, 0.004);
      g.add(rail);
    }
    const plinth = new Mesh(new RoundedBoxGeometry(0.270, 0.010, 0.116, 2, 0.005), this.ironMat);
    plinth.position.set(0, 0.007, -0.070);
    g.add(plinth);

    for (const [x, z] of [[-0.116, -0.096], [0.116, -0.096], [-0.116, 0.108], [0.116, 0.108]]) {
      const foot = new Mesh(new CylinderGeometry(0.0155, 0.018, 0.008, 12), this.ironMat);
      foot.position.set(x, 0.004, z);
      g.add(foot);
      const pad = new Mesh(new CylinderGeometry(0.016, 0.016, 0.0018, 12), this.woodMat);
      pad.position.set(x, 0.0009, z);
      g.add(pad);
    }
    this.group.add(g);
    this.base = g;
  }

  _column() {
    const g = new Group();
    // the enamelled spine, slightly tapered like a casting
    const col = new Mesh(new RoundedBoxGeometry(0.098, 0.392, 0.074, 3, 0.014), this.paintMat);
    col.position.set(0, 0.034 + 0.196, M.columnZ);
    g.add(col);

    // a swelling foot where the column meets the base — cast iron never meets square
    const fillet = new Mesh(new CylinderGeometry(0.062, 0.086, 0.044, 20), this.paintMat);
    fillet.position.set(0, 0.050, M.columnZ);
    fillet.scale.z = 0.85;
    g.add(fillet);

    // pinstripe: a thin gold band, the one decorative flourish
    for (const y of [0.115, 0.330]) {
      const ring = new Mesh(new BoxGeometry(0.0995, 0.0035, 0.0755), new MeshStandardMaterial({
        color: new Color(0.66, 0.50, 0.20), metalness: 0.9, roughness: 0.42,
      }));
      ring.position.set(0, y, M.columnZ);
      g.add(ring);
    }

    // maker's plate on the front of the column
    const plate = new Mesh(new BoxGeometry(0.070, 0.036, 0.0022), new MeshStandardMaterial({
      map: namePlate(), metalness: 0.85, roughness: 0.42,
    }));
    plate.position.set(0, 0.252, M.columnZ + 0.0382);
    g.add(plate);

    // bracket arm reaching forward over the ice, carrying the drive shaft
    const arm = new Mesh(new RoundedBoxGeometry(0.070, 0.032, 0.136, 3, 0.011), this.paintMat);
    arm.position.set(0, M.bracketY, M.columnZ + 0.052);
    g.add(arm);
    const boss = new Mesh(new CylinderGeometry(0.026, 0.030, 0.036, 18), this.paintMat);
    boss.position.set(0, M.bracketY, M.iceCenter.z);
    g.add(boss);

    // the crank's own bearing post, offset to the right
    const post = new Mesh(new CylinderGeometry(0.021, 0.026, 0.040, 16), this.paintMat);
    post.position.set(M.crankAxis.x, M.bracketY, M.crankAxis.z);
    g.add(post);
    const strut = new Mesh(new RoundedBoxGeometry(0.086, 0.026, 0.040, 2, 0.009), this.paintMat);
    strut.position.set(M.crankAxis.x * 0.5, M.bracketY, (M.crankAxis.z + M.columnZ + 0.052) * 0.5);
    strut.rotation.y = Math.atan2(M.crankAxis.x, 0.026);
    g.add(strut);

    this.group.add(g);
    this.column = g;
  }

  _table() {
    const g = new Group();
    const z = M.iceCenter.z;

    // Chromed blade table, cut flat across the front: the snow leaves the slot in
    // the open air instead of disappearing under a full disc.
    const sh = new Shape();
    const flat = M.tableFrontZ - z;                    // local z of the straight edge
    const a0 = Math.asin(Math.min(1, flat / M.tableR));
    sh.moveTo(Math.cos(a0) * M.tableR, flat);
    sh.absarc(0, 0, M.tableR, a0, Math.PI * 2 - a0, false);
    sh.lineTo(Math.cos(a0) * M.tableR, flat);
    const deckGeo = new ExtrudeGeometry(sh, { depth: 0.009, bevelEnabled: true, bevelThickness: 0.0016, bevelSize: 0.0018, bevelSegments: 2, curveSegments: 36 });
    deckGeo.rotateX(-Math.PI / 2);
    normaliseUV(deckGeo, M.tableR * 2);
    const deck = new Mesh(deckGeo, this.chromeMat);
    deck.position.set(0, M.tableTop, z);
    g.add(deck);

    // rolled edge around the curved part only
    const rimGeo = new TorusGeometry(M.tableR, 0.0042, 7, 40, Math.PI * 2 - a0 * 2);
    const rim = new Mesh(rimGeo, this.chromeMat);
    rim.rotation.x = Math.PI / 2;
    rim.rotation.z = -a0;
    rim.position.set(0, M.tableTop - 0.0045, z);
    g.add(rim);

    // the slot, and the blade seated in it just proud of the surface
    const slot = new Mesh(new BoxGeometry(M.bladeHalfX * 2.06, 0.0094, 0.0062),
      new MeshStandardMaterial({ color: new Color(0.03, 0.03, 0.035), roughness: 0.9, metalness: 0.2 }));
    slot.position.set(0, M.tableTop - 0.0047, M.bladeZ + 0.0038);
    g.add(slot);

    const blade = new Mesh(new BoxGeometry(M.bladeHalfX * 2.0, 0.0030, 0.0105),
      new MeshStandardMaterial({ color: new Color(0.90, 0.91, 0.94), metalness: 1.0, roughness: 0.09, envMapIntensity: 1.5 }));
    blade.position.set(0, M.tableTop - 0.0006, M.bladeZ - 0.0026);
    blade.rotation.x = -0.20;
    g.add(blade);
    this.blade = blade;

    // brass thumbwheels that set the cut depth
    for (const sx of [-1, 1]) {
      const knob = new Mesh(new CylinderGeometry(0.0075, 0.0075, 0.0056, 12), new MeshStandardMaterial({
        color: new Color(0.62, 0.47, 0.19), metalness: 0.95, roughness: 0.33,
      }));
      knob.position.set(sx * (M.bladeHalfX + 0.012), M.tableTop + 0.0035, M.bladeZ - 0.006);
      g.add(knob);
      const stem = new Mesh(new CylinderGeometry(0.0022, 0.0022, 0.010, 8), this.steelMat);
      stem.position.set(sx * (M.bladeHalfX + 0.012), M.tableTop - 0.0015, M.bladeZ - 0.006);
      g.add(stem);
    }

    // pedestal at the back, so the front of the bowl stays wide open
    const ped = new Mesh(new RoundedBoxGeometry(0.112, 0.166, 0.086, 3, 0.014), this.paintMat);
    ped.position.set(0, M.baseTop + 0.082, M.columnZ + 0.020);
    g.add(ped);
    // a cast shoulder where the body meets the table, so it is not a plain box
    const shoulder = new Mesh(new CylinderGeometry(0.052, 0.062, 0.026, 20), this.paintMat);
    shoulder.position.set(0, M.tableTop - 0.020, M.columnZ + 0.020);
    shoulder.scale.z = 0.9;
    g.add(shoulder);

    // chute lip that throws the snow a few millimetres clear of the machine
    const chute = new Mesh(new BoxGeometry(M.bladeHalfX * 2.12, 0.0022, 0.020),
      new MeshStandardMaterial({ color: new Color(0.80, 0.82, 0.85), metalness: 1.0, roughness: 0.26, side: DoubleSide }));
    chute.position.set(0, M.tableTop - 0.0115, M.bladeZ + 0.014);
    chute.rotation.x = 0.30;
    g.add(chute);

    this.group.add(g);
    this.table = g;
  }

  _holder() {
    // Turns with the ice: a chromed cap with claws biting the top of the block,
    // plus a cage of rods so you can still see the ice through it.
    const g = new Group();
    const cap = new Mesh(new CylinderGeometry(0.052, 0.047, 0.013, 24), this.chromeMat);
    cap.position.y = 0.0135;
    g.add(cap);
    const dome = new Mesh(new SphereGeometry(0.038, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), this.chromeMat);
    dome.position.y = 0.019;
    dome.scale.y = 0.62;
    g.add(dome);
    // three claws bitten down into the top face; nothing else touches the block,
    // so you can watch the corners come round
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      const arm = new Mesh(new BoxGeometry(0.030, 0.0055, 0.011), this.steelMat);
      arm.position.set(Math.cos(a) * 0.030, 0.0075, Math.sin(a) * 0.030);
      arm.rotation.y = -a;
      g.add(arm);
      const claw = new Mesh(new CylinderGeometry(0.0026, 0.0050, 0.024, 8), this.steelMat);
      claw.position.set(Math.cos(a) * 0.0435, -0.002, Math.sin(a) * 0.0435);
      g.add(claw);
    }

    this.holder = g;
    this.group.add(g);

    // telescoping drive shaft down from the bracket boss
    this.shaft = new Mesh(new CylinderGeometry(0.0105, 0.0105, 0.20, 14), this.chromeMat);
    this.group.add(this.shaft);
    // knurled press collar riding the shaft
    this.collar = new Mesh(new CylinderGeometry(0.0175, 0.0175, 0.016, 18), this.steelMat);
    this.group.add(this.collar);
  }

  _drive() {
    const gearMat = this.steelMat;
    this.gearSmall = new Mesh(gearGeometry(M.gearSmallR, 15, 0.0105), gearMat);
    this.gearSmall.position.set(M.iceCenter.x, M.gearY, M.iceCenter.z);
    this.group.add(this.gearSmall);

    this.gearBig = new Mesh(gearGeometry(M.gearBigR, 24, 0.0105), gearMat);
    this.gearBig.position.set(M.crankAxis.x, M.gearY, M.crankAxis.z);
    this.group.add(this.gearBig);

    const axle = new Mesh(new CylinderGeometry(0.0088, 0.0088, 0.030, 12), this.chromeMat);
    axle.position.set(M.crankAxis.x, (M.gearY + M.crankAxis.y) * 0.5, M.crankAxis.z);
    axle.scale.y = (M.crankAxis.y - M.gearY) / 0.030;
    this.group.add(axle);

    // ---- the crank itself ----
    const c = new Group();
    c.position.copy(M.crankAxis);
    const hubT = new Mesh(new CylinderGeometry(0.0135, 0.0155, 0.014, 16), this.chromeMat);
    c.add(hubT);
    const arm = new Mesh(new RoundedBoxGeometry(M.crankR + 0.052, 0.0125, 0.024, 2, 0.006), this.paintMat);
    arm.position.set((M.crankR - 0.026) * 0.5, 0.004, 0);
    c.add(arm);
    // counterweight on the short side gives the handle its idle drift
    const cw = new Mesh(new SphereGeometry(0.0155, 14, 10), this.paintMat);
    cw.position.set(-0.028, 0.004, 0);
    cw.scale.set(1.0, 0.75, 0.9);
    c.add(cw);

    const ferrule = new Mesh(new CylinderGeometry(0.0092, 0.0092, 0.012, 14), this.chromeMat);
    ferrule.position.set(M.crankR, 0.012, 0);
    c.add(ferrule);

    // turned wooden grip — the one warm thing you actually touch
    const prof = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const r = 0.0128 * (0.80 + 0.34 * Math.sin(t * Math.PI) - 0.10 * Math.pow(t, 3));
      prof.push(new Vector2(r, t * 0.055));
    }
    const grip = new Mesh(new LatheGeometry(prof, 20), this.woodMat);
    grip.position.set(M.crankR, 0.017, 0);
    c.add(grip);
    const gcap = new Mesh(new SphereGeometry(0.0104, 14, 8), this.woodMat);
    gcap.position.set(M.crankR, 0.0715, 0);
    gcap.scale.y = 0.6;
    c.add(gcap);

    c.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.crank = c;
    this.gripLocal = new Vector3(M.crankR, 0.030, 0);
    this.group.add(c);
  }

  /**
   * The whole kinematic chain. `iceAngle` is passed in rather than derived because
   * the claws have play in them: the shaft turns before the block does.
   */
  setCrank(angle, iceAngle, iceTop) {
    this.crankAngle = angle;
    this.iceAngle = iceAngle;
    const shaftAngle = -angle * M.gearRatio;
    this.crank.rotation.y = angle;
    this.gearBig.rotation.y = angle + this.phaseBig;
    this.gearSmall.rotation.y = shaftAngle + this.phaseSmall;
    this.holder.rotation.y = iceAngle;
    this.holder.position.set(M.iceCenter.x, iceTop, M.iceCenter.z);

    const shaftTop = M.gearY - 0.004;
    const shaftBot = iceTop + 0.030;
    const len = Math.max(0.02, shaftTop - shaftBot);
    this.shaft.position.set(M.iceCenter.x, (shaftTop + shaftBot) * 0.5, M.iceCenter.z);
    this.shaft.scale.y = len / 0.20;
    this.shaft.rotation.y = shaftAngle;
    this.collar.position.set(M.iceCenter.x, shaftBot + 0.014, M.iceCenter.z);
    this.collar.rotation.y = iceAngle;
  }

  /**
   * The whole machine leans a hair against the hand. It costs the player nothing --
   * there is no weight to fight -- but a shaver that never moves reads as a picture
   * of a shaver.
   */
  setReaction(rig, omega, dOmega, dt) {
    this._rv = (this._rv || 0) + (-dOmega * 0.00022 - (this._r || 0) * 62 - (this._rv || 0) * 9.5) * dt;
    this._r = (this._r || 0) + this._rv * dt;
    this._r = Math.max(-0.010, Math.min(0.010, this._r));
    const hum = Math.sin(this.crankAngle * 24) * Math.min(Math.abs(omega), 12) * 0.00006;
    rig.rotation.z = this._r;
    rig.rotation.x = this._r * 0.35 + hum;
    rig.position.y = -Math.abs(this._r) * 0.05;
  }

  /** Momentarily sharpens the plating, so the reflection actually travels. */
  setGlint(amount) {
    if (this.glintAmt === amount) return;
    this.glintAmt = amount;
    this.chromeMat.envMapIntensity = 1.05 + amount * 1.6;
    this.steelMat.envMapIntensity = 0.75 + amount * 1.1;
  }

  /** World-space position of the wooden grip, for input hit-testing and audio. */
  gripWorld(out) {
    return out.copy(this.gripLocal).applyMatrix4(this.crank.matrixWorld);
  }

  setEnvMap(env) {
    for (const m of [this.paintMat, this.ironMat, this.chromeMat, this.steelMat, this.woodMat]) {
      m.envMap = env; m.needsUpdate = true;
    }
  }
}
