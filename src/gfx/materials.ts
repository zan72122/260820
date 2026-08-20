import * as THREE from 'three';
import type { TextureSet } from './textures';

/** Thin-blade back-lighting without paying for a transmission pass. */
function addTranslucency(mat: THREE.MeshStandardMaterial, amount: number, key: string) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTrans = { value: amount };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTrans;')
      .replace(
        '#include <lights_fragment_end>',
        /* glsl */ `
        #include <lights_fragment_end>
        #if NUM_DIR_LIGHTS > 0
          vec3 tL = normalize( directionalLights[ 0 ].direction );
          vec3 tV = normalize( vViewPosition );
          float back = pow( clamp( dot( tV, -tL ), 0.0, 1.0 ), 2.2 );
          float thin = 1.0 - abs( dot( normalize( normal ), tV ) ) * 0.45;
          reflectedLight.indirectDiffuse += diffuseColor.rgb * directionalLights[ 0 ].color * back * thin * uTrans;
        #endif
        `,
      );
  };
  mat.customProgramCacheKey = () => key;
}

export function makeWood(t: TextureSet, repeat = 1) {
  const map = t.woodColor.clone();
  const nrm = t.woodNormal.clone();
  const orm = t.woodORM.clone();
  for (const x of [map, nrm, orm]) {
    x.repeat.set(repeat, repeat);
    x.needsUpdate = true;
  }
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map,
    normalMap: nrm,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: orm,
    aoMap: orm,
    aoMapIntensity: 0.8,
    metalness: 0,
    roughness: 1,
    color: 0xd8c9b4,
  });
}

/** Bare galvanised steel: real metalness, scratched microsurface. */
export function makeBareMetal(t: TextureSet, tint = 0xb9bcbe, repeat = 2) {
  const nrm = t.metalNormal.clone();
  const orm = t.metalORM.clone();
  for (const x of [nrm, orm]) {
    x.repeat.set(repeat, repeat);
    x.needsUpdate = true;
  }
  return new THREE.MeshStandardMaterial({
    color: tint,
    metalness: 1,
    roughness: 1,
    roughnessMap: orm,
    metalnessMap: orm,
    normalMap: nrm,
    normalScale: new THREE.Vector2(0.7, 0.7),
    aoMap: orm,
    aoMapIntensity: 0.6,
    envMapIntensity: 1.0,
  });
}

/**
 * Painted metal. The enamel is a dielectric with a clearcoat; only the
 * chipped areas expose bare metal, driven by the metalness mask.
 */
export function makePaintedMetal(t: TextureSet, repeat = 2) {
  const map = t.paintColor.clone();
  const orm = t.paintORM.clone();
  const nrm = t.metalNormal.clone();
  for (const x of [map, orm, nrm]) {
    x.repeat.set(repeat, repeat);
    x.needsUpdate = true;
  }
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshPhysicalMaterial({
    map,
    roughnessMap: orm,
    metalnessMap: orm,
    aoMap: orm,
    aoMapIntensity: 0.7,
    normalMap: nrm,
    normalScale: new THREE.Vector2(0.45, 0.45),
    metalness: 1,
    roughness: 1,
    clearcoat: 0.75,
    clearcoatRoughness: 0.22,
    envMapIntensity: 1.0,
  });
}

export function makeRubber() {
  return new THREE.MeshStandardMaterial({
    color: 0x24262a,
    roughness: 0.92,
    metalness: 0,
    envMapIntensity: 0.5,
  });
}

export function makeRock(t: TextureSet) {
  const nrm = t.sandNormal.clone();
  nrm.repeat.set(3, 3);
  nrm.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    color: 0x545049,
    roughness: 0.74,
    metalness: 0,
    normalMap: nrm,
    normalScale: new THREE.Vector2(1.4, 1.4),
    envMapIntensity: 0.85,
  });
}

export function makeConcrete(t: TextureSet, repeat = 8) {
  const map = t.concreteColor.clone();
  const orm = t.concreteORM.clone();
  for (const x of [map, orm]) {
    x.repeat.set(repeat, repeat);
    x.needsUpdate = true;
  }
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map,
    roughnessMap: orm,
    aoMap: orm,
    aoMapIntensity: 0.6,
    roughness: 1,
    metalness: 0,
    color: 0xa9a49c,
  });
}

export function makeLeaf(t: TextureSet) {
  const m = new THREE.MeshStandardMaterial({
    map: t.leafColor,
    normalMap: t.leafNormal,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.55,
    metalness: 0,
    side: THREE.DoubleSide,
    envMapIntensity: 0.9,
  });
  addTranslucency(m, 0.85, 'leaf-translucent-v1');
  return m;
}

export function makeFoliage(color = 0x4f6b33) {
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: 0,
    side: THREE.DoubleSide,
    envMapIntensity: 0.8,
  });
  addTranslucency(m, 0.6, 'foliage-translucent-v1');
  return m;
}

/** Standing rainwater on the paving: a mirror-flat dielectric puddle. */
export function makePuddle() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x2a2b28,
    roughness: 0.045,
    metalness: 0,
    ior: 1.333,
    transparent: true,
    opacity: 0.88,
    envMapIntensity: 1.2,
    depthWrite: false,
  });
}
