import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { MaterialKit } from './materials';
import { rand, resetSeed } from './materials';
import {
  BEAM_W, BEAM_TOP_Y, SEG_COUNT, SEG_LEN, routePath, RouteSide,
} from '../game/switchModel';

const GROUND_Y = -8.5;
const PC_DEPTH = 1.5; // fixed PC track girder depth

export interface Signals {
  set(side: RouteSide, aspect: 'stop' | 'proceed'): void;
  /** the trackside points indicator near the tip (route lamps) */
  setIndicator(side: RouteSide | null): void;
}

export class Environment {
  readonly group = new THREE.Group();
  signals!: Signals;
  /** deck-level focus point of the points indicator (camera interest) */
  readonly indicatorPos = new THREE.Vector3(-2.6, 1.6, 24.5);

  constructor(private mats: MaterialKit) {
    this.buildSky();
    this.buildGround();
    this.buildDeck();
    this.buildFixedTracks();
    this.buildStation();
    this.buildSignals();
    this.buildCity();
  }

  private buildSky(): void {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.0, '#7fa8cc');
    g.addColorStop(0.45, '#a7c3d9');
    g.addColorStop(0.62, '#cfdde6');
    g.addColorStop(1.0, '#e4e8e6');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 2, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 24, 16),
      new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false }),
    );
    sky.rotation.y = 0.6;
    this.group.add(sky);
  }

  private buildGround(): void {
    resetSeed(7231);
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#8f9285'; ctx.fillRect(0, 0, 512, 512); // dry field / urban fringe
    for (let i = 0; i < 900; i++) {
      const v = 120 + rand() * 60;
      ctx.fillStyle = `rgba(${v},${v + 8},${v - 12},0.12)`;
      ctx.fillRect(rand() * 512, rand() * 512, 2 + rand() * 5, 2 + rand() * 5);
    }
    // a few roads
    ctx.fillStyle = '#77776f';
    ctx.fillRect(0, 226, 512, 26);
    ctx.fillRect(150, 0, 22, 512);
    ctx.fillRect(360, 0, 18, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400),
      new THREE.MeshStandardMaterial({ map: t, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = GROUND_Y;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  private buildDeck(): void {
    const m = this.mats;
    // switch platform slab (top y=0)
    const slab = new THREE.Mesh(new THREE.BoxGeometry(17, 0.9, 41), m.concrete);
    slab.position.set(1.0, -0.45, 7.5);
    slab.receiveShadow = true; slab.castShadow = true;
    this.group.add(slab);

    // parapet walls
    const parapets: THREE.BufferGeometry[] = [];
    const wall = (x: number, z: number, w: number, d: number) => {
      const g = new THREE.BoxGeometry(w, 1.05, d);
      g.translate(x, 0.52, z);
      parapets.push(g);
    };
    wall(-7.35, 7.5, 0.3, 41);   // west (walkway side)
    wall(9.35, 7.5, 0.3, 41);    // east
    const pm = new THREE.Mesh(mergeGeometries(parapets), m.concrete);
    pm.castShadow = true; pm.receiveShadow = true;
    this.group.add(pm);

    // support columns
    const colGeo = new THREE.BoxGeometry(1.4, -GROUND_Y, 1.4);
    for (const [x, z] of [[-4.5, -6], [6.5, -6], [-4.5, 9], [6.5, 9], [-4.5, 23], [6.5, 23]]) {
      const col = new THREE.Mesh(colGeo, m.concrete);
      col.position.set(x, GROUND_Y / 2 - 0.9, z);
      col.castShadow = true;
      this.group.add(col);
    }

    // maintenance walkway strip with anti-slip paint
    const walk = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.04, 41),
      new THREE.MeshStandardMaterial({ color: 0x7b8274, roughness: 0.95 }));
    walk.position.set(-6.1, 0.02, 7.5);
    walk.receiveShadow = true;
    this.group.add(walk);

    // safety railing between walkway and the moving girders
    const railParts: THREE.BufferGeometry[] = [];
    for (let z = -12; z <= 27; z += 2.6) {
      if (z > -6.4 && z < -3.4) continue; // gate opening at the control cabinet
      const post = new THREE.CylinderGeometry(0.035, 0.035, 1.15, 8);
      post.translate(-4.95, 0.57, z);
      railParts.push(post);
    }
    for (const y of [1.1, 0.72, 0.34]) {
      const bar = new THREE.CylinderGeometry(0.025, 0.025, 39, 8);
      bar.rotateX(Math.PI / 2);
      bar.translate(-4.95, y, 7.5);
      railParts.push(bar);
    }
    const rails = new THREE.Mesh(mergeGeometries(railParts), m.galv);
    rails.castShadow = true;
    this.group.add(rails);

    // covered cable trenches from the cabinet line to the drive units
    const trench: THREE.BufferGeometry[] = [];
    for (const z of [8.2, 20.6]) {
      const g = new THREE.BoxGeometry(4.4, 0.07, 0.5);
      g.translate(-2.6, 0.045, z);
      trench.push(g);
    }
    const tr = new THREE.BoxGeometry(0.5, 0.07, 30);
    tr.translate(-4.6, 0.045, 9.5);
    trench.push(tr);
    const tm = new THREE.Mesh(mergeGeometries(trench), m.galv);
    tm.receiveShadow = true;
    this.group.add(tm);

    // drainage channel + scupper stains along the east edge
    const drain = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 40),
      new THREE.MeshStandardMaterial({ color: 0x6d6a62, roughness: 1 }));
    drain.position.set(8.6, 0.026, 7.5);
    this.group.add(drain);
  }

  private buildFixedTracks(): void {
    const m = this.mats;
    const tipZ = SEG_COUNT * SEG_LEN;

    // Build both fixed routes from the same route paths the trains use.
    const buildBeam = (pts: THREE.Vector2[], zFrom: number, zTo: number, onDeck: boolean) => {
      const path: THREE.Vector3[] = [];
      for (const p of pts) {
        if (p.y < zFrom || p.y > zTo) continue;
        path.push(new THREE.Vector3(p.x, 0, p.y));
      }
      if (path.length < 2) return;
      const geo = beamAlong(path, BEAM_W, PC_DEPTH, BEAM_TOP_Y);
      const mesh = new THREE.Mesh(geo, [m.pcTrack, m.runningSurface]);
      mesh.castShadow = true; mesh.receiveShadow = true;
      this.group.add(mesh);

      // supports
      let acc = 0;
      for (let i = 1; i < path.length; i++) {
        acc += path[i].distanceTo(path[i - 1]);
        if (acc > (onDeck ? 6 : 19)) {
          acc = 0;
          const p = path[i];
          if (onDeck && p.z < 27) {
            const ped = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.9), m.concreteDark);
            ped.position.set(p.x, 0.28, p.z);
            ped.castShadow = true;
            this.group.add(ped);
          } else if (!onDeck) {
            const h = BEAM_TOP_Y - PC_DEPTH - GROUND_Y;
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, h, 12), m.concrete);
            col.position.set(p.x, GROUND_Y + h / 2, p.z);
            col.castShadow = true;
            this.group.add(col);
            const cap = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.2), m.concrete);
            cap.rotation.y = Math.atan2(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
            cap.position.set(p.x, BEAM_TOP_Y - PC_DEPTH - 0.25, p.z);
            cap.castShadow = true;
            this.group.add(cap);
          }
        }
      }
    };

    const straight = routePath('straight');
    const curve = routePath('curve');
    // approach (shared, south of the heel): pedestals on deck then piers
    buildBeam(straight, -11.5, -0.12, true);
    buildBeam(straight, -78, -11.5, false);
    // straight route beyond the tip
    buildBeam(straight, tipZ + 0.30, tipZ + 150, false);
    // curved route beyond the switch arc (the curve path includes the switch
    // arc itself, so clip to beyond the tip)
    buildBeam(curve, tipZ - 0.7, tipZ + 150, false);
  }

  private buildStation(): void {
    const m = this.mats;
    // simple elevated side-platform station on the straight route
    const g = new THREE.Group();
    g.position.set(0, 0, 96);
    const platGeo = new THREE.BoxGeometry(2.4, 0.35, 42);
    for (const s of [-1, 1]) {
      const plat = new THREE.Mesh(platGeo, m.concrete);
      plat.position.set(s * (BEAM_W / 2 + 1.45), BEAM_TOP_Y + 0.85, 0);
      plat.castShadow = true; plat.receiveShadow = true;
      g.add(plat);
      // platform doors / fence line
      const pf = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 42), m.galv);
      pf.position.set(s * (BEAM_W / 2 + 0.45), BEAM_TOP_Y + 1.45, 0);
      g.add(pf);
      // roof
      const roof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 42),
        new THREE.MeshStandardMaterial({ color: 0x8c9296, roughness: 0.6, metalness: 0.3 }));
      roof.position.set(s * 2.1, BEAM_TOP_Y + 3.4, 0);
      roof.castShadow = true;
      g.add(roof);
      for (let z = -18; z <= 18; z += 9) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.4, 8), m.galv);
        col.position.set(s * (BEAM_W / 2 + 2.2), BEAM_TOP_Y + 2.2, z);
        g.add(col);
      }
      // support structure down to ground
      for (let z = -16; z <= 16; z += 16) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.8, BEAM_TOP_Y + 0.85 - GROUND_Y, 0.8), m.concrete);
        leg.position.set(s * (BEAM_W / 2 + 1.45), (BEAM_TOP_Y + 0.85 + GROUND_Y) / 2, z);
        g.add(leg);
      }
    }
    this.group.add(g);
  }

  private buildSignals(): void {
    const m = this.mats;
    const lensOn = { stop: 0xd93b2b, proceed: 0x35c157 } as const;
    const mkSignal = (x: number, z: number, yaw: number) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = yaw;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 3.4, 10), m.galv);
      pole.position.y = 1.7;
      pole.castShadow = true;
      g.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.86, 0.3), new THREE.MeshStandardMaterial({ color: 0x2a2d2f, roughness: 0.5 }));
      head.position.set(0, 3.15, 0);
      g.add(head);
      const lensGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.05, 16);
      lensGeo.rotateX(Math.PI / 2);
      const mkLens = (y: number) => {
        const mat = new THREE.MeshStandardMaterial({ color: 0x131414, roughness: 0.3, emissive: 0x000000 });
        const lens = new THREE.Mesh(lensGeo, mat);
        lens.position.set(0, y, 0.17);
        // hood visor
        const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.16, 12, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x2a2d2f, roughness: 0.5, side: THREE.DoubleSide }));
        hood.rotation.x = Math.PI / 2;
        hood.position.set(0, y + 0.02, 0.2);
        g.add(hood);
        g.add(lens);
        return mat;
      };
      return { red: mkLens(3.38), green: mkLens(2.94), group: g };
    };

    // signals face the far waiting trains (away from the camera)
    const sigStraight = mkSignal(-1.5, 27.5, Math.PI);
    const sigCurve = mkSignal(5.6, 26.5, Math.PI + 0.28);
    this.group.add(sigStraight.group, sigCurve.group);

    // trackside points indicator near the tip: two arrow lamps facing the deck
    const ind = new THREE.Group();
    ind.position.copy(this.indicatorPos);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.16), new THREE.MeshStandardMaterial({ color: 0x30373b, roughness: 0.5 }));
    ind.add(box);
    const pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.6, 8), this.mats.galv);
    pole2.position.y = -1.0;
    ind.add(pole2);
    const mkArrow = (dx: number, rot: number) => {
      const mat = new THREE.MeshStandardMaterial({ color: 0x1c1f20, emissive: 0x000000 });
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 3), mat);
      arrow.rotation.z = rot;
      arrow.position.set(dx, 0, -0.09);
      ind.add(arrow);
      return mat;
    };
    const indStraight = mkArrow(-0.15, 0);            // up arrow = straight
    const indCurve = mkArrow(0.15, -Math.PI / 2.6);   // tilted = diverging
    ind.rotation.y = Math.PI + 0.35; // face the walkway/camera
    this.group.add(ind);

    const setLens = (mat: THREE.MeshStandardMaterial, color: number | null) => {
      if (color === null) {
        mat.emissive.setHex(0x000000);
        mat.color.setHex(0x131414);
      } else {
        mat.emissive.setHex(color);
        mat.emissiveIntensity = 1.6;
        mat.color.setHex(0x222222);
      }
    };

    this.signals = {
      set(side, aspect) {
        const s = side === 'straight' ? sigStraight : sigCurve;
        setLens(s.red, aspect === 'stop' ? lensOn.stop : null);
        setLens(s.green, aspect === 'proceed' ? lensOn.proceed : null);
      },
      setIndicator(side) {
        setLens(indStraight, side === 'straight' ? 0xffb63d : null);
        setLens(indCurve, side === 'curve' ? 0xffb63d : null);
      },
    };
    // initial: everything at stop, no route
    this.signals.set('straight', 'stop');
    this.signals.set('curve', 'stop');
    this.signals.setIndicator(null);
  }

  private buildCity(): void {
    resetSeed(5150);
    const m = this.mats;
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    boxGeo.translate(0, 0.5, 0);
    const palette = [0xb9b3a8, 0xa8a8a2, 0xc2bdb2, 0x9a9d9a, 0xb0a89b];
    const mats = palette.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
    let count = 0;
    const inst = new THREE.InstancedMesh(boxGeo, mats[0], 130);
    const mat4 = new THREE.Matrix4();
    const colorArr = new THREE.Color();
    for (let i = 0; i < 130; i++) {
      const ang = rand() * Math.PI * 2;
      const r = 115 + rand() * 260;
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r + 60;
      // keep the track corridors clear
      if (Math.abs(x) < 30 && z > -90 && z < 260) { continue; }
      const w = 8 + rand() * 16, d = 8 + rand() * 16;
      const h = 6 + rand() * (r < 160 ? 14 : 30);
      mat4.makeRotationY(rand() * Math.PI);
      mat4.setPosition(x, GROUND_Y, z);
      mat4.scale(new THREE.Vector3(w, h, d));
      inst.setMatrixAt(count, mat4);
      colorArr.setHex(palette[Math.floor(rand() * palette.length)]);
      inst.setColorAt(count, colorArr);
      count++;
    }
    inst.count = count;
    inst.instanceMatrix.needsUpdate = true;
    this.group.add(inst);

    // a few mid-distance trees along the ground roads
    const trunkGeo = new THREE.CylinderGeometry(0.14, 0.2, 2.4, 6);
    const crownGeo = new THREE.SphereGeometry(1.7, 8, 6);
    const treeGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 26; i++) {
      const x = -70 + rand() * 150;
      const z = -40 + rand() * 160;
      if (Math.abs(x) < 18) continue;
      const t1 = trunkGeo.clone(); t1.translate(x, GROUND_Y + 1.2, z);
      const c1 = crownGeo.clone();
      const s = 0.7 + rand() * 0.9;
      c1.scale(s, s * (0.9 + rand() * 0.4), s);
      c1.translate(x, GROUND_Y + 2.4 + s, z);
      treeGeos.push(t1, c1);
    }
    if (treeGeos.length) {
      const trees = new THREE.Mesh(mergeGeometries(treeGeos),
        new THREE.MeshStandardMaterial({ color: 0x687059, roughness: 1 }));
      this.group.add(trees);
    }
  }
}

/**
 * Sweep the track-beam cross-section along a polyline. Returns geometry with
 * two material groups: 0 = sides/bottom (PC concrete), 1 = running surface.
 */
function beamAlong(pts: THREE.Vector3[], w: number, depth: number, topY: number): THREE.BufferGeometry {
  const verts: number[] = [];
  const idxSides: number[] = [];
  const idxTop: number[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b.x - a.x, dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    const nx = dz, nz = -dx;
    const hw = w / 2;
    verts.push(
      p.x + nx * hw, topY, p.z + nz * hw,          // 0 top R
      p.x - nx * hw, topY, p.z - nz * hw,          // 1 top L
      p.x + nx * hw, topY - depth, p.z + nz * hw,  // 2 bot R
      p.x - nx * hw, topY - depth, p.z - nz * hw,  // 3 bot L
    );
    if (i > 0) {
      const c = i * 4, q = (i - 1) * 4;
      idxTop.push(q, q + 1, c, q + 1, c + 1, c);
      idxSides.push(q + 2, q, c + 2, q, c, c + 2);        // right web
      idxSides.push(q + 1, q + 3, c + 1, q + 3, c + 3, c + 1); // left web
      idxSides.push(q + 3, q + 2, c + 3, q + 2, c + 2, c + 3); // soffit
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const uv: number[] = [];
  for (let i = 0; i < n; i++) uv.push(0, i * 0.2, 1, i * 0.2, 0, i * 0.2 + 0.1, 1, i * 0.2 + 0.1);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([...idxSides, ...idxTop]);
  g.addGroup(0, idxSides.length, 0);
  g.addGroup(idxSides.length, idxTop.length, 1);
  g.computeVertexNormals();
  return g;
}

export { GROUND_Y };
