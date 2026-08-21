import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  FogExp2,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  Scene,
  SphereGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng } from '../core/rng';
import { mergeStatics } from './mergeStatics';
import type { Settings } from '../core/settings';
import {
  bladeTexture,
  clothTexture,
  foliageTexture,
  turfTexture,
  wearAlpha,
  wetSoilRoughness,
  wetSoilTexture,
} from './textures';

const HORIZON = new Color(0.62, 0.56, 0.50);

function jitterGeometry(geo: BufferGeometry, amount: number, rng: Rng): BufferGeometry {
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(
      i,
      p.getX(i) + rng.spread(amount),
      p.getY(i) + rng.spread(amount),
      p.getZ(i) + rng.spread(amount),
    );
  }
  geo.computeVertexNormals();
  return geo;
}

/** Wind sway injected into any standard material, driven by world position. */
function addSway(mat: MeshStandardMaterial | MeshLambertMaterial, strength: number): { uTime: { value: number } } {
  const uTime = { value: 0 };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.uniforms.uSway = { value: strength };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uSway;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec4 wp = modelMatrix * vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
          #endif
          float h = max(0.0, transformed.y);
          float s = sin(uTime * 1.3 + wp.x * 1.4 + wp.z * 0.9) * 0.6
                  + sin(uTime * 2.7 + wp.x * 3.1) * 0.25;
          transformed.x += s * uSway * h;
          transformed.z += s * 0.55 * uSway * h;
        }`,
      );
  };
  mat.needsUpdate = true;
  return { uTime };
}

export class Park {
  readonly group = new Group();
  private swayClocks: { uTime: { value: number } }[] = [];
  private rng: Rng;

  constructor(scene: Scene, settings: Settings) {
    this.rng = new Rng(settings.seed ^ 0x5eed);
    scene.fog = new FogExp2(HORIZON.getHex(), 0.0048);
    scene.add(this.group);

    this.buildGround(settings);
    this.buildWearPatch();
    this.buildPath();
    this.buildPebbles(settings);
    this.buildGrass(settings);
    this.buildShrubs(settings);
    this.buildBenches();
    this.buildMidTrees(settings);
    this.buildDistance(settings);

    // Benches, trees and the far ring are furniture: merge them per material.
    mergeStatics(this.group);
  }

  private buildGround(settings: Settings): void {
    const turf = new Mesh(
      new PlaneGeometry(120, 120, 1, 1),
      new MeshStandardMaterial({
        map: (() => {
          const t = turfTexture().clone();
          t.repeat.set(40, 40);
          t.needsUpdate = true;
          return t;
        })(),
        roughness: 0.96,
        metalness: 0,
        color: new Color(0.82, 0.80, 0.58),
      }),
    );
    turf.rotation.x = -Math.PI / 2;
    turf.receiveShadow = settings.shadows;
    this.group.add(turf);
  }

  /** Bare, damp earth worn out under the swing by years of feet. */
  private buildWearPatch(): void {
    const geo = new CircleGeometry(2.65, 40);
    const pos = geo.getAttribute('position');
    const rng = new Rng(4242);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const r = Math.hypot(x, y);
      if (r > 0.01) {
        // Stretch along the swing direction and rough up the rim.
        const k = 1 + rng.spread(0.11);
        pos.setXY(i, x * 1.28 * k, y * 0.82 * k);
      }
    }
    geo.computeVertexNormals();
    const mesh = new Mesh(
      geo,
      new MeshStandardMaterial({
        map: wetSoilTexture(),
        roughnessMap: wetSoilRoughness(),
        alphaMap: wearAlpha(),
        transparent: true,
        depthWrite: false,
        roughness: 1,
        metalness: 0,
        color: new Color(0.74, 0.70, 0.66),
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.005;
    mesh.receiveShadow = true;
    mesh.renderOrder = -6;
    this.group.add(mesh);

    // Two shallow puddles: darker, smoother, catching the low sun.
    const puddleMat = new MeshStandardMaterial({
      color: new Color(0.14, 0.13, 0.12),
      roughness: 0.11,
      metalness: 0.0,
      transparent: true,
      opacity: 0.92,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    for (const [px, pz, r] of [
      [-1.5, 0.95, 0.42],
      [1.75, -0.7, 0.3],
    ] as const) {
      const p = new Mesh(new CircleGeometry(r, 22), puddleMat);
      p.rotation.x = -Math.PI / 2;
      p.position.set(px, 0.011, pz);
      p.scale.set(1, 0.62, 1);
      p.renderOrder = -5;
      this.group.add(p);
    }
  }

  /** A packed gravel walk that runs out from under the mist arch. */
  private buildPath(): void {
    const pts: Vector3[] = [];
    for (let i = 0; i <= 26; i++) {
      const t = i / 26;
      const x = -8 + t * 18;
      const z = 5.0 + Math.sin(t * 2.1 + 0.4) * 1.5 - t * 0.6;
      pts.push(new Vector3(x, 0.012, z));
    }
    const half = 0.60;
    const positions: number[] = [];
    const uvs: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const d = new Vector3().subVectors(b, a).normalize();
      const n = new Vector3(-d.z, 0, d.x).multiplyScalar(half);
      const a0 = new Vector3().subVectors(a, n);
      const a1 = new Vector3().addVectors(a, n);
      const b0 = new Vector3().subVectors(b, n);
      const b1 = new Vector3().addVectors(b, n);
      positions.push(a0.x, a0.y, a0.z, a1.x, a1.y, a1.z, b0.x, b0.y, b0.z);
      positions.push(a1.x, a1.y, a1.z, b1.x, b1.y, b1.z, b0.x, b0.y, b0.z);
      const v0 = i / pts.length;
      const v1 = (i + 1) / pts.length;
      uvs.push(0, v0, 1, v0, 0, v1, 1, v0, 1, v1, 0, v1);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    const mesh = new Mesh(
      geo,
      new MeshStandardMaterial({
        map: wetSoilTexture(),
        color: new Color(1.18, 1.12, 1.02),
        roughness: 0.92,
        metalness: 0,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private buildPebbles(settings: Settings): void {
    const n = settings.tier === 'low' ? 40 : 90;
    const geo = jitterGeometry(new IcosahedronGeometry(0.026, 0), 0.009, new Rng(1));
    const mat = new MeshStandardMaterial({
      color: new Color(0.30, 0.28, 0.255),
      roughness: 0.84,
      metalness: 0,
      flatShading: true,
    });
    const inst = new InstancedMesh(geo, mat, n);
    const o = new Object3D();
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const r = Math.sqrt(this.rng.next()) * 2.7;
      o.position.set(Math.cos(a) * r * 1.25, this.rng.range(0.006, 0.03), Math.sin(a) * r * 0.85);
      o.rotation.set(this.rng.range(0, 3), this.rng.range(0, 3), this.rng.range(0, 3));
      o.scale.setScalar(this.rng.range(0.3, 0.85));
      o.updateMatrix();
      inst.setMatrixAt(i, o.matrix);
    }
    inst.castShadow = false;
    inst.receiveShadow = settings.shadows;
    inst.instanceMatrix.needsUpdate = true;
    this.group.add(inst);
  }

  /** Instanced turf tufts: one draw call for the whole lawn edge. */
  private buildGrass(settings: Settings): void {
    const blade = new PlaneGeometry(0.070, 0.125, 1, 2);
    blade.translate(0, 0.0625, 0);
    const cross = blade.clone();
    cross.rotateY(Math.PI / 2);
    const tuft = mergeGeometries([blade, cross])!;

    const mat = new MeshLambertMaterial({
      map: bladeTexture(),
      alphaTest: 0.42,
      side: DoubleSide,
      color: new Color(1.06, 1.02, 0.80),
    });
    this.swayClocks.push(addSway(mat, 0.22));

    const n = settings.grassBlades;
    const inst = new InstancedMesh(tuft, mat, n);
    const o = new Object3D();
    let placed = 0;
    let guard = 0;
    while (placed < n && guard++ < n * 6) {
      const x = this.rng.range(-11, 11);
      const z = this.rng.range(-9, 9);
      // The worn hollow under the swing has no grass in it.
      const worn = Math.hypot(x / 3.5, z / 2.3);
      if (worn < 1.05) continue;
      o.position.set(x, 0, z);
      o.rotation.set(this.rng.spread(0.16), this.rng.range(0, 3.14), this.rng.spread(0.16));
      o.scale.set(this.rng.range(0.8, 1.7), this.rng.range(0.6, 1.5), this.rng.range(0.8, 1.7));
      o.updateMatrix();
      inst.setMatrixAt(placed++, o.matrix);
    }
    inst.count = placed;
    inst.instanceMatrix.needsUpdate = true;
    inst.receiveShadow = settings.shadows;
    inst.frustumCulled = false;
    this.group.add(inst);
  }

  /** Low shrubs; the ones nearest the arch carry beads of condensed mist. */
  private buildShrubs(settings: Settings): void {
    const bushGeo = jitterGeometry(new IcosahedronGeometry(0.52, 2), 0.055, new Rng(21));
    const bushMat = new MeshStandardMaterial({
      map: foliageTexture(),
      color: new Color(0.92, 1.02, 0.66),
      roughness: 0.82,
      metalness: 0,
      flatShading: true,
    });
    this.swayClocks.push(addSway(bushMat, 0.035));

    const spots: [number, number, number][] = [
      [4.6, 1.0, 1.15],
      [3.0, 3.9, 0.85],
      [-5.4, 2.4, 1.05],
      [-3.4, -3.6, 0.95],
      [5.9, -2.2, 1.25],
      [-7.2, -1.2, 0.9],
      [1.4, 5.2, 1.1],
      [-1.8, 6.0, 0.8],
    ];
    const inst = new InstancedMesh(bushGeo, bushMat, spots.length * 3);
    const o = new Object3D();
    let i = 0;
    for (const [x, z, s] of spots) {
      for (let k = 0; k < 3; k++) {
        o.position.set(x + this.rng.spread(0.42), 0.24 + this.rng.range(0, 0.22) * s, z + this.rng.spread(0.42));
        o.rotation.set(this.rng.spread(0.4), this.rng.range(0, 3), this.rng.spread(0.4));
        o.scale.setScalar(s * this.rng.range(0.62, 1.12));
        o.updateMatrix();
        inst.setMatrixAt(i++, o.matrix);
      }
    }
    inst.count = i;
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = settings.shadows;
    inst.receiveShadow = settings.shadows;
    this.group.add(inst);

    // Water beads on the leaves closest to the nozzles.
    const dropGeo = new SphereGeometry(0.011, 6, 5);
    const dropMat = new MeshStandardMaterial({
      color: new Color(0.80, 0.86, 0.92),
      roughness: 0.06,
      metalness: 0,
      transparent: true,
      opacity: 0.72,
    });
    const beads = settings.tier === 'low' ? 40 : 110;
    const dinst = new InstancedMesh(dropGeo, dropMat, beads);
    for (let d = 0; d < beads; d++) {
      const base = spots[d % 2];
      const a = this.rng.range(0, 6.28);
      const r = this.rng.range(0.2, 0.62);
      o.position.set(
        base[0] + Math.cos(a) * r,
        0.22 + this.rng.range(0.05, 0.62),
        base[1] + Math.sin(a) * r,
      );
      o.rotation.set(0, 0, 0);
      o.scale.setScalar(this.rng.range(0.7, 1.9));
      o.updateMatrix();
      dinst.setMatrixAt(d, o.matrix);
    }
    dinst.instanceMatrix.needsUpdate = true;
    this.group.add(dinst);
  }

  private buildBenches(): void {
    const slatMat = new MeshStandardMaterial({
      map: clothTexture([132, 96, 62]),
      color: new Color(0.86, 0.74, 0.58),
      roughness: 0.78,
      metalness: 0,
    });
    const ironMat = new MeshStandardMaterial({
      color: new Color(0.13, 0.14, 0.14),
      roughness: 0.55,
      metalness: 0.8,
    });

    for (const [x, z, ry] of [
      [-6.2, 4.1, 0.42],
      [6.4, 4.6, -0.85],
    ] as const) {
      const g = new Group();
      for (let i = 0; i < 4; i++) {
        const slat = new Mesh(new BoxGeometry(1.65, 0.035, 0.10), slatMat);
        slat.position.set(0, 0.44, -0.16 + i * 0.115);
        slat.castShadow = true;
        slat.receiveShadow = true;
        g.add(slat);
      }
      for (let i = 0; i < 3; i++) {
        const slat = new Mesh(new BoxGeometry(1.65, 0.10, 0.032), slatMat);
        slat.position.set(0, 0.62 + i * 0.125, -0.24);
        slat.rotation.x = -0.16;
        slat.castShadow = true;
        g.add(slat);
      }
      for (const sx of [-0.72, 0.72]) {
        const leg = new Mesh(new BoxGeometry(0.05, 0.44, 0.05), ironMat);
        leg.position.set(sx, 0.22, 0.2);
        leg.castShadow = true;
        g.add(leg);
        const leg2 = new Mesh(new BoxGeometry(0.05, 0.86, 0.05), ironMat);
        leg2.position.set(sx, 0.43, -0.26);
        leg2.castShadow = true;
        g.add(leg2);
        const rail = new Mesh(new BoxGeometry(0.05, 0.05, 0.5), ironMat);
        rail.position.set(sx, 0.42, -0.03);
        g.add(rail);
      }
      g.position.set(x, 0, z);
      g.rotation.y = ry;
      this.group.add(g);
    }
  }

  private buildMidTrees(settings: Settings): void {
    const trunkMat = new MeshStandardMaterial({
      color: new Color(0.26, 0.21, 0.17),
      roughness: 0.94,
      metalness: 0,
      flatShading: true,
    });
    const canopyMat = new MeshStandardMaterial({
      map: foliageTexture(),
      color: new Color(0.98, 1.02, 0.62),
      roughness: 0.86,
      metalness: 0,
      flatShading: true,
    });
    this.swayClocks.push(addSway(canopyMat, 0.02));

    const spots: [number, number, number][] = [
      // Nothing large inside about 20 m on the camera's side of the swing, so a
      // canopy never drops into a corner of the frame.
      [-21.0, -11.0, 2.0],
      [18.5, -15.0, 2.3],
      [-24.0, 14.0, 1.7],
      [24.0, 10.0, 2.0],
      [-28.0, 1.0, 2.2],
      [7.0, -22.0, 1.9],
      [-8.0, -25.0, 2.1],
      [29.0, -4.0, 1.8],
      [-33.0, -18.0, 2.4],
      [15.0, 21.0, 1.6],
    ];
    for (const [x, z, s] of spots) {
      const g = new Group();
      const h = 3.9 * s;
      const trunk = new Mesh(new CylinderGeometry(0.14 * s, 0.27 * s, h, 9), trunkMat);
      trunk.position.y = h / 2;
      trunk.castShadow = settings.shadows;
      g.add(trunk);
      for (let b = 0; b < 3; b++) {
        const bl = 1.05 * s;
        const branch = new Mesh(new CylinderGeometry(0.045 * s, 0.10 * s, bl, 6), trunkMat);
        const a = this.rng.range(0, 6.28);
        branch.position.set(Math.cos(a) * 0.3 * s, h * (0.48 + b * 0.12), Math.sin(a) * 0.3 * s);
        branch.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
        g.add(branch);
      }
      const lobes = 11;
      const parts: BufferGeometry[] = [];
      for (let i = 0; i < lobes; i++) {
        const r = this.rng.range(0.48, 0.95) * s;
        const geo = jitterGeometry(new IcosahedronGeometry(r, 1), 0.085 * s, this.rng);
        geo.translate(
          this.rng.spread(1.15 * s),
          h * 0.66 + this.rng.range(-0.15, 1.30) * s,
          this.rng.spread(1.15 * s),
        );
        parts.push(geo);
      }
      const canopy = new Mesh(mergeGeometries(parts)!, canopyMat);
      canopy.castShadow = false;
      g.add(canopy);
      g.position.set(x, 0, z);
      this.group.add(g);
    }
  }

  /** Distance is built from value, saturation and overlap, never from blur. */
  private buildDistance(settings: Settings): void {
    void settings;
    const far = new Group();

    // Treeline ring: real trees, just simplified — a trunk and a lumpy crown each,
    // kept crisp and dark so distance comes from value and overlap, not blur.
    const treeMat = new MeshLambertMaterial({ color: new Color(0.120, 0.145, 0.082) });
    const treeMat2 = new MeshLambertMaterial({ color: new Color(0.175, 0.185, 0.105) });
    const barkMat = new MeshLambertMaterial({ color: new Color(0.095, 0.078, 0.064) });
    const crown = new IcosahedronGeometry(1, 1);
    const cone = new ConeGeometry(1, 2.6, 7).toNonIndexed();
    const bole = new CylinderGeometry(0.10, 0.16, 1, 6).toNonIndexed();
    const crowns: BufferGeometry[] = [];
    const crowns2: BufferGeometry[] = [];
    const boles: BufferGeometry[] = [];
    for (let i = 0; i < 150; i++) {
      const a = (i / 150) * Math.PI * 2 + this.rng.spread(0.10);
      const r = this.rng.range(40, 72);
      const s = this.rng.range(5.0, 10.0);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const trunkH = s * this.rng.range(0.34, 0.52);

      const t = bole.clone();
      t.scale(s * 0.4, trunkH, s * 0.4);
      t.translate(x, trunkH / 2, z);
      boles.push(t);

      const conifer = this.rng.next() < 0.18;
      const lobes = conifer ? 1 : 3;
      for (let l = 0; l < lobes; l++) {
        const geo = conifer ? cone.clone() : crown.clone();
        const rad = s * (conifer ? 0.34 : this.rng.range(0.26, 0.40));
        geo.scale(rad, rad * (conifer ? 1.5 : this.rng.range(0.78, 1.05)), rad);
        geo.translate(
          x + this.rng.spread(s * 0.22),
          trunkH + rad * (conifer ? 1.1 : this.rng.range(0.45, 0.95)),
          z + this.rng.spread(s * 0.22),
        );
        (this.rng.next() < 0.5 ? crowns : crowns2).push(geo);
      }
    }
    far.add(new Mesh(mergeGeometries(boles)!, barkMat));
    far.add(new Mesh(mergeGeometries(crowns)!, treeMat));
    far.add(new Mesh(mergeGeometries(crowns2)!, treeMat2));

    // Houses tucked in behind the trees on the hill side.
    const wallMat = new MeshLambertMaterial({ color: new Color(0.52, 0.48, 0.45) });
    const roofMat = new MeshLambertMaterial({ color: new Color(0.34, 0.27, 0.25) });
    for (let i = 0; i < 11; i++) {
      const a = this.rng.range(-2.5, 0.4);
      const r = this.rng.range(84, 118);
      const w = this.rng.range(6, 12);
      const h = this.rng.range(5.0, 9.0);
      const d = this.rng.range(6, 11);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = this.hillHeight(x, z);
      const b = new Mesh(new BoxGeometry(w, h, d), wallMat);
      b.position.set(x, y + h / 2, z);
      b.rotation.y = this.rng.range(0, 3);
      far.add(b);
      const roof = new Mesh(new ConeGeometry(Math.max(w, d) * 0.78, h * 0.45, 4), roofMat);
      roof.position.set(x, y + h + h * 0.22, z);
      roof.rotation.y = b.rotation.y + Math.PI / 4;
      far.add(roof);
    }

    // Two soft hills, lit on their sunward flank.
    for (const [hx, hz, hr, hh, tint] of [
      [-105, -72, 72, 13, 0.56],
      [92, -118, 90, 17, 0.50],
    ] as const) {
      const g = new SphereGeometry(hr, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      g.scale(1, hh / hr, 1.25);
      const m = new Mesh(g, new MeshLambertMaterial({ color: new Color(tint, tint * 1.04, tint * 0.98) }));
      m.position.set(hx, -1.5, hz);
      far.add(m);
    }

    far.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
    this.group.add(far);
  }

  private hillHeight(x: number, z: number): number {
    return Math.max(0, 5 - Math.hypot(x, z) * 0.02) * 0.2;
  }

  update(time: number): void {
    for (const c of this.swayClocks) c.uTime.value = time;
  }
}

// Keep tree-shaking honest about the helpers used inside instancing loops.
void Matrix4;
void Quaternion;
