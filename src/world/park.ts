import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three';
import { MaterialLibrary } from '../render/materials';
import { bakeFoliage } from '../render/textures';
import { Noise2D } from '../render/noise';
import { MORNING } from '../render/env';

/** Shared uniforms for the foliage: one wind clock, one sun direction. */
export const foliageUniforms = {
  uWind: { value: 0 },
  uSunView: { value: new Vector3(0, 1, 0) },
};

function foliageMaterial(lib: MaterialLibrary): MeshPhysicalMaterial {
  const maps = bakeFoliage();
  const m = new MeshPhysicalMaterial({
    map: maps.map,
    alphaMap: maps.alphaMap,
    alphaTest: 0.42,
    transparent: false,
    side: 2,
    roughness: 0.82,
    metalness: 0,
    sheen: 0.6,
    sheenRoughness: 0.7,
    sheenColor: lib.matte('#9ac257').color,
    envMapIntensity: 0.6,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = foliageUniforms.uWind;
    shader.uniforms.uSunView = foliageUniforms.uSunView;
    shader.vertexShader =
      'uniform float uWind;\nvarying float vLeafDepth;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 wp = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 wp = vec3(modelMatrix[3][0], modelMatrix[3][1], modelMatrix[3][2]);
        #endif
        // Shallow, uneven sway: leaves higher up move more.
        float ph = uWind + wp.x * 0.7 + wp.z * 0.5;
        float amp = 0.028 * max(0.0, position.y + 0.5);
        transformed.x += sin(ph) * amp + sin(ph * 2.3) * amp * 0.35;
        transformed.z += cos(ph * 0.83) * amp * 0.8;
        vLeafDepth = position.y + 0.5;
      `,
      );
    shader.fragmentShader =
      'uniform vec3 uSunView;\nvarying float vLeafDepth;\n' +
      shader.fragmentShader.replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        // Light coming through the blade, which is what stops a canopy
        // reading as flat cut-out green.
        float backLit = pow(clamp(dot(normalize(-vViewPosition), normalize(uSunView)), 0.0, 1.0), 3.0);
        reflectedLight.directDiffuse += diffuseColor.rgb * vec3(0.85, 1.05, 0.55) * backLit * 0.9;
      `,
      );
  };
  m.customProgramCacheKey = () => 'suberidai-foliage';
  return m;
}

export interface ParkOptions {
  foliageDensity: number;
}

/** The park the slide stands in: surfacing, ground, planting and street kit. */
export class Park {
  readonly root = new Group();
  private canopy: InstancedMesh | null = null;

  constructor(lib: MaterialLibrary, opts: ParkOptions) {
    this.root.name = 'park';

    // Grass everywhere, then the worn soil apron, then the poured surfacing.
    const grass = new Mesh(new PlaneGeometry(90, 90), lib.grass());
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.012;
    grass.receiveShadow = true;
    this.root.add(grass);

    const soil = new Mesh(new CircleGeometry(9.4, 48), lib.soil());
    soil.rotation.x = -Math.PI / 2;
    soil.position.set(5.0, -0.004, 0);
    soil.scale.set(1.15, 1, 0.92);
    soil.receiveShadow = true;
    this.root.add(soil);

    // Poured rubber safety surfacing: the ellipse the simulation also uses.
    const pad = new Mesh(new CircleGeometry(1, 56), lib.rubberFloor());
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(5.55, 0.002, 0);
    pad.scale.set(3.5, 1, 2.45);
    pad.receiveShadow = true;
    this.root.add(pad);

    // A slightly proud kerb so the surfacing does not read as a decal.
    const kerb = new Mesh(new CylinderGeometry(1, 1, 0.05, 56, 1, true), lib.paint('#8d5e46', 'kerb'));
    kerb.position.set(5.55, 0.024, 0);
    kerb.scale.set(3.53, 1, 2.48);
    kerb.receiveShadow = true;
    this.root.add(kerb);

    this.buildPlanting(lib, opts.foliageDensity);
    this.buildBench(lib);
    this.buildFence(lib);
  }

  private buildPlanting(lib: MaterialLibrary, density: number): void {
    const n = new Noise2D(2468);
    const mat = foliageMaterial(lib);
    const bark = lib.wood();

    type Cluster = { pos: Vector3; size: number; rot: number };
    const clusters: Cluster[] = [];
    const trunks: { pos: Vector3; h: number; r: number }[] = [];

    // Hedge behind the slide tower.
    for (let i = 0; i < Math.round(16 * density); i++) {
      const t = i / Math.max(1, Math.round(16 * density) - 1);
      const x = -3.4 + t * 2.4;
      const z = -4.6 + n.value(i * 3.1, 2.2) * 0.5;
      for (let k = 0; k < 2; k++) {
        clusters.push({
          pos: new Vector3(x, 0.5 + n.value(i * 1.7, k * 5) * 0.28, z),
          size: 1.15 + n.value(i * 2.3, k) * 0.5,
          rot: (k * Math.PI) / 2 + n.value(i, k * 3) * 0.6,
        });
      }
    }

    // Three park trees, close enough to read as real planting.
    const treeSpots = [
      new Vector3(-2.6, 0, 5.0),
      new Vector3(9.4, 0, -5.6),
      new Vector3(-5.4, 0, -2.0),
      new Vector3(12.0, 0, 4.4),
    ];
    for (let i = 0; i < treeSpots.length; i++) {
      const p = treeSpots[i];
      const h = 2.6 + n.value(i * 7.7, 1.3) * 1.5;
      trunks.push({ pos: p.clone(), h, r: 0.1 + n.value(i * 2.2, 6) * 0.05 });
      const blobs = Math.max(2, Math.round(4 * density));
      for (let k = 0; k < blobs; k++) {
        clusters.push({
          pos: new Vector3(
            p.x + (n.value(i * 5 + k, 1) - 0.5) * 1.5,
            h + 0.5 + (n.value(i * 3 + k, 9) - 0.5) * 0.9,
            p.z + (n.value(i * 9 + k, 4) - 0.5) * 1.5,
          ),
          size: 2.0 + n.value(i + k * 2, 7) * 1.3,
          rot: n.value(i * 11 + k, 2) * Math.PI,
        });
      }
    }

    // Low shrubs scattered around the edge of the soil apron.
    const shrubs = Math.round(14 * density);
    for (let i = 0; i < shrubs; i++) {
      const a = (i / shrubs) * Math.PI * 2 + n.value(i, 3) * 0.4;
      const rad = 8.2 + n.value(i * 4, 8) * 3.4;
      clusters.push({
        pos: new Vector3(5.0 + Math.cos(a) * rad, 0.34 + n.value(i, 2) * 0.2, Math.sin(a) * rad),
        size: 0.9 + n.value(i * 3, 5) * 0.7,
        rot: n.value(i * 6, 1) * Math.PI,
      });
    }

    const geo = new PlaneGeometry(1, 1);
    const inst = new InstancedMesh(geo, mat, clusters.length * 2);
    const m = new Matrix4();
    const q = new Quaternion();
    const scl = new Vector3();
    let idx = 0;
    for (const c of clusters) {
      for (let k = 0; k < 2; k++) {
        q.setFromAxisAngle(new Vector3(0, 1, 0), c.rot + (k * Math.PI) / 2);
        scl.set(c.size, c.size * 0.85, c.size);
        m.compose(c.pos, q, scl);
        inst.setMatrixAt(idx++, m);
      }
    }
    inst.count = idx;
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.frustumCulled = false;
    this.canopy = inst;
    this.root.add(inst);

    const trunkGeo = new CylinderGeometry(0.6, 1, 1, 8, 1);
    const trunkInst = new InstancedMesh(trunkGeo, bark, trunks.length);
    let ti = 0;
    for (const t of trunks) {
      q.identity();
      scl.set(t.r, t.h, t.r);
      m.compose(new Vector3(t.pos.x, t.h / 2, t.pos.z), q, scl);
      trunkInst.setMatrixAt(ti++, m);
    }
    trunkInst.castShadow = true;
    trunkInst.receiveShadow = true;
    this.root.add(trunkInst);
  }

  private buildBench(lib: MaterialLibrary): void {
    const g = new Group();
    const wood = lib.wood();
    const paint = lib.paint('#3b4a44', 'bench');
    for (let i = 0; i < 3; i++) {
      const slat = new Mesh(new BoxGeometry(1.5, 0.035, 0.11), wood);
      slat.position.set(0, 0.44, -0.13 + i * 0.13);
      slat.castShadow = true;
      slat.receiveShadow = true;
      g.add(slat);
    }
    for (let i = 0; i < 2; i++) {
      const back = new Mesh(new BoxGeometry(1.5, 0.1, 0.032), wood);
      back.position.set(0, 0.66 + i * 0.13, -0.2);
      back.rotation.x = -0.18;
      back.castShadow = true;
      g.add(back);
    }
    for (const x of [-0.62, 0.62]) {
      const leg = new Mesh(new BoxGeometry(0.05, 0.44, 0.42), paint);
      leg.position.set(x, 0.22, -0.02);
      leg.castShadow = true;
      leg.receiveShadow = true;
      g.add(leg);
      const post = new Mesh(new BoxGeometry(0.04, 0.4, 0.04), paint);
      post.position.set(x, 0.6, -0.19);
      post.castShadow = true;
      g.add(post);
    }
    g.position.set(2.0, 0, 5.1);
    g.rotation.y = -0.5;
    this.root.add(g);
  }

  private buildFence(lib: MaterialLibrary): void {
    const paint = lib.paint('#7d8a7a', 'fence');
    const g = new Group();
    const span = 22;
    const posts = 14;
    for (let i = 0; i < posts; i++) {
      const p = new Mesh(new CylinderGeometry(0.045, 0.05, 0.82, 8), paint);
      p.position.set(-6 + (i / (posts - 1)) * span, 0.41, -7.6);
      p.castShadow = true;
      p.receiveShadow = true;
      g.add(p);
    }
    for (const y of [0.66, 0.4]) {
      const rail = new Mesh(new CylinderGeometry(0.03, 0.03, span, 8), paint);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(-6 + span / 2, y, -7.6);
      rail.castShadow = true;
      g.add(rail);
    }
    this.root.add(g);
  }

  setFoliageDensity(density: number): void {
    if (!this.canopy) return;
    // Cheapest possible LOD: draw fewer instances, keep the buffer.
    const max = this.canopy.instanceMatrix.count;
    this.canopy.count = Math.max(6, Math.round(max * Math.min(1, density)));
  }

  update(t: number, sunView: Vector3): void {
    foliageUniforms.uWind.value = t * 0.85;
    foliageUniforms.uSunView.value.copy(sunView);
  }
}

export const SUN_DIRECTION = new Vector3(...MORNING.sunDir).normalize();
