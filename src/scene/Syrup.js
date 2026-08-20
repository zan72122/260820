// Syrup bottles standing on the counter, and what happens when you tip one.
//
// There is no colour menu: the bottles are objects. You pick one up, hold it over
// the pile, and while it is tilted a real stream leaves the spout, lands, wets the
// surface, and sinks in. The colour that appears on the ice is painted by the
// simulation, never by recolouring the mesh.

import {
  Group, Mesh, LatheGeometry, CylinderGeometry, SphereGeometry, Vector2, Vector3,
  MeshPhysicalMaterial, MeshStandardMaterial, Color, CanvasTexture, SRGBColorSpace,
  BufferGeometry, BufferAttribute, DoubleSide, InstancedMesh, Object3D, DynamicDrawUsage,
} from 'three';
import { mulberry32 } from '../util/rand.js';

export const FLAVOURS = [
  { name: 'いちご', color: new Color(0.700, 0.042, 0.048) },
  { name: 'メロン', color: new Color(0.215, 0.610, 0.125) },
  { name: 'ブルーハワイ', color: new Color(0.055, 0.315, 0.820) },
];

function labelTexture(name, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#f3ead2'; x.fillRect(0, 0, 256, 128);
  x.fillStyle = 'rgba(0,0,0,.06)';
  for (let i = 0; i < 220; i++) x.fillRect(Math.random() * 256, Math.random() * 128, 1, 1);
  const hex = '#' + color.clone().convertLinearToSRGB().getHexString();
  x.strokeStyle = hex; x.lineWidth = 4;
  x.strokeRect(10, 12, 236, 104);
  x.fillStyle = hex;
  x.font = '600 46px "Hiragino Mincho ProN", "Yu Mincho", serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(name, 128, 60);
  x.font = '400 15px serif';
  x.fillStyle = 'rgba(70,55,35,.75)';
  x.fillText('シ ロ ッ プ', 128, 98);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

const BODY = [
  [0.0000, 0.000], [0.0195, 0.000], [0.0212, 0.006], [0.0212, 0.072],
  [0.0206, 0.086], [0.0150, 0.100], [0.0098, 0.108], [0.0092, 0.124],
  [0.0108, 0.130], [0.0100, 0.133],
];

export class Bottle {
  constructor(scene, flavour, home, quality) {
    this.flavour = flavour;
    this.home = home.clone();
    this.group = new Group();
    this.group.position.copy(home);
    scene.add(this.group);

    const glassProfile = BODY.map(([r, y]) => new Vector2(r, y));
    const glass = new Mesh(new LatheGeometry(glassProfile, quality.bottleSegments), new MeshPhysicalMaterial({
      color: new Color(0.92, 0.96, 0.95),
      roughness: 0.05, metalness: 0.0,
      transmission: quality.transmission ? 1.0 : 0.0,
      transparent: !quality.transmission,
      opacity: quality.transmission ? 1.0 : 0.35,
      thickness: 0.004, ior: 1.5,
      side: DoubleSide, envMapIntensity: 1.3,
      clearcoat: 0.4,
    }));
    this.group.add(glass);
    this.glass = glass;

    // the syrup inside: this is where the colour actually lives
    const fill = BODY.filter(([, y]) => y <= 0.098).map(([r, y]) => new Vector2(Math.max(0.0001, r - 0.0016), y + 0.0016));
    fill.push(new Vector2(0.0001, 0.0995));
    const liq = new Mesh(new LatheGeometry(fill, quality.bottleSegments), new MeshPhysicalMaterial({
      color: flavour.color,
      roughness: 0.14, metalness: 0.0,
      transparent: false, opacity: 1.0,
      clearcoat: 0.7, clearcoatRoughness: 0.08,
      sheen: 0.5, sheenColor: flavour.color.clone().lerp(new Color(1, 1, 1), 0.5),
      envMapIntensity: 1.1,
    }));
    this.group.add(liq);
    this.liquid = liq;

    const label = new Mesh(new CylinderGeometry(0.0216, 0.0216, 0.040, 24, 1, true), new MeshStandardMaterial({
      map: labelTexture(flavour.name, flavour.color), roughness: 0.82, metalness: 0.0, side: DoubleSide,
    }));
    label.position.y = 0.040;
    this.group.add(label);

    const cap = new Mesh(new CylinderGeometry(0.0112, 0.0104, 0.017, 18), new MeshStandardMaterial({
      color: new Color(0.72, 0.70, 0.66), roughness: 0.42, metalness: 0.15,
    }));
    cap.position.y = 0.1275;
    this.group.add(cap);
    const spout = new Mesh(new CylinderGeometry(0.0042, 0.0052, 0.014, 14), new MeshStandardMaterial({
      color: new Color(0.80, 0.80, 0.78), roughness: 0.35, metalness: 0.1,
    }));
    spout.position.y = 0.1415;
    spout.rotation.z = 0.16;
    this.group.add(spout);

    this.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    this.spoutLocal = new Vector3(0.0022, 0.1485, 0);
    this.held = 0;         // 0 on the counter, 1 fully in hand
    this.tilt = 0;
    this.target = home.clone();
  }

  spoutWorld(out) {
    this.group.updateMatrixWorld();
    return out.copy(this.spoutLocal).applyMatrix4(this.group.matrixWorld);
  }

  setEnvMap(env) {
    for (const m of [this.glass.material, this.liquid.material]) { m.envMap = env; m.needsUpdate = true; }
  }
}

// -----------------------------------------------------------------------------

export class SyrupStage {
  constructor(scene, { quality, mound }) {
    this.mound = mound;
    this.quality = quality;
    this.bottles = [];
    this.rnd = mulberry32(555);
    // beside the bowl on a wide screen; in front of it on a tall one, so the
    // machine, the bowl and the bottles stack down the screen
    this.LAYOUT = {
      landscape: [
        new Vector3(-0.163, 0, 0.176),
        new Vector3(-0.246, 0, 0.104),
        new Vector3(-0.278, 0, 0.012),
      ],
      portrait: [
        new Vector3(-0.118, 0, 0.212),
        new Vector3(0.004, 0, 0.246),
        new Vector3(0.126, 0, 0.212),
      ],
    };
    for (let i = 0; i < 3; i++) {
      const b = new Bottle(scene, FLAVOURS[i], this.LAYOUT.landscape[i], quality);
      b.group.scale.setScalar(0.88);
      b.group.rotation.y = (i - 1) * 0.45 + 0.3;
      b.baseYaw = b.group.rotation.y;
      this.bottles.push(b);
    }

    // ---- the falling stream -------------------------------------------------
    this.RINGS = 14; this.SIDES = 7;
    const verts = new Float32Array(this.RINGS * this.SIDES * 3);
    const idx = [];
    for (let r = 0; r < this.RINGS - 1; r++) {
      for (let s = 0; s < this.SIDES; s++) {
        const a = r * this.SIDES + s;
        const b = r * this.SIDES + ((s + 1) % this.SIDES);
        const c = (r + 1) * this.SIDES + s;
        const d = (r + 1) * this.SIDES + ((s + 1) % this.SIDES);
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(verts, 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(verts.length), 3));
    g.setIndex(idx);
    this.streamGeo = g;
    this.streamMat = new MeshPhysicalMaterial({
      color: new Color(1, 1, 1), roughness: 0.045, metalness: 0.0,
      transparent: true, opacity: 0.93, side: DoubleSide,
      clearcoat: 1.0, clearcoatRoughness: 0.03,
      envMapIntensity: 1.4,
    });
    this.stream = new Mesh(g, this.streamMat);
    this.stream.frustumCulled = false;
    this.stream.visible = false;
    this.stream.renderOrder = 3;
    scene.add(this.stream);

    // ---- splash droplets ----------------------------------------------------
    this.DROPS = quality.dropCount;
    this.dropMat = new MeshPhysicalMaterial({
      color: new Color(1, 1, 1), roughness: 0.045, metalness: 0.0,
      transparent: true, opacity: 0.94, clearcoat: 1.0, clearcoatRoughness: 0.04,
      envMapIntensity: 1.4,
    });
    this.drops = new InstancedMesh(new SphereGeometry(1, 7, 5), this.dropMat, this.DROPS);
    this.drops.instanceMatrix.setUsage(DynamicDrawUsage);
    this.drops.frustumCulled = false;
    this.drops.visible = false;
    scene.add(this.drops);
    this.dp = new Float32Array(this.DROPS * 3);
    this.dv = new Float32Array(this.DROPS * 3);
    this.ds = new Float32Array(this.DROPS);
    this.dl = new Float32Array(this.DROPS);
    this._o = new Object3D();
    this._v = new Vector3();
    this._spout = new Vector3();

    this.pouring = null;      // { bottle, hit:Vector3 }
    this.flow = 0;
    this.hint = 0;            // seconds of "these are for you" left to play
    this.t = 0;
  }

  setVisible(v) { for (const b of this.bottles) b.group.visible = v; }

  /** Called on resize: the bottles physically move when the screen turns. */
  setLayout(portrait) {
    const homes = portrait ? this.LAYOUT.portrait : this.LAYOUT.landscape;
    for (let i = 0; i < this.bottles.length; i++) {
      const b = this.bottles[i];
      b.home.copy(homes[i]);
      b.baseYaw = portrait ? (i - 1) * 0.5 : (i - 1) * 0.45 + 0.3;
      if (b.held <= 0) b.target.copy(b.home);
    }
  }

  reset() {
    for (const b of this.bottles) {
      b.held = 0; b.tilt = 0;
      b.group.position.copy(b.home);
      b.group.rotation.set(0, b.baseYaw, 0);
    }
    this.pouring = null; this.flow = 0; this.hint = 0;
    this.stream.visible = false;
    this.drops.visible = false;
    for (let i = 0; i < this.DROPS; i++) this.dl[i] = 0;
  }

  /** Where the stream will land: straight down from the spout onto the pile. */
  impactPoint(bottle, out) {
    bottle.spoutWorld(this._spout);
    const y = this.mound.surfaceY(this._spout.x, this._spout.z);
    return out.set(this._spout.x, y, this._spout.z);
  }

  update(dt, camera) {
    // ---- bottle transforms --------------------------------------------------
    this.t += dt;
    if (this.hint > 0) this.hint -= dt;
    for (let i = 0; i < this.bottles.length; i++) {
      const b = this.bottles[i];
      b.group.position.lerp(b.target, Math.min(1, dt * 13));
      b.tilt += ((b.tiltTarget || 0) - b.tilt) * Math.min(1, dt * 9);
      // no arrow, no label: they just lift a little, in turn, until one is picked up
      const cue = b.held > 0 || this.hint <= 0 ? 0
        : Math.max(0, Math.sin(this.t * 2.2 - i * 1.1)) * 0.010 * Math.min(1, this.hint / 1.5);
      b.group.position.y += cue;
      b.group.rotation.set(cue * 1.2, b.baseYaw + (b.yawExtra || 0), -b.tilt);
    }

    // ---- stream -------------------------------------------------------------
    const p = this.pouring;
    const wantFlow = p ? Math.max(0, Math.min(1, (p.bottle.tilt - 0.42) / 0.45)) : 0;
    this.flow += (wantFlow - this.flow) * Math.min(1, dt * (wantFlow > this.flow ? 7 : 12));
    if (this.flow > 0.02 && p) {
      this._buildStream(p.bottle);
      this.stream.visible = true;
      this.streamMat.color.copy(p.bottle.flavour.color).lerp(new Color(1, 1, 1), 0.16);
      this._spawnDrops(dt, p.bottle);
    } else {
      this.stream.visible = false;
    }
    this._updateDrops(dt);
  }

  _buildStream(bottle) {
    bottle.spoutWorld(this._spout);
    const sx = this._spout.x, sy = this._spout.y, sz = this._spout.z;
    const groundY = this.mound.surfaceY(sx, sz);
    const drop = Math.max(0.004, sy - groundY);
    const pos = this.streamGeo.attributes.position.array;
    const nrm = this.streamGeo.attributes.normal.array;
    const R0 = 0.0028 * (0.5 + this.flow * 0.8);
    // a little sideways carry from the tilt, then a straight thinning fall
    const lean = Math.sin(bottle.tilt) * 0.014;
    for (let r = 0; r < this.RINGS; r++) {
      const t = r / (this.RINGS - 1);
      const y = sy - drop * t;
      const v = Math.sqrt(2 * 9.81 * Math.max(drop * t, 0.0008));
      const rad = Math.max(0.00055, R0 * Math.sqrt(0.35 / Math.max(v, 0.35))) * (1 - t * 0.10);
      const cx = sx + lean * (1 - Math.pow(1 - t, 2));
      const cz = sz + lean * 0.25 * t;
      for (let s = 0; s < this.SIDES; s++) {
        const a = (s / this.SIDES) * Math.PI * 2;
        const i = (r * this.SIDES + s) * 3;
        const nx = Math.cos(a), nz = Math.sin(a);
        pos[i] = cx + nx * rad;
        pos[i + 1] = y;
        pos[i + 2] = cz + nz * rad;
        nrm[i] = nx; nrm[i + 1] = 0; nrm[i + 2] = nz;
      }
    }
    this.streamGeo.attributes.position.needsUpdate = true;
    this.streamGeo.attributes.normal.needsUpdate = true;
  }

  _spawnDrops(dt, bottle) {
    this._acc = (this._acc || 0) + dt * 46 * this.flow;
    const rnd = this.rnd;
    bottle.spoutWorld(this._spout);
    const gy = this.mound.surfaceY(this._spout.x, this._spout.z);
    while (this._acc >= 1) {
      this._acc -= 1;
      let i = -1;
      for (let k = 0; k < this.DROPS; k++) if (this.dl[k] <= 0) { i = k; break; }
      if (i < 0) break;
      this.dp[i * 3] = this._spout.x + (rnd() - 0.5) * 0.004;
      this.dp[i * 3 + 1] = gy + 0.002;
      this.dp[i * 3 + 2] = this._spout.z + (rnd() - 0.5) * 0.004;
      const a = rnd() * Math.PI * 2, sp = 0.05 + rnd() * 0.10;
      this.dv[i * 3] = Math.cos(a) * sp;
      this.dv[i * 3 + 1] = 0.10 + rnd() * 0.14;
      this.dv[i * 3 + 2] = Math.sin(a) * sp;
      this.ds[i] = 0.0011 + rnd() * 0.0016;
      this.dl[i] = 0.30 + rnd() * 0.25;
      this.dropMat.color.copy(bottle.flavour.color).lerp(new Color(1, 1, 1), 0.25);
    }
  }

  _updateDrops(dt) {
    let any = false;
    const o = this._o;
    for (let i = 0; i < this.DROPS; i++) {
      if (this.dl[i] <= 0) {
        o.position.set(0, -10, 0); o.scale.setScalar(0.0001); o.updateMatrix();
        this.drops.setMatrixAt(i, o.matrix);
        continue;
      }
      any = true;
      this.dl[i] -= dt;
      this.dv[i * 3 + 1] -= 9.81 * dt;
      this.dp[i * 3] += this.dv[i * 3] * dt;
      this.dp[i * 3 + 1] += this.dv[i * 3 + 1] * dt;
      this.dp[i * 3 + 2] += this.dv[i * 3 + 2] * dt;
      const gy = this.mound.surfaceY(this.dp[i * 3], this.dp[i * 3 + 2]);
      if (this.dp[i * 3 + 1] < gy) { this.dl[i] = 0; }
      o.position.set(this.dp[i * 3], this.dp[i * 3 + 1], this.dp[i * 3 + 2]);
      o.scale.setScalar(this.ds[i] * Math.min(1, this.dl[i] * 5));
      o.updateMatrix();
      this.drops.setMatrixAt(i, o.matrix);
    }
    this.drops.instanceMatrix.needsUpdate = true;
    this.drops.visible = any;
  }

  setEnvMap(env) {
    for (const b of this.bottles) b.setEnvMap(env);
    this.streamMat.envMap = env; this.streamMat.needsUpdate = true;
    this.dropMat.envMap = env; this.dropMat.needsUpdate = true;
  }
}
