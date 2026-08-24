import * as THREE from 'three';
import { clamp, lerp, smoothstep, makeThreadMaterial, colorizeTube, sagCurve } from './core';
import { THREAD_COLORS } from './threads';

/**
 * The woven thread bridge: part textile, part suspension bridge.
 * 4 support lines (catenaries) + irregular woven rungs + a translucent deck.
 * The load path is meant to be readable: anchor stones → taut tie-offs →
 * support lines → rungs → deck. Deflection is applied in place (no per-frame
 * geometry allocation).
 */

const N_LINES = 4;
// deliberately not symmetric
const LINE_OFFSETS = [-0.3, 0.27, -0.11, 0.16];
const LINE_SAG = 0.17;
const N_RUNGS = 24;
const TURNS_PER_LINE = 2.5;

interface ColorSeg { colorIdx: number; turns: number }

interface LineState {
  progress: number;
  locked: boolean;
  segs: ColorSeg[];
  mesh: THREE.Mesh;
  offset: number;
  /** cached rest positions + span params for in-place deflection */
  baseY: Float32Array | null;
  sVals: Float32Array | null;
}

interface Load { s: number; w: number }

export class Bridge {
  near: THREE.Vector3;
  far: THREE.Vector3;
  span: number;
  private side: THREE.Vector3;    // unit lateral direction

  lines: LineState[] = [];
  currentLine = -1;
  weaveProgress = 0;
  deckProgress = 0;

  private rungs: { mesh: THREE.Mesh; s: number; shown: boolean }[] = [];
  private deck: THREE.Mesh | null = null;
  private deckGeo: THREE.BufferGeometry | null = null;
  private deckRows = 44;
  private deckCols = 6;
  private deckWidth = 0.62;

  private loads: Load[] = [];          // transient impulses (footfalls, the test press)
  private steady: Load[] = [];         // standing hoof weight, replaced each frame
  private rippleT = -1;
  private dirty = true;

  private railMeshes: (THREE.Mesh | null)[] = [null, null];
  railProgress = [0, 0];
  private railColorLatest: number[] = [0, 1];
  private railDirty = [false, false];

  private tiesBuilt = false;

  constructor(
    private scene: THREE.Scene,
    near: THREE.Vector3,
    far: THREE.Vector3,
    private rng: () => number,
    /** the actual rock anchors the thread is tied off to (for visible load path) */
    private tieRocks?: { near: THREE.Vector3; far: THREE.Vector3 }
  ) {
    this.near = near.clone();
    this.far = far.clone();
    this.span = near.distanceTo(far);
    const dir = far.clone().sub(near); dir.y = 0; dir.normalize();
    this.side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  }

  get linesDone(): boolean {
    return this.lines.length >= N_LINES && this.lines.every(l => l.locked);
  }
  get lineProgress(): number {
    const l = this.lines[this.currentLine];
    return l ? l.progress : 0;
  }
  get deckReady(): boolean { return this.deckProgress >= 1; }

  turnsPerLine(): number { return TURNS_PER_LINE; }

  /** Taut tie-offs: every support-line end is visibly carried into the rock. */
  private buildTies(): void {
    if (this.tiesBuilt || !this.tieRocks) return;
    this.tiesBuilt = true;
    const mk = (a: THREE.Vector3, rock: THREE.Vector3, colorIdx: number) => {
      const pts = sagCurve(a, rock, 0.008, 8);     // taut — these carry the span tension
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.005, 5);
      const mat = makeThreadMaterial(THREAD_COLORS[colorIdx % 3].color, { opacity: 0.9 });
      const m = new THREE.Mesh(geo, mat);
      m.frustumCulled = false;
      this.scene.add(m);
    };
    for (let i = 0; i < N_LINES; i++) {
      const off = this.side.clone().multiplyScalar(LINE_OFFSETS[i]);
      mk(this.near.clone().add(off), this.tieRocks.near, i);
      mk(this.far.clone().add(off.multiplyScalar(0.8)), this.tieRocks.far, i + 1);
    }
  }

  // ------------------------------------------------------------ geometry helpers

  /** Deflection (m, downward) at span position s from live loads + test ripple. */
  private deflection(s: number): number {
    let d = 0;
    for (const L of this.loads) {
      const g = Math.exp(-Math.pow((s - L.s) * 4.2, 2));
      d += L.w * 0.085 * g * Math.sin(Math.PI * clamp(s, 0.02, 0.98));
    }
    for (const L of this.steady) {
      const g = Math.exp(-Math.pow((s - L.s) * 4.2, 2));
      d += L.w * 0.065 * g * Math.sin(Math.PI * clamp(s, 0.02, 0.98));
    }
    if (this.rippleT >= 0) {
      const rt = this.rippleT;
      d += 0.02 * Math.exp(-rt * 2.2) * Math.sin(s * 14 - rt * 16) * Math.sin(Math.PI * s);
    }
    return Math.min(d, 0.16);
  }

  /** Deck centre-line rest point (no deflection). */
  private restCenterAt(s: number, out: THREE.Vector3): THREE.Vector3 {
    out.lerpVectors(this.near, this.far, s);
    const dip = (Math.cosh((s - 0.5) * 2.4) - 1) / (Math.cosh(1.2) - 1);
    out.y -= LINE_SAG * (1 - dip);
    // slight lateral bow — the bridge is hand-made, not CAD
    out.addScaledVector(this.side, Math.sin(s * Math.PI) * 0.06);
    return out;
  }

  /** Deck centre-line point at s (0 near → 1 far), including deflection. */
  centerAt(s: number, out = new THREE.Vector3()): THREE.Vector3 {
    this.restCenterAt(s, out);
    out.y -= this.deflection(s);
    return out;
  }

  /** Walkable surface query. Returns null when (x,z) is off the woven part. */
  deckInfo(x: number, z: number): { s: number; y: number } | null {
    if (this.deckProgress < 0.6) return null;
    const a = this.near, b = this.far;
    const abx = b.x - a.x, abz = b.z - a.z;
    const lsq = abx * abx + abz * abz;
    const t = clamp(((x - a.x) * abx + (z - a.z) * abz) / lsq, 0, 1);
    if (t > this.deckProgress + 0.02) return null;     // that part isn't woven yet
    const c = this.centerAt(t, Bridge.tmpC);
    const lat = Math.hypot(x - c.x, z - c.z);
    if (lat > this.deckWidth * 0.75) return null;
    return { s: t, y: c.y + 0.012 };
  }
  private static tmpC = new THREE.Vector3();

  // ------------------------------------------------------------ support lines

  startLine(): boolean {
    if (this.lines.length >= N_LINES) return false;
    const mat = makeThreadMaterial(new THREE.Color(0xffffff), { opacity: 0.95, vertexColors: true, boost: 1.05 });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.lines.push({
      progress: 0, locked: false, segs: [], mesh, offset: LINE_OFFSETS[this.lines.length],
      baseY: null, sVals: null
    });
    this.currentLine = this.lines.length - 1;
    return true;
  }

  /**
   * Extend the current line by dProgress; segs are the coil colours paid out
   * from the horn for this increment. Returns true the moment it locks.
   */
  payLine(dProgress: number, segs: ColorSeg[]): boolean {
    const line = this.lines[this.currentLine];
    if (!line || line.locked) return false;
    for (const s of segs) {
      const last = line.segs[line.segs.length - 1];
      if (last && last.colorIdx === s.colorIdx) last.turns += s.turns;
      else line.segs.push({ ...s });
    }
    line.progress = clamp(line.progress + dProgress, 0, 1);
    const locked = line.progress >= 1;
    if (locked && !line.locked) {
      line.locked = true;
      this.buildTies();
    }
    this.rebuildLine(line);
    return locked;
  }

  private lineColorAt(line: LineState, t: number): THREE.Color {
    const total = line.segs.reduce((s, x) => s + x.turns, 0);
    if (total <= 0) return THREAD_COLORS[0].color;
    let acc = 0;
    for (const seg of line.segs) {
      acc += seg.turns;
      if (t * total <= acc + 1e-6) return THREAD_COLORS[seg.colorIdx].color;
    }
    return THREAD_COLORS[line.segs[line.segs.length - 1].colorIdx].color;
  }

  /** Full rebuild — used while paying out and once on lock (event-driven only). */
  private rebuildLine(line: LineState): void {
    const off = this.side.clone().multiplyScalar(line.offset);
    const a = this.near.clone().add(off);
    let pts: THREE.Vector3[];
    if (line.locked) {
      const b = this.far.clone().add(off.clone().multiplyScalar(0.8));
      pts = sagCurve(a, b, LINE_SAG, 30);
    } else {
      // paying out: the free end droops as it flies across the gap
      const p = line.progress;
      const end = new THREE.Vector3().lerpVectors(a, this.far.clone().add(off), p);
      const droop = (1 - p) * 0.9 * smoothstep(0.05, 0.5, p) + 0.06;
      end.y -= droop * 0.5;
      pts = sagCurve(a, end, droop, 22);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const TUB = 40, RAD = 5;
    const geo = new THREE.TubeGeometry(curve, TUB, 0.0055, RAD);
    colorizeTube(geo, TUB, RAD, (t) => this.lineColorAt(line, t * (line.locked ? 1 : line.progress)));
    line.mesh.geometry.dispose();
    line.mesh.geometry = geo;
    if (line.locked) {
      // cache rest heights + span params so deflection is an in-place add
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const count = pos.count;
      line.baseY = new Float32Array(count);
      line.sVals = new Float32Array(count);
      const ringSize = RAD + 1;
      for (let i = 0; i < count; i++) {
        line.baseY[i] = pos.getY(i);
        line.sVals[i] = clamp(Math.floor(i / ringSize) / TUB, 0, 1);
      }
    } else {
      line.baseY = null; line.sVals = null;
    }
  }

  private applyLineDeflection(line: LineState): void {
    if (!line.baseY || !line.sVals) return;
    const pos = line.mesh.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < line.baseY.length; i++) {
      arr[i * 3 + 1] = line.baseY[i] - this.deflection(line.sVals[i]) * 0.9;
    }
    pos.needsUpdate = true;
  }

  // ------------------------------------------------------------ weave

  weave(d: number): void {
    this.weaveProgress = clamp(this.weaveProgress + d, 0, 1);
    if (this.rungs.length === 0 && this.lines.length >= 2) this.buildRungs();
    const shown = Math.floor(this.weaveProgress * N_RUNGS);
    for (let i = 0; i < this.rungs.length; i++) {
      const r = this.rungs[i];
      if (i < shown && !r.shown) {
        r.shown = true;
        r.mesh.visible = true;
        r.mesh.scale.setScalar(0.01);
      }
      if (r.shown && r.mesh.scale.x < 1) {
        r.mesh.scale.setScalar(Math.min(1, r.mesh.scale.x + 0.12));
      }
    }
  }

  private buildRungs(): void {
    // irregular spacing + tiny angle noise: hand-woven, not machine-made
    for (let i = 0; i < N_RUNGS; i++) {
      const s = (i + 0.5) / N_RUNGS + (this.rng() - 0.5) * 0.018;
      const c = this.centerAt(s);
      const left = c.clone().addScaledVector(this.side, -0.34 + this.rng() * 0.05);
      const right = c.clone().addScaledVector(this.side, 0.3 + this.rng() * 0.06);
      const skew = (this.rng() - 0.5) * 0.08;
      left.y += 0.012; right.y += 0.012;
      const mid = left.clone().lerp(right, 0.5); mid.y -= 0.016;
      left.add(new THREE.Vector3(0, 0, skew));
      // geometry centred on the rung so the grow-in scales about itself
      const centre = mid.clone();
      const pts = [left.sub(centre), mid.clone().sub(centre), right.sub(centre)];
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.004, 5);
      const colorIdx = i % 2 === 0 ? 0 : (i % 3 === 0 ? 2 : 1);
      const mat = makeThreadMaterial(THREAD_COLORS[colorIdx].color.clone().lerp(new THREE.Color(0xffffff), 0.3), { opacity: 0.8 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(centre);
      mesh.frustumCulled = false;
      mesh.visible = false;
      this.scene.add(mesh);
      this.rungs.push({ mesh, s, shown: false });
    }
  }

  // ------------------------------------------------------------ deck

  private deckTexture(colorSeq: number[]): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, 128, 256);
    const seq = colorSeq.length ? colorSeq : [0, 1, 2];
    // lengthwise stripes in the child's collecting order
    for (let i = 0; i < 10; i++) {
      const idx = seq[i % seq.length];
      const col = THREAD_COLORS[idx].color;
      g.fillStyle = `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},0.75)`;
      g.fillRect(i * 12.8 + 1, 0, 10.5, 256);
    }
    // weave crosshatch: darker weft shadow rows + tiny gaps
    for (let y = 0; y < 256; y += 7) {
      g.fillStyle = 'rgba(30,30,40,0.22)';
      g.fillRect(0, y, 128, 1.6);
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.fillRect(0, y + 3, 128, 1);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 6);
    return tex;
  }

  /** Grow the woven deck; call with the spool colour order once at start. */
  closeDeck(d: number, colorSeq?: number[]): void {
    if (!this.deck) {
      const tex = this.deckTexture(colorSeq ?? []);
      const mat = new THREE.MeshStandardMaterial({
        map: tex, transparent: true, opacity: 0.82, side: THREE.DoubleSide,
        roughness: 0.45, metalness: 0, envMapIntensity: 0.8,
        emissive: new THREE.Color(0x223344), emissiveIntensity: 0.15,
        depthWrite: false
      });
      this.deckGeo = new THREE.BufferGeometry();
      const rows = this.deckRows, cols = this.deckCols;
      const positions = new Float32Array((rows + 1) * (cols + 1) * 3);
      const uvs = new Float32Array((rows + 1) * (cols + 1) * 2);
      const index: number[] = [];
      for (let r = 0; r < rows; r++) {
        for (let cc = 0; cc < cols; cc++) {
          const a = r * (cols + 1) + cc;
          const b = a + 1;
          const c2 = a + (cols + 1);
          const d2 = c2 + 1;
          index.push(a, c2, b, b, c2, d2);
        }
      }
      for (let r = 0; r <= rows; r++) {
        for (let cc = 0; cc <= cols; cc++) {
          const i = r * (cols + 1) + cc;
          uvs[i * 2] = cc / cols;
          uvs[i * 2 + 1] = r / rows;
        }
      }
      const posAttr = new THREE.BufferAttribute(positions, 3);
      posAttr.setUsage(THREE.DynamicDrawUsage);
      this.deckGeo.setAttribute('position', posAttr);
      this.deckGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      this.deckGeo.setIndex(index);
      this.deck = new THREE.Mesh(this.deckGeo, mat);
      this.deck.frustumCulled = false;
      this.deck.receiveShadow = true;
      this.scene.add(this.deck);
      this.rebuildDeck();
      this.deckGeo.computeVertexNormals();   // once — the deck stays near-planar
    }
    this.deckProgress = clamp(this.deckProgress + d, 0, 1);
    const rows = Math.floor(this.deckProgress * this.deckRows);
    this.deckGeo!.setDrawRange(0, rows * this.deckCols * 6);
    this.dirty = true;
  }

  private static rowC = new THREE.Vector3();
  private rebuildDeck(): void {
    if (!this.deckGeo) return;
    const pos = this.deckGeo.attributes.position as THREE.BufferAttribute;
    const rows = this.deckRows, cols = this.deckCols;
    const c = Bridge.rowC;
    for (let r = 0; r <= rows; r++) {
      const s = r / rows;
      this.centerAt(s, c);
      for (let cc = 0; cc <= cols; cc++) {
        const u = cc / cols - 0.5;
        const i = r * (cols + 1) + cc;
        // slight camber: edges ride up toward the support lines
        const camber = Math.pow(Math.abs(u) * 2, 2) * 0.03;
        pos.setXYZ(
          i,
          c.x + this.side.x * u * this.deckWidth * 1.05,
          c.y + camber,
          c.z + this.side.z * u * this.deckWidth * 1.05
        );
      }
    }
    pos.needsUpdate = true;
  }

  // ------------------------------------------------------------ load & rail

  /** Transient impulse at span fraction s (footfall, hoof press). */
  setLoad(s: number, w: number): void {
    this.loads.push({ s: clamp(s, 0, 1), w: clamp(w, 0, 1) });
    this.dirty = true;
  }

  /** Standing weight, replaced wholesale each frame (steady sag, no flutter). */
  setSteadyLoads(list: { s: number; w: number }[]): void {
    const changed = list.length !== this.steady.length ||
      list.some((l, i) => Math.abs(l.s - this.steady[i].s) > 0.004 || Math.abs(l.w - this.steady[i].w) > 0.02);
    if (changed) {
      this.steady = list.map(l => ({ s: clamp(l.s, 0, 1), w: clamp(l.w, 0, 1) }));
      this.dirty = true;
    }
  }

  startRipple(): void { this.rippleT = 0; }

  addRail(sideIdx: 0 | 1, d: number, colorIdx: number): void {
    this.railProgress[sideIdx] = clamp(this.railProgress[sideIdx] + d, 0, 1);
    this.railColorLatest[sideIdx] = colorIdx;
    this.railDirty[sideIdx] = true;
  }

  private rebuildRail(sideIdx: 0 | 1): void {
    const p = this.railProgress[sideIdx];
    if (p <= 0.02) return;
    const colorIdx = this.railColorLatest[sideIdx];
    const off = this.side.clone().multiplyScalar(sideIdx === 0 ? -0.33 : 0.3);
    const a = this.near.clone().add(off); a.y += 0.32;
    const bFull = this.far.clone().add(off); bFull.y += 0.32;
    const b = a.clone().lerp(bFull, p);
    const base = sagCurve(a, b, LINE_SAG * 0.75 * p, 24);
    // small spiral wrap around the rail line — leftover thread put to use
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < base.length; i++) {
      const t = i / (base.length - 1);
      const wob = 0.012;
      pts.push(base[i].clone().add(new THREE.Vector3(
        Math.cos(t * 60) * wob, Math.sin(t * 60) * wob, 0
      )));
    }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.0045, 5);
    if (!this.railMeshes[sideIdx]) {
      const mat = makeThreadMaterial(THREAD_COLORS[colorIdx].color, { opacity: 0.9 });
      this.railMeshes[sideIdx] = new THREE.Mesh(geo, mat);
      this.railMeshes[sideIdx]!.frustumCulled = false;
      this.scene.add(this.railMeshes[sideIdx]!);
    } else {
      const m = this.railMeshes[sideIdx]!;
      m.geometry.dispose();
      m.geometry = geo;
      (m.material as THREE.ShaderMaterial).uniforms.uColor.value.copy(THREAD_COLORS[colorIdx].color);
    }
  }

  // ------------------------------------------------------------ per-frame

  update(dt: number): void {
    // transient impulses decay quickly — the weave springs back
    if (this.loads.length) {
      for (const L of this.loads) L.w -= dt * 3.2;
      this.loads = this.loads.filter(L => L.w > 0.02);
      this.dirty = true;
    }
    if (this.rippleT >= 0) {
      this.rippleT += dt;
      if (this.rippleT > 1.6) this.rippleT = -1;
      this.dirty = true;
    }
    if (this.dirty) {
      this.rebuildDeck();
      for (const line of this.lines) if (line.locked) this.applyLineDeflection(line);
      this.dirty = false;
    }
    for (const sideIdx of [0, 1] as const) {
      if (this.railDirty[sideIdx]) {
        this.railDirty[sideIdx] = false;
        this.rebuildRail(sideIdx);
      }
    }
  }
}
