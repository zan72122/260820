import * as THREE from 'three';
import { Rng, TAU, clamp01, fbm2, smoothstep } from '../core/math';
import type { QualitySettings } from '../core/quality';
import {
  applyMaps,
  basketMaps,
  bootMaps,
  cached,
  cassavaLeafTexture,
  radialAlpha,
  soilMaps,
  type SoilKind,
} from '../core/textures';
import { applyMacroVariation } from '../core/macro';
import { GROUND_HOLE_RADIUS, SOIL_UV_SCALE } from './soil';

/**
 * The field the plots sit in.
 *
 * Near ground, the mid-ground working area and the far background are three
 * different budgets: the patch under the player's hands is a real displaced
 * mesh, the cut-back rows and the worker are simple solids kept for scale
 * reference, and everything past the track is instanced or merged and left to
 * the haze.
 */

export const ROW_SPACING = 1.25;

export class Field {
  readonly group = new THREE.Group();
  /** Exposed so the single section cutaway can clip the ground and nothing else. */
  readonly soilMaterials: THREE.Material[] = [];
  private disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];

  constructor(q: QualitySettings, soil: SoilKind, plotXs: number[]) {
    const rng = new Rng(9182);
    const firstX = plotXs[0] ?? 0;
    const lastX = plotXs[plotXs.length - 1] ?? 0;

    const groundMat = new THREE.MeshStandardMaterial({ roughness: 0.98, metalness: 0 });
    applyMaps(
      groundMat,
      cached(`soil${q.textureSize}${soil}`, () => soilMaps(q.textureSize, soil)),
      new THREE.Vector2(1, 1),
      q.anisotropy,
    );
    // Breaks the tiling, and does it in world space so the patch and the
    // crater collar that lap over this mesh vary in exactly the same way.
    applyMacroVariation(groundMat, 1);
    this.disposables.push(groundMat);
    this.soilMaterials.push(groundMat);

    /* ---- the worked row: flat, and genuinely cut open at every plot ----
     * The hole is real geometry, not a decal. Without it the ground plane
     * would sit between the camera and the crater, and the split plates would
     * open onto nothing.
     */
    const stripMinX = firstX - 3.0;
    const stripMaxX = lastX + 3.0;
    const stripHalfZ = 1.0;
    const shape = new THREE.Shape();
    shape.moveTo(stripMinX, -stripHalfZ);
    shape.lineTo(stripMaxX, -stripHalfZ);
    shape.lineTo(stripMaxX, stripHalfZ);
    shape.lineTo(stripMinX, stripHalfZ);
    shape.closePath();
    for (const x of plotXs) {
      const hole = new THREE.Path();
      hole.absarc(x, 0, GROUND_HOLE_RADIUS, 0, TAU, true);
      shape.holes.push(hole);
    }
    const stripGeom = new THREE.ShapeGeometry(shape, 40);
    // Shape space is XY facing +Z; this lays it flat facing +Y.
    stripGeom.rotateX(-Math.PI / 2);
    // Shape UVs come through in shape space; rescale them to the soil tiling.
    const suv = stripGeom.getAttribute('uv') as THREE.BufferAttribute;
    const spos = stripGeom.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < suv.count; i++) {
      suv.setXY(i, spos.getX(i) * SOIL_UV_SCALE, spos.getZ(i) * SOIL_UV_SCALE);
    }
    suv.needsUpdate = true;
    stripGeom.computeVertexNormals();
    this.disposables.push(stripGeom);
    const strip = new THREE.Mesh(stripGeom, groundMat);
    strip.receiveShadow = true;
    this.group.add(strip);

    /* ---- the rest of the field, ridged and uneven ---- */
    const band = (
      x0: number,
      x1: number,
      z0: number,
      z1: number,
      segX: number,
      segZ: number,
    ): void => {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, segX, segZ);
      g.rotateX(-Math.PI / 2);
      g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
      const pos = g.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        // Ridged planting rows running along X, plus general unevenness.
        // Everything fades to dead flat at the worked strip so no seam shows.
        const flatten = smoothstep((Math.abs(z) - stripHalfZ) / 1.3);
        const ridge = Math.sin((z / ROW_SPACING) * TAU) * 0.022;
        const rough = (fbm2(x * 0.6 + 20, z * 0.6 + 20, 4) - 0.5) * 0.10;
        const broad = (fbm2(x * 0.09, z * 0.09, 3) - 0.5) * 0.5;
        pos.setY(i, (ridge + rough + broad) * flatten);
      }
      pos.needsUpdate = true;
      const uv = g.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, pos.getX(i) * SOIL_UV_SCALE, pos.getZ(i) * SOIL_UV_SCALE);
      }
      uv.needsUpdate = true;
      g.computeVertexNormals();
      this.disposables.push(g);
      const mesh = new THREE.Mesh(g, groundMat);
      mesh.receiveShadow = true;
      this.group.add(mesh);
    };

    const far = 30;
    const detail = q.tier === 'low' ? 0.55 : 1;
    band(stripMinX - far, stripMaxX + far, -far, -stripHalfZ, Math.round(150 * detail), Math.round(90 * detail));
    band(stripMinX - far, stripMaxX + far, stripHalfZ, far, Math.round(150 * detail), Math.round(90 * detail));
    band(stripMinX - far, stripMinX, -stripHalfZ, stripHalfZ, Math.round(40 * detail), 6);
    band(stripMaxX, stripMaxX + far, -stripHalfZ, stripHalfZ, Math.round(40 * detail), 6);

    /* ---- cut-back rows beside the working strip ---- */
    const stubGeom = new THREE.CylinderGeometry(0.019, 0.025, 0.20, 7);
    this.disposables.push(stubGeom);
    const stubMat = new THREE.MeshStandardMaterial({ color: 0x5a4a35, roughness: 0.9, metalness: 0 });
    this.disposables.push(stubMat);
    const stubCount = q.tier === 'low' ? 60 : 120;
    const stubs = new THREE.InstancedMesh(stubGeom, stubMat, stubCount);
    stubs.castShadow = true;
    stubs.receiveShadow = true;
    const m = new THREE.Matrix4();
    const qt = new THREE.Quaternion();
    const e = new THREE.Euler();
    // Planted on a grid with only small jitter — a field, not a scatter.
    const perRow = Math.ceil(stubCount / 4);
    for (let i = 0; i < stubCount; i++) {
      const rowIndex = Math.floor(i / perRow);
      // Rows ±2 and ±3 only: the two lanes beside the worked row stay clear
      // so nothing stands between the camera and the plant.
      const row = [-3, -2, 2, 3][rowIndex] ?? 2;
      const step = (lastX - firstX + 8) / perRow;
      const x = firstX - 4 + (i % perRow) * step + rng.jitter(0.10);
      const z = row * ROW_SPACING + rng.jitter(0.10);
      e.set(rng.jitter(0.12), rng.range(0, TAU), rng.jitter(0.12));
      qt.setFromEuler(e);
      m.compose(new THREE.Vector3(x, 0.09, z), qt, new THREE.Vector3(1, rng.range(0.7, 1.05), 1));
      stubs.setMatrixAt(i, m);
    }
    stubs.instanceMatrix.needsUpdate = true;
    this.group.add(stubs);

    /* ---- already-lifted clusters lying between the rows ---- */
    const pileGeom = new THREE.IcosahedronGeometry(0.055, 1);
    const ppos = pileGeom.getAttribute('position') as THREE.BufferAttribute;
    const pv = new THREE.Vector3();
    for (let i = 0; i < ppos.count; i++) {
      pv.fromBufferAttribute(ppos, i);
      pv.y *= 0.45;
      pv.x *= 1.9;
      ppos.setXYZ(i, pv.x, pv.y, pv.z);
    }
    pileGeom.computeVertexNormals();
    this.disposables.push(pileGeom);
    const pileMat = new THREE.MeshStandardMaterial({ color: 0x8a7150, roughness: 0.94, metalness: 0 });
    this.disposables.push(pileMat);
    const piles = new THREE.InstancedMesh(pileGeom, pileMat, 36);
    piles.castShadow = true;
    piles.receiveShadow = true;
    for (let i = 0; i < 36; i++) {
      const cluster = Math.floor(i / 6);
      const cx = firstX - 2 + cluster * 2.1 + rng.jitter(0.16);
      const cz = (cluster % 2 === 0 ? -1 : 1) * ROW_SPACING * (1 + (cluster % 2));
      e.set(rng.jitter(0.5), rng.range(0, TAU), rng.jitter(0.4));
      qt.setFromEuler(e);
      m.compose(
        new THREE.Vector3(cx + rng.jitter(0.16), 0.03 + rng.next() * 0.04, cz + rng.jitter(0.22)),
        qt,
        new THREE.Vector3(1, 1, 1).multiplyScalar(rng.range(0.8, 1.3)),
      );
      piles.setMatrixAt(i, m);
    }
    piles.instanceMatrix.needsUpdate = true;
    this.group.add(piles);

    /* ---- standing cassava, instanced ---- */
    this.buildStandingCassava(q, rng, firstX, lastX);

    /* ---- track, shelter, hills ---- */
    this.buildTrack(q, soil);
    this.buildShelter(rng);
    this.buildHills();
  }

  private buildStandingCassava(q: QualitySettings, rng: Rng, firstX: number, lastX: number): void {
    const count = q.backgroundPlants;
    const { map, alphaMap } = cached('leaf', () => cassavaLeafTexture(512));

    const leafMat = new THREE.MeshStandardMaterial({
      map,
      alphaMap,
      alphaTest: 0.34,
      side: THREE.DoubleSide,
      roughness: 0.82,
      metalness: 0,
    });
    this.disposables.push(leafMat);

    // One plant crown = five crossed leaf quads merged into a single geometry,
    // staggered in height so a stand reads as foliage rather than as cards.
    const quads: THREE.BufferGeometry[] = [];
    // A cassava leaf spans roughly a hand's width, so the crown is many small
    // leaves on short petioles, not a few large fronds.
    for (let i = 0; i < 15; i++) {
      const ring = i % 3;
      const g = new THREE.PlaneGeometry(0.64, 0.64);
      // Pivot at the petiole, then swing the blade outward and let it droop,
      // so a stand reads as a leafy shrub instead of a cone of spikes.
      g.translate(0, 0.32, 0);
      g.rotateX(1.22 + ring * 0.22);
      g.rotateY((i / 15) * TAU * 2.4);
      // Leaves are carried down the upper half of the cane, not tufted on top.
      g.translate(0, 0.50 + ring * 0.18, 0);
      quads.push(g);
    }
    const crown = mergeGeometries(quads);
    for (const g of quads) g.dispose();
    this.disposables.push(crown);

    const crowns = new THREE.InstancedMesh(crown, leafMat, count);
    crowns.castShadow = false;
    crowns.receiveShadow = false;

    const caneGeom = new THREE.CylinderGeometry(0.014, 0.022, 1.0, 6);
    caneGeom.translate(0, 0.5, 0);
    this.disposables.push(caneGeom);
    const caneMat = new THREE.MeshStandardMaterial({ color: 0x87764f, roughness: 0.9, metalness: 0 });
    this.disposables.push(caneMat);
    const canes = new THREE.InstancedMesh(caneGeom, caneMat, count);
    canes.castShadow = false;

    const m = new THREE.Matrix4();
    const qt = new THREE.Quaternion();
    const e = new THREE.Euler();
    const scale = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      // Standing crop starts three rows out and fills the middle distance.
      const band = 3 + Math.floor(rng.range(0, 7));
      const side = rng.next() < 0.5 ? -1 : 1;
      const z = side * band * ROW_SPACING + rng.jitter(0.18);
      const x = rng.range(firstX - 13, lastX + 13);
      const h = rng.range(1.05, 1.75);
      e.set(rng.jitter(0.08), rng.range(0, TAU), rng.jitter(0.08));
      qt.setFromEuler(e);
      scale.set(h * 0.9, h, h * 0.9);
      m.compose(new THREE.Vector3(x, 0, z), qt, scale);
      canes.setMatrixAt(i, m);
      crowns.setMatrixAt(i, m);
    }
    canes.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    this.group.add(canes, crowns);
  }

  private buildTrack(q: QualitySettings, soil: SoilKind): void {
    const geom = new THREE.PlaneGeometry(40, 1.9, 1, 1);
    geom.rotateX(-Math.PI / 2);
    this.disposables.push(geom);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.99, metalness: 0 });
    applyMaps(
      mat,
      cached(`soil${q.textureSize}${soil}`, () => soilMaps(q.textureSize, soil)),
      new THREE.Vector2(24, 1.2),
      q.anisotropy,
    );
    // Compacted, dust-bleached wheel track.
    mat.color.setRGB(1.16, 1.12, 1.05);
    applyMacroVariation(mat, 0.6);
    this.disposables.push(mat);
    const track = new THREE.Mesh(geom, mat);
    track.position.set(0, 0.012, -10.5);
    track.receiveShadow = true;
    this.group.add(track);
  }

  private buildShelter(rng: Rng): void {
    const shelter = new THREE.Group();
    const postGeom = new THREE.CylinderGeometry(0.045, 0.055, 2.0, 6);
    this.disposables.push(postGeom);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b5439, roughness: 0.94, metalness: 0 });
    this.disposables.push(woodMat);
    for (const [dx, dz] of [
      [-1.2, -1.0],
      [1.2, -1.0],
      [-1.2, 1.0],
      [1.2, 1.0],
    ] as const) {
      const post = new THREE.Mesh(postGeom, woodMat);
      post.position.set(dx, 1.0, dz);
      post.rotation.z = rng.jitter(0.03);
      post.castShadow = true;
      shelter.add(post);
    }
    // Thatch: a shallow hipped slab, deliberately crooked.
    const roofGeom = new THREE.BoxGeometry(3.0, 0.12, 2.6);
    const rpos = roofGeom.getAttribute('position') as THREE.BufferAttribute;
    const rv = new THREE.Vector3();
    for (let i = 0; i < rpos.count; i++) {
      rv.fromBufferAttribute(rpos, i);
      if (rv.y > 0) rv.multiplyScalar(0.82);
      rv.y += Math.sin(rv.x * 3) * 0.03;
      rpos.setXYZ(i, rv.x, rv.y, rv.z);
    }
    roofGeom.computeVertexNormals();
    this.disposables.push(roofGeom);
    const thatchMat = new THREE.MeshStandardMaterial({ color: 0x8f7a4c, roughness: 0.98, metalness: 0 });
    this.disposables.push(thatchMat);
    const roof = new THREE.Mesh(roofGeom, thatchMat);
    roof.position.y = 2.06;
    roof.rotation.z = 0.035;
    roof.castShadow = true;
    shelter.add(roof);
    shelter.position.set(-6.5, 0, -8.6);
    shelter.rotation.y = 0.28;
    this.group.add(shelter);
  }

  private buildHills(): void {
    const geom = new THREE.PlaneGeometry(240, 90, 60, 14);
    geom.rotateX(-Math.PI / 2);
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const t = clamp01((-z - 10) / 70);
      const h = (fbm2(x * 0.014 + 5, z * 0.02, 4) - 0.35) * 22 * t;
      pos.setY(i, Math.max(0, h));
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();
    this.disposables.push(geom);
    // Distant vegetation is a flat, hazy green — no bokeh, no glow.
    const mat = new THREE.MeshStandardMaterial({ color: 0x6f7f5c, roughness: 1, metalness: 0 });
    this.disposables.push(mat);
    const hills = new THREE.Mesh(geom, mat);
    hills.position.set(0, -0.4, -58);
    this.group.add(hills);

    // Humid sky: a plain vertical gradient dome, no HDR flare.
    const skyGeom = new THREE.SphereGeometry(150, 24, 16);
    this.disposables.push(skyGeom);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x8fb2c9) },
        horizon: { value: new THREE.Color(0xd6dbd2) },
      },
      vertexShader: `varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying float vY;
        void main(){ float t = clamp(vY*1.5+0.12,0.0,1.0); gl_FragColor = vec4(mix(horizon, top, t), 1.0); }`,
    });
    this.disposables.push(skyMat);
    const sky = new THREE.Mesh(skyGeom, skyMat);
    sky.renderOrder = -1;
    this.group.add(sky);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.group.removeFromParent();
  }
}

/* ------------------------------------------------------------------ */
/* worker — the scale reference                                        */
/* ------------------------------------------------------------------ */

/**
 * A worker standing at the row. Present for one reason: with a person, a boot,
 * the tool and the stem all in frame, the size of everything is settled
 * without a word of text. The head also does the looking that tells a stuck
 * player where to put the clamp.
 */
export class Worker {
  readonly group = new THREE.Group();
  private head = new THREE.Group();
  private disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];
  private lookTarget = new THREE.Vector3();
  private currentLook = new THREE.Vector3();

  constructor(q: QualitySettings, soil: SoilKind) {
    const skin = new THREE.MeshStandardMaterial({ color: 0x6b4a33, roughness: 0.72, metalness: 0 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0x8b9a86, roughness: 0.92, metalness: 0 });
    const trouser = new THREE.MeshStandardMaterial({ color: 0x4a4f56, roughness: 0.95, metalness: 0 });
    const hat = new THREE.MeshStandardMaterial({ color: 0xbda474, roughness: 0.96, metalness: 0 });
    this.disposables.push(skin, shirt, trouser, hat);

    const bootMat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 });
    applyMaps(bootMat, cached(`boot${soil}`, () => bootMaps(256, soil)), new THREE.Vector2(1, 1), q.anisotropy);
    this.disposables.push(bootMat);

    const add = (
      geom: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      parent: THREE.Object3D = this.group,
    ): THREE.Mesh => {
      this.disposables.push(geom);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // Adult, 1.68 m, standing at the row with the weight on one leg. The
    // point of this figure is scale: a boot, a tool, a stem and a person in
    // the same frame settle how big everything is without a word.
    const stance = 0.135;
    for (const sx of [-1, 1]) {
      const lean = sx * 0.02;
      // thigh
      const thigh = add(new THREE.CylinderGeometry(0.062, 0.052, 0.42, 8), trouser, sx * stance + lean, 1.02, 0);
      thigh.rotation.z = -sx * 0.045;
      // shin
      add(new THREE.CylinderGeometry(0.050, 0.044, 0.36, 8), trouser, sx * stance, 0.63, 0);
      // mud-caked rubber boot: shaft, foot, sole
      const shaft = add(new THREE.CylinderGeometry(0.062, 0.066, 0.34, 10), bootMat, sx * stance, 0.30, 0);
      shaft.scale.z = 1.06;
      const foot = add(new THREE.BoxGeometry(0.105, 0.09, 0.24), bootMat, sx * stance, 0.055, 0.045);
      foot.rotation.x = 0.04;
      void foot;
      const sole = add(new THREE.BoxGeometry(0.115, 0.028, 0.26), bootMat, sx * stance, 0.014, 0.05);
      sole.receiveShadow = true;
    }

    // torso: hips, chest, shoulders
    add(new THREE.CapsuleGeometry(0.125, 0.10, 4, 10), trouser, 0, 1.26, 0).scale.set(1.15, 1, 0.8);
    const chest = add(new THREE.CapsuleGeometry(0.135, 0.24, 4, 10), shirt, 0, 1.46, 0);
    chest.scale.set(1.16, 1, 0.72);
    const shoulders = add(new THREE.CapsuleGeometry(0.055, 0.30, 4, 8), shirt, 0, 1.58, 0);
    shoulders.rotation.z = Math.PI / 2;

    // arms hanging, elbows slightly forward as if about to take the handle
    for (const sx of [-1, 1]) {
      const upper = add(new THREE.CapsuleGeometry(0.040, 0.24, 4, 8), shirt, sx * 0.20, 1.44, 0.01);
      upper.rotation.z = -sx * 0.10;
      const fore = add(new THREE.CapsuleGeometry(0.034, 0.24, 4, 8), skin, sx * 0.225, 1.19, 0.06);
      fore.rotation.z = -sx * 0.06;
      fore.rotation.x = 0.24;
      add(new THREE.SphereGeometry(0.042, 10, 8), skin, sx * 0.235, 1.06, 0.12);
    }

    // Head group so it can turn between the clamp and the stem base.
    this.head.position.set(0, 1.70, 0);
    add(new THREE.CylinderGeometry(0.046, 0.052, 0.08, 8), skin, 0, -0.055, 0, this.head);
    add(new THREE.SphereGeometry(0.090, 14, 12), skin, 0, 0.01, 0, this.head).scale.set(0.90, 1.06, 0.98);
    add(new THREE.CylinderGeometry(0.098, 0.106, 0.075, 14), hat, 0, 0.072, 0, this.head);
    const brim = add(new THREE.CylinderGeometry(0.215, 0.215, 0.010, 18), hat, 0, 0.046, 0, this.head);
    brim.rotation.x = 0.05;
    this.group.add(this.head);

    this.currentLook.set(0, 1.4, 2);
    this.lookTarget.copy(this.currentLook);
  }

  lookAt(point: THREE.Vector3): void {
    this.lookTarget.copy(point);
  }

  update(dt: number): void {
    this.currentLook.lerp(this.lookTarget, Math.min(1, dt * 4));
    const local = this.group.worldToLocal(this.currentLook.clone());
    const dir = local.clone().sub(this.head.position);
    this.head.rotation.y = Math.atan2(dir.x, dir.z);
    this.head.rotation.x = -Math.atan2(dir.y, Math.hypot(dir.x, dir.z)) * 0.6;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.group.removeFromParent();
  }
}

/* ------------------------------------------------------------------ */
/* basket                                                              */
/* ------------------------------------------------------------------ */

/** Where lifted clusters go. Its mouth is the drop target. */
export class Basket {
  readonly group = new THREE.Group();
  readonly mouth = new THREE.Vector3(0, 0.36, 0);
  readonly radius = 0.30;
  private contents = new THREE.Group();
  private disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];

  constructor(q: QualitySettings) {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
    applyMaps(mat, cached('basket', () => basketMaps(512)), new THREE.Vector2(1, 1), q.anisotropy);
    this.disposables.push(mat);

    const wall = new THREE.CylinderGeometry(0.30, 0.21, 0.36, 22, 3, true);
    this.disposables.push(wall);
    const wallMesh = new THREE.Mesh(wall, mat);
    wallMesh.position.y = 0.18;
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    this.group.add(wallMesh);

    const base = new THREE.CircleGeometry(0.21, 22);
    base.rotateX(-Math.PI / 2);
    this.disposables.push(base);
    const baseMesh = new THREE.Mesh(base, mat);
    baseMesh.position.y = 0.005;
    baseMesh.receiveShadow = true;
    this.group.add(baseMesh);

    const rim = new THREE.TorusGeometry(0.30, 0.016, 8, 24);
    this.disposables.push(rim);
    const rimMesh = new THREE.Mesh(rim, mat);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 0.36;
    rimMesh.castShadow = true;
    this.group.add(rimMesh);

    this.group.add(this.contents);
  }

  /** Drop a token cluster in; the basket visibly fills as the day goes on. */
  addHarvest(seed: number): void {
    const rng = new Rng(seed);
    const geom = new THREE.IcosahedronGeometry(0.05, 1);
    const p = geom.getAttribute('position') as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      v.x *= 2.1;
      v.y *= 0.5;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geom.computeVertexNormals();
    this.disposables.push(geom);
    const mat = new THREE.MeshStandardMaterial({ color: 0x9d8462, roughness: 0.92, metalness: 0 });
    this.disposables.push(mat);
    const level = this.contents.children.length;
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(rng.jitter(0.12), 0.1 + level * 0.012 + rng.next() * 0.03, rng.jitter(0.12));
      mesh.rotation.set(rng.jitter(0.5), rng.range(0, TAU), rng.jitter(0.5));
      mesh.castShadow = true;
      this.contents.add(mesh);
    }
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.group.removeFromParent();
  }
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/** Minimal geometry merge (position/uv/normal, non-indexed output). */
function mergeGeometries(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  for (const g of geoms) {
    const nonIndexed = g.index ? g.toNonIndexed() : g;
    const p = nonIndexed.getAttribute('position') as THREE.BufferAttribute;
    const n = nonIndexed.getAttribute('normal') as THREE.BufferAttribute;
    const u = nonIndexed.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
      uvs.push(u.getX(i), u.getY(i));
    }
    if (nonIndexed !== g) nonIndexed.dispose();
  }
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return out;
}

/** Soft blob under an object so nothing floats. */
export function makeContactShadow(radius: number): THREE.Mesh {
  const geom = new THREE.PlaneGeometry(radius * 2, radius * 2);
  geom.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x2b1a10,
    transparent: true,
    opacity: 0.42,
    alphaMap: radialAlpha(64, 1.4),
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.renderOrder = 2;
  return mesh;
}
