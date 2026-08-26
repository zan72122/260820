import * as THREE from 'three';
import { bambooMaps, barkMaps, leafTexture, mossAlpha, mossMaps, soilMaps, stoneMaps, woodMaps } from './textures';
import { caps } from './caps';

export interface GardenMaterials {
  bambooA: THREE.MeshStandardMaterial;
  bambooB: THREE.MeshStandardMaterial;
  bambooPole: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  stoneDamp: THREE.MeshStandardMaterial;
  impactStone: THREE.MeshStandardMaterial;
  soil: THREE.MeshStandardMaterial;
  path: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  woodPale: THREE.MeshStandardMaterial;
  woodFresh: THREE.MeshStandardMaterial;
  moss: THREE.MeshStandardMaterial;
  bark: THREE.MeshStandardMaterial;
  leaf: THREE.Material;
}

/** 前景の薄い葉に透過光を出す（発光縁は作らない） */
function leafMaterial(): THREE.Material {
  const { map, alpha } = leafTexture(2201);
  if (!caps.rawShaders) {
    // WebGPU 経路では標準材質で近似する（透過光の項は落ちる）
    return new THREE.MeshStandardMaterial({
      map,
      alphaMap: alpha,
      alphaTest: 0.35,
      transparent: true,
      side: THREE.DoubleSide,
      roughness: 0.85,
      metalness: 0,
    });
  }
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uAlpha: { value: alpha },
      uLightDir: { value: new THREE.Vector3(-0.4, 0.7, 0.6).normalize() },
      uLightColor: { value: new THREE.Color(0xffeedd) },
      uAmbient: { value: new THREE.Color(0x8d9a88) },
      uTranslucency: { value: 0.85 },
      uFogColor: { value: new THREE.Color(0xb9c2bd) },
      uFogDensity: { value: 0.098 },
    },
    transparent: true,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv; varying vec3 vN; varying vec3 vView; varying float vDepth;
      void main() {
        vUv = uv;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = -mv.xyz; vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform sampler2D uAlpha;
      uniform vec3 uLightDir; uniform vec3 uLightColor; uniform vec3 uAmbient;
      uniform float uTranslucency; uniform vec3 uFogColor; uniform float uFogDensity;
      varying vec2 vUv; varying vec3 vN; varying vec3 vView; varying float vDepth;
      void main() {
        float a = texture2D(uAlpha, vUv).r;
        if (a < 0.35) discard;
        vec3 base = texture2D(uMap, vUv).rgb;
        vec3 n = normalize(vN);
        vec3 l = normalize((viewMatrix * vec4(uLightDir, 0.0)).xyz);
        float front = max(dot(n, l), 0.0);
        float back = max(dot(-n, l), 0.0);
        float through = pow(back, 1.6) * uTranslucency;
        vec3 col = base * (uAmbient + uLightColor * (front * 0.8 + through));
        float f = 1.0 - exp(-pow(vDepth * uFogDensity, 2.0));
        col = mix(col, uFogColor, clamp(f, 0.0, 1.0));
        gl_FragColor = vec4(col, a);
      }`,
  });
}

/** 太陽の向きと霧を葉材質へ伝える（材質の実体が二通りあるため一箇所に集約） */
export function setLeafLighting(mat: THREE.Material, dir: THREE.Vector3, fog: number): void {
  const sm = mat as THREE.ShaderMaterial;
  if (!sm.uniforms) return;
  sm.uniforms.uLightDir.value.copy(dir).normalize();
  sm.uniforms.uFogColor.value.setHex(fog);
}

export function buildMaterials(): GardenMaterials {
  const bambooTexA = bambooMaps(11, [0.09, 0.3, 0.52, 0.74, 0.93], 0.485);
  const bambooTexB = bambooMaps(29, [0.12, 0.36, 0.6, 0.84], 0.5);
  const poleTex = bambooMaps(47, [0.14, 0.38, 0.62, 0.86], -1);
  const stoneTex = stoneMaps(101, 0.25);
  const stoneWetTex = stoneMaps(137, 0.75);
  const impactTex = stoneMaps(163, 0.55);
  const soilTex = soilMaps(211);
  const pathTex = soilMaps(233);
  const woodTex = woodMaps(307, 1.3);
  const woodPaleTex = woodMaps(331, 1.25);
  const woodFreshTex = woodMaps(367, 1.6);
  const mossTex = mossMaps(401);
  const barkTex = barkMaps(503);

  const std = (
    m: { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture },
    o: Partial<THREE.MeshStandardMaterialParameters> = {},
  ): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({
      map: m.map,
      normalMap: m.normalMap,
      roughnessMap: m.roughnessMap,
      roughness: 1,
      metalness: 0,
      ...o,
    });

  const moss = std(mossTex, { alphaMap: mossAlpha(409), transparent: true, alphaTest: 0.55, depthWrite: true });
  moss.polygonOffset = true;
  moss.polygonOffsetFactor = -1;

  return {
    bambooA: std(bambooTexA, { normalScale: new THREE.Vector2(0.65, 0.65) }),
    bambooB: std(bambooTexB, { normalScale: new THREE.Vector2(0.65, 0.65) }),
    bambooPole: std(poleTex, { normalScale: new THREE.Vector2(0.5, 0.5) }),
    stone: std(stoneTex),
    stoneDamp: std(stoneWetTex),
    impactStone: std(impactTex),
    soil: std(soilTex, { envMapIntensity: 0.35 }),
    path: std(pathTex, { color: new THREE.Color(0xb8ad9a), envMapIntensity: 0.3 }),
    wood: std(woodTex),
    woodPale: std(woodPaleTex),
    woodFresh: std(woodFreshTex, { color: new THREE.Color(0xe6d9b6) }),
    moss,
    bark: std(barkTex),
    leaf: leafMaterial(),
  };
}
