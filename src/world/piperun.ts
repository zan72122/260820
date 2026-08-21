import * as THREE from 'three';
import { MaterialLibrary, WetMaterial } from '../core/materials';
import { cutawayPipe, pipeMesh, pipeSupport } from './parts';

export interface CutawayWindow {
  /** normalised range along the run that is shown in section */
  t0: number;
  t1: number;
}

export interface PipeRunOptions {
  radius: number;
  kind: 'blue' | 'grey' | 'green' | 'slide';
  cutaways?: CutawayWindow[];
  supports?: number[];
  supportHeight?: number;
  tubular?: number;
  castShadow?: boolean;
  /** 'section' cuts the wall away; 'clear' fits a glass spool piece. */
  windowStyle?: 'section' | 'clear';
  /** override the shell material (translucent flumes) */
  shellMaterial?: THREE.Material;
  radialSegments?: number;
}

function subCurve(curve: THREE.Curve<THREE.Vector3>, t0: number, t1: number, samples: number) {
  const pts: THREE.Vector3[] = [];
  const n = Math.max(4, samples);
  for (let i = 0; i <= n; i++) pts.push(curve.getPointAt(t0 + ((t1 - t0) * i) / n));
  return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.02);
}

interface ShellSeg {
  t0: number;
  t1: number;
  mat: WetMaterial | null;
}

interface WaterWindow {
  t0: number;
  t1: number;
  mesh: THREE.Mesh;
  indexCount: number;
}

/**
 * One length of pipework. The shell is genuinely interrupted where a window is
 * fitted — a glass spool piece or a sectioned sleeve — so the water column
 * inside is actually visible rather than hidden behind an opaque wall. Between
 * the windows the painted shell carries the moving-front shader instead, which
 * is what lets a long run read as "carrying water" for almost no cost.
 */
export class PipeRun {
  readonly group = new THREE.Group();
  readonly material: WetMaterial;
  private readonly segs: ShellSeg[] = [];
  private readonly windows: WaterWindow[] = [];
  private fill = 0;

  constructor(
    lib: MaterialLibrary,
    private readonly curve: THREE.Curve<THREE.Vector3>,
    private readonly opts: PipeRunOptions,
  ) {
    const length = curve.getLength();
    const circumference = Math.PI * 2 * opts.radius;
    // texture density matched to real size, or a long run smears into bands
    const tiles = new THREE.Vector2(Math.max(1, length / 1.1), Math.max(1, circumference / 0.55));
    // each shell piece needs its own material: the wet-front uniform is per piece,
    // and cloning would leave every clone pointing at the first one's uniforms
    const makeShell = (): WetMaterial => {
      const m = lib.wetPipe(opts.kind);
      for (const key of ['map', 'roughnessMap', 'normalMap'] as const) {
        const src = m[key];
        if (!src) continue;
        const t = src.clone();
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.copy(tiles);
        t.needsUpdate = true;
        m[key] = t;
      }
      return m;
    };
    this.material = makeShell();

    const style = opts.windowStyle ?? 'section';
    const windows = [...(opts.cutaways ?? [])].sort((a, b) => a.t0 - b.t0);
    const totalTubular = opts.tubular ?? 110;
    const radial = opts.radialSegments ?? 18;

    // shell pieces occupy everything the windows do not
    const gaps: [number, number][] = [];
    let cursor = 0;
    for (const w of windows) {
      if (w.t0 > cursor + 0.001) gaps.push([cursor, w.t0]);
      cursor = w.t1;
    }
    if (cursor < 0.999) gaps.push([cursor, 1]);

    for (const [t0, t1] of gaps) {
      const span = t1 - t0;
      const sub = t0 === 0 && t1 === 1 ? curve : subCurve(curve, t0, t1, Math.ceil(span * 40) + 4);
      const wetMat = opts.shellMaterial ? null : makeShell();
      const mat = opts.shellMaterial ?? wetMat!;
      const mesh = pipeMesh(sub, opts.radius, mat, Math.max(8, Math.round(totalTubular * span)), radial);
      mesh.castShadow = opts.castShadow ?? true;
      this.group.add(mesh);
      this.segs.push({ t0, t1, mat: wetMat });
    }

    for (const w of windows) {
      const span = w.t1 - w.t0;
      const sub = subCurve(curve, w.t0, w.t1, Math.ceil(span * 60) + 6);
      if (style === 'section') {
        // wall cut away: you see the bore and the water lying in it
        this.group.add(cutawayPipe(sub, opts.radius, lib.stainlessRough, opts.radius * 0.16, 36));
      } else {
        const sleeve = pipeMesh(sub, opts.radius * 1.01, lib.glassLite, 26, radial);
        sleeve.renderOrder = 4;
        sleeve.castShadow = false;
        this.group.add(sleeve);
      }
      // heavy end fittings either side of the spool piece
      for (const end of [w.t0, w.t1]) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(opts.radius * 1.12, opts.radius * 0.16, 8, 22),
          lib.stainlessRough,
        );
        ring.position.copy(curve.getPointAt(end));
        ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), curve.getTangentAt(end));
        ring.castShadow = true;
        this.group.add(ring);
      }
      const segsN = 40;
      const waterGeo = new THREE.TubeGeometry(sub, segsN, opts.radius * 0.86, 14, false);
      const waterMat = lib.waterBody.clone();
      waterMat.normalMap = lib.waterBody.normalMap!.clone();
      waterMat.normalMap.wrapS = waterMat.normalMap.wrapT = THREE.RepeatWrapping;
      waterMat.normalMap.repeat.set(2, Math.max(2, span * length * 3));
      waterMat.normalMap.needsUpdate = true;
      const water = new THREE.Mesh(waterGeo, waterMat);
      water.renderOrder = 2;
      water.geometry.setDrawRange(0, 0);
      this.group.add(water);
      this.windows.push({ t0: w.t0, t1: w.t1, mesh: water, indexCount: segsN * 14 * 6 });
    }

    for (const t of opts.supports ?? []) {
      const sup = pipeSupport(opts.radius, opts.supportHeight ?? 0.55, lib.stainlessRough, lib.rubber, lib.stainlessRough);
      sup.position.copy(curve.getPointAt(t));
      this.group.add(sup);
    }
  }

  get radius() {
    return this.opts.radius;
  }

  pointAt(t: number) {
    return this.curve.getPointAt(THREE.MathUtils.clamp(t, 0, 1));
  }

  setFill(fill: number, time: number, flow: number) {
    this.fill = fill;
    this.material.wet.uFill.value = fill;
    for (const s of this.segs) {
      if (!s.mat) continue;
      const local = (fill - s.t0) / Math.max(1e-4, s.t1 - s.t0);
      s.mat.wet.uFill.value = THREE.MathUtils.clamp(local, 0, 1);
      s.mat.wet.uTime.value = time;
      s.mat.wet.uFlow.value = flow;
    }
    const perRow = 14 * 6;
    for (const w of this.windows) {
      const local = THREE.MathUtils.clamp((fill - w.t0) / Math.max(1e-4, w.t1 - w.t0), 0, 1);
      w.mesh.geometry.setDrawRange(0, Math.floor((local * w.indexCount) / perRow) * perRow);
      w.mesh.visible = local > 0.002;
      const nm = (w.mesh.material as THREE.MeshStandardMaterial).normalMap;
      if (nm) nm.offset.y = -time * (0.4 + flow * 1.8);
    }
  }

  get currentFill() {
    return this.fill;
  }
}
