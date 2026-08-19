import * as THREE from 'three';
import { Config } from '../engine/config';
import {
  creamStreakNormal,
  parchmentMap,
  spongeMap,
  steelRoughness,
  steelScratchNormal,
  wallMap,
  woodMap,
} from '../util/textures';

/**
 * Buttercream is an aerated fat emulsion: weak, broad gloss, no mirror, and the
 * feathered edge of a petal lets a little light through. We fake the last part
 * with a cheap back-scatter term driven by a per-vertex "thinness" attribute
 * (aThin: 0 at the heavy root, 1 at the shaved edge).
 */
const creamMaterials: THREE.MeshPhysicalMaterial[] = [];
const lightDirView = new THREE.Vector3(0, -1, 0);

export function makeCreamMaterial(color: THREE.ColorRepresentation, opts: { streak?: THREE.Texture } = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.44,
    metalness: 0.0,
    clearcoat: Config.fast ? 0 : 0.22,
    clearcoatRoughness: 0.58,
    sheen: Config.fast ? 0 : 0.45,
    sheenRoughness: 0.75,
    sheenColor: new THREE.Color(0xfff1e0),
    ior: 1.45,
    specularIntensity: 0.7,
    side: THREE.DoubleSide,
    flatShading: false,
  });
  if (opts.streak) {
    mat.normalMap = opts.streak;
    mat.normalScale = new THREE.Vector2(0.16, 0.16);
  }
  mat.userData.sss = {
    uSssColor: { value: new THREE.Color(color).lerp(new THREE.Color(0xffd9b0), 0.5) },
    uSssDir: { value: lightDirView },
    uSssStrength: { value: 1.35 },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.sss);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float aThin;\nvarying float vThin;\nvarying vec3 vSssView;',
      )
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvThin = aThin;\nvSssView = -mvPosition.xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float vThin;\nvarying vec3 vSssView;\nuniform vec3 uSssColor;\nuniform vec3 uSssDir;\nuniform float uSssStrength;',
      )
      .replace(
        '#include <opaque_fragment>',
        [
          'float sssBack = pow( clamp( dot( normalize( vSssView ), normalize( uSssDir ) ), 0.0, 1.0 ), 2.5 );',
          'outgoingLight += uSssColor * sssBack * vThin * uSssStrength * diffuseColor.rgb;',
          '#include <opaque_fragment>',
        ].join('\n'),
      );
  };
  mat.customProgramCacheKey = () => 'cream-sss-v1';
  creamMaterials.push(mat);
  return mat;
}

/** Called once per frame with the key light's travel direction in view space. */
export function updateCreamLighting(dirView: THREE.Vector3) {
  lightDirView.copy(dirView);
}

export function creamMaterialCount() {
  return creamMaterials.length;
}

export class MaterialLibrary {
  readonly creamStreak = creamStreakNormal();
  readonly steelNormal = steelScratchNormal();
  readonly steelRough = steelRoughness();
  readonly parchment = parchmentMap();
  readonly sponge = spongeMap();
  readonly wood = woodMap();
  readonly wall = wallMap();

  readonly steel: THREE.MeshStandardMaterial;
  readonly steelDark: THREE.MeshStandardMaterial;
  readonly parchmentMat: THREE.MeshStandardMaterial;
  readonly spongeMat: THREE.MeshStandardMaterial;
  readonly woodMat: THREE.MeshPhysicalMaterial;
  readonly wallMat: THREE.MeshStandardMaterial;
  readonly bagMat: THREE.MeshPhysicalMaterial;
  readonly skinMat: THREE.MeshPhysicalMaterial;

  constructor() {
    this.steelNormal.repeat.set(5, 5);
    this.steelRough.repeat.set(5, 5);
    this.steel = new THREE.MeshStandardMaterial({
      color: 0xd8dade,
      metalness: Config.fast ? 0.45 : 1.0,
      roughness: Config.fast ? 0.3 : 0.19,
      normalMap: this.steelNormal,
      normalScale: new THREE.Vector2(0.14, 0.14),
      roughnessMap: this.steelRough,
      envMapIntensity: 1.2,
    });
    this.steelDark = this.steel.clone();
    this.steelDark.color = new THREE.Color(0x8d939a);
    this.steelDark.roughness = Config.fast ? 0.4 : 0.34;
    this.steelDark.normalScale = new THREE.Vector2(0.1, 0.1);

    this.parchmentMat = new THREE.MeshStandardMaterial({
      map: this.parchment.color,
      roughnessMap: this.parchment.rough,
      roughness: 0.92,
      metalness: 0,
      side: THREE.DoubleSide,
    });

    this.spongeMat = new THREE.MeshStandardMaterial({
      map: this.sponge.color,
      roughnessMap: this.sponge.rough,
      normalMap: this.sponge.normal,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughness: 0.95,
      metalness: 0,
    });
    this.sponge.color.repeat.set(3, 1);
    this.sponge.rough.repeat.set(3, 1);
    this.sponge.normal.repeat.set(3, 1);

    this.wood.color.repeat.set(7, 4);
    this.wood.rough.repeat.set(7, 4);
    this.wood.normal.repeat.set(7, 4);
    this.woodMat = new THREE.MeshPhysicalMaterial({
      map: this.wood.color,
      roughnessMap: this.wood.rough,
      normalMap: this.wood.normal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.86,
      metalness: 0,
      color: 0x9d8b74,
      // an oiled bench is not a mirror at grazing angles
      specularIntensity: 0.22,
      envMapIntensity: 0.22,
    });

    this.wall.repeat.set(3, 2);
    this.wallMat = new THREE.MeshStandardMaterial({
      map: this.wall,
      color: 0x5d554b,
      roughness: 0.98,
      metalness: 0,
      envMapIntensity: 0.25,
    });

    this.bagMat = new THREE.MeshPhysicalMaterial({
      color: 0xf2f4f6,
      roughness: 0.55,
      metalness: 0,
      clearcoat: 0.35,
      clearcoatRoughness: 0.6,
      sheen: 0.3,
      sheenColor: new THREE.Color(0xffffff),
      transmission: 0,
      side: THREE.DoubleSide,
    });

    this.skinMat = new THREE.MeshPhysicalMaterial({
      color: 0xcf9d80,
      roughness: 0.74,
      metalness: 0,
      clearcoat: 0.08,
      clearcoatRoughness: 0.85,
      sheen: 0.3,
      sheenColor: new THREE.Color(0xe8b79c),
    });
  }
}
