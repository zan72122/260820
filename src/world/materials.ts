import * as THREE from 'three';
import type { QualityProfile } from '../core/Quality';
import type { UmeMaps, PbrMaps } from './textures';

/** Shared GLSL: cheap 3D value noise for wrinkles and surface break-up. */
const NOISE_GLSL = /* glsl */ `
float uh31(vec3 p){
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float uNoise3(vec3 x){
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(uh31(i + vec3(0,0,0)), uh31(i + vec3(1,0,0)), f.x),
        mix(uh31(i + vec3(0,1,0)), uh31(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(uh31(i + vec3(0,0,1)), uh31(i + vec3(1,0,1)), f.x),
        mix(uh31(i + vec3(0,1,1)), uh31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
`;

export interface UmeUniforms {
  uWet: { value: number };
  /** Dryness of the fruit's +Y face and -Y face, in object space. */
  uDryA: { value: number };
  uDryB: { value: number };
  uBrineLine: { value: number };
  uBloom: { value: number };
}

export interface HeroMaterial<T> extends THREE.Material {
  userData: { uniforms: T };
}

export type UmeMaterial = THREE.MeshPhysicalMaterial & { userData: { uniforms: UmeUniforms } };

/**
 * Hero material 1 -- ripe ume skin.
 *
 * Three states live in one shader so a fruit can travel the whole game
 * without swapping materials: powdery-fresh, salt-wet, and sun-dried
 * (which physically shrinks the silhouette and creases the skin).
 */
export function createUmeMaterial(maps: UmeMaps, q: QualityProfile): UmeMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    map: maps.map,
    roughnessMap: maps.roughnessMap,
    normalMap: maps.normalMap,
    normalScale: new THREE.Vector2(0.42, 0.42),
    roughness: 1,
    metalness: 0,
    // The coat is patchy: bloomy areas are chalk-dull, bare skin is wet-shiny.
    clearcoat: q.tier === 'low' ? 0.18 : 0.38,
    clearcoatRoughness: 0.5,
    clearcoatRoughnessMap: maps.roughnessMap,
    sheen: q.tier === 'low' ? 0 : 0.45,
    sheenColor: new THREE.Color(0xf6e6bc),
    sheenRoughness: 0.85,
    envMapIntensity: 0.55,
  }) as UmeMaterial;

  const uniforms: UmeUniforms = {
    uWet: { value: 0 },
    uDryA: { value: 0 },
    uDryB: { value: 0 },
    uBrineLine: { value: -10 },
    uBloom: { value: 1 },
  };
  mat.userData.uniforms = uniforms;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWet = uniforms.uWet;
    shader.uniforms.uDryA = uniforms.uDryA;
    shader.uniforms.uDryB = uniforms.uDryB;
    shader.uniforms.uBrineLine = uniforms.uBrineLine;
    shader.uniforms.uBloom = uniforms.uBloom;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uDryA;
         uniform float uDryB;
         varying vec3 vObj;
         varying vec3 vWorldPos;
         ${NOISE_GLSL}`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vObj = position;
         // Sun-drying shrinks the fruit and pulls creases into the skin.
         // Each face shrinks by its own exposure, so an unturned fruit is
         // visibly plump on the side that never saw the sun.
         float sideV = smoothstep(-0.3, 0.3, normalize(position).y);
         float dryV = mix(uDryB, uDryA, sideV);
         // Proportional, never absolute: the fruit geometry is authored at
         // world scale (a few centimetres), so a fixed offset would turn it
         // inside out. Shrinking as a fraction of the local radius keeps the
         // creases readable at any size.
         // Direction-based, so the wrinkle scale is the same on a big fruit
         // and a small one: broad folds first, a finer crease on top.
         vec3 nd = normalize(position);
         float wr = uNoise3(nd * 3.2 + 11.0) * 0.62 + uNoise3(nd * 8.5 + 4.0) * 0.38;
         float crease = (wr - 0.5) * 2.0;
         transformed *= (1.0 - dryV * (0.09 + crease * 0.095));`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uWet;
         uniform float uDryA;
         uniform float uDryB;
         uniform float uBrineLine;
         uniform float uBloom;
         varying vec3 vObj;
         varying vec3 vWorldPos;
         ${NOISE_GLSL}`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         // Juice pools at the bottom of each fruit first, so wetness climbs.
         float wetGrad = smoothstep(0.35, -0.75, vObj.y / max(0.0001, length(vObj)));
         float submerged = smoothstep(0.0, 0.06, uBrineLine - vWorldPos.y);
         float wet = clamp(uWet * (0.45 + wetGrad * 0.75) + submerged * 0.8, 0.0, 1.0);
         // Wet skin goes darker and deeper; bloom washes back out as it dissolves.
         diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.70, 0.55), wet * 0.85);
         diffuseColor.rgb = mix(diffuseColor.rgb * vec3(0.94, 0.95, 0.92), diffuseColor.rgb, uBloom);
         // Sun-dried fruit turns amber and loses its green -- but only on the
         // face that was actually turned up to the sky.
         float sideF = smoothstep(-0.3, 0.3, normalize(vObj).y);
         float dry = mix(uDryB, uDryA, sideF);
         vec3 dried = mix(diffuseColor.rgb, vec3(0.33, 0.14, 0.055), 0.9);
         vec3 ndF = normalize(vObj);
         // The creases catch shadow the way a real shrivelled skin does.
         float shade = uNoise3(ndF * 3.2 + 11.0) * 0.6 + uNoise3(ndF * 8.5 + 4.0) * 0.4;
         dried *= 0.58 + shade * 0.85;
         diffuseColor.rgb = mix(diffuseColor.rgb, dried, dry);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         float wetGrad2 = smoothstep(0.35, -0.75, vObj.y / max(0.0001, length(vObj)));
         float submerged2 = smoothstep(0.0, 0.06, uBrineLine - vWorldPos.y);
         float wet2 = clamp(uWet * (0.45 + wetGrad2 * 0.75) + submerged2 * 0.8, 0.0, 1.0);
         float sideR = smoothstep(-0.3, 0.3, normalize(vObj).y);
         float dryR = mix(uDryB, uDryA, sideR);
         roughnessFactor = mix(roughnessFactor, 0.075, wet2 * 0.92);
         roughnessFactor = mix(roughnessFactor, 0.9, dryR * 0.92);`,
      );
  };
  return mat;
}

export type SaltMaterial = THREE.MeshPhysicalMaterial;

/**
 * Hero material 2 -- coarse salt.
 *
 * Angular faceted geometry plus a wrap-light term: light that enters one
 * facet and leaves another, which is what makes rock salt read as translucent
 * rather than as white plastic beads.
 */
export function createSaltMaterial(q: QualityProfile): SaltMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xfdfaf1),
    roughness: 0.28,
    metalness: 0,
    flatShading: true,
    transparent: true,
    opacity: 0.94,
    depthWrite: true,
    alphaTest: 0.2,
    clearcoat: q.tier === 'low' ? 0 : 0.6,
    clearcoatRoughness: 0.22,
    ior: 1.54,
    specularIntensity: 1,
    envMapIntensity: 1.15,
  });
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
       // Cheap translucency: back-lit facets glow instead of going black.
       #if NUM_DIR_LIGHTS > 0
       vec3 wrapDir = normalize(directionalLights[0].direction);
       float wrap = pow(clamp(dot(normalize(-geometryViewDir), -wrapDir), 0.0, 1.0), 2.0);
       float edge = 1.0 - abs(dot(normalize(geometryNormal), normalize(geometryViewDir)));
       reflectedLight.indirectDiffuse += directionalLights[0].color *
         (wrap * 0.55 + pow(edge, 2.5) * 0.35) * diffuseColor.rgb;
       #endif`,
    );
  };
  return mat;
}

export interface BrineUniforms {
  uTime: { value: number };
  uLevel: { value: number };
  uBottom: { value: number };
  uTint: { value: THREE.Color };
  uOpacity: { value: number };
  uLightDir: { value: THREE.Vector3 };
}

/**
 * Hero material 3 -- ume vinegar (梅酢).
 *
 * Hand-written rather than physical transmission: a real transmission pass
 * costs a second scene render, which a phone cannot spare. Instead the body
 * tints by depth, the rim picks up a fresnel edge, and the surface carries a
 * moving specular so the liquid is unmistakably liquid.
 */
export function createBrineBodyMaterial(): THREE.ShaderMaterial & {
  userData: { uniforms: BrineUniforms };
} {
  const uniforms: BrineUniforms = {
    uTime: { value: 0 },
    uLevel: { value: 0 },
    uBottom: { value: 0 },
    uTint: { value: new THREE.Color(0xc98a2e) },
    uOpacity: { value: 0.62 },
    uLightDir: { value: new THREE.Vector3(0.4, 1, 0.5).normalize() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uLevel;
      uniform float uBottom;
      uniform vec3 uTint;
      uniform float uOpacity;
      uniform vec3 uLightDir;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      ${NOISE_GLSL}
      void main(){
        float depth = clamp((uLevel - vWorld.y) / max(0.0001, uLevel - uBottom), 0.0, 1.0);
        // Deeper juice is denser and darker: gives the column real volume.
        vec3 col = mix(uTint * 1.28, uTint * 0.42, pow(depth, 0.8));
        float fres = pow(1.0 - abs(dot(normalize(vNormalW), normalize(vViewDir))), 2.6);
        col += vec3(1.0, 0.92, 0.7) * fres * 0.42;
        // Slow internal swirl so it is never a flat pane of colour.
        float swirl = uNoise3(vec3(vWorld.xz * 22.0, uTime * 0.25));
        col *= 0.9 + swirl * 0.22;
        float a = clamp(uOpacity * (0.42 + depth * 0.75) + fres * 0.3, 0.0, 0.97);
        // Light passing through the column brightens the far side.
        float through = pow(clamp(dot(normalize(vNormalW), -uLightDir), 0.0, 1.0), 2.0);
        col += uTint * through * 0.3;
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
  }) as THREE.ShaderMaterial & { userData: { uniforms: BrineUniforms } };
  mat.userData.uniforms = uniforms;
  return mat;
}

/** The meniscus: a bright, slowly moving disc that reads as a real surface. */
export function createBrineSurfaceMaterial(): THREE.ShaderMaterial & {
  userData: { uniforms: BrineUniforms };
} {
  const uniforms: BrineUniforms = {
    uTime: { value: 0 },
    uLevel: { value: 0 },
    uBottom: { value: 0 },
    uTint: { value: new THREE.Color(0xd9a03c) },
    uOpacity: { value: 0.9 },
    uLightDir: { value: new THREE.Vector3(0.4, 1, 0.5).normalize() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUvL;
      varying vec3 vWorld;
      varying vec3 vViewDir;
      void main(){
        vUvL = uv;
        vec3 p = position;
        // Gentle standing ripple: the jar is still, but the juice is not.
        float r = length(p.xz);
        p.y += sin(r * 30.0 - uTime * 1.6) * 0.0016 + sin(p.x * 22.0 + uTime * 0.9) * 0.0012;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        vViewDir = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uTint;
      uniform float uOpacity;
      uniform vec3 uLightDir;
      varying vec2 vUvL;
      varying vec3 vWorld;
      varying vec3 vViewDir;
      ${NOISE_GLSL}
      void main(){
        vec2 c = vUvL * 2.0 - 1.0;
        float r = length(c);
        // Meniscus: the liquid climbs the glass at the very edge.
        float edge = smoothstep(0.86, 1.0, r);
        float ripple = uNoise3(vec3(vWorld.xz * 30.0, uTime * 0.4));
        vec3 n = normalize(vec3((ripple - 0.5) * 0.35, 1.0, (uNoise3(vec3(vWorld.zx * 30.0, uTime * 0.35)) - 0.5) * 0.35));
        float spec = pow(clamp(dot(reflect(-normalize(vViewDir), n), uLightDir), 0.0, 1.0), 48.0);
        float fres = pow(1.0 - clamp(dot(n, normalize(vViewDir)), 0.0, 1.0), 3.0);
        vec3 col = uTint * (0.72 + ripple * 0.3);
        col += vec3(1.0, 0.96, 0.84) * spec * 1.4;
        col += vec3(1.0, 0.9, 0.72) * fres * 0.5;
        col = mix(col, col * 1.35, edge);
        float a = clamp(uOpacity * (0.68 + fres * 0.5) + edge * 0.25, 0.0, 1.0);
        a *= smoothstep(1.02, 0.985, r);
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
  }) as THREE.ShaderMaterial & { userData: { uniforms: BrineUniforms } };
  mat.userData.uniforms = uniforms;
  return mat;
}

/**
 * Hero material 4 -- the blue harvest net.
 *
 * Alpha-tested, never alpha-blended: the weave has genuine holes you can see
 * the ground through, and it stays entirely out of the transparent sort queue.
 */
export function createNetMaterial(
  maps: { map: THREE.Texture; alphaMap: THREE.Texture },
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    map: maps.map,
    alphaMap: maps.alphaMap,
    alphaTest: 0.45,
    transparent: false,
    side: THREE.DoubleSide,
    roughness: 0.72,
    metalness: 0,
    envMapIntensity: 0.55,
  });
  // Roughly 5 cm holes across a 2 m net: coarse enough that the alpha test
  // never aliases into moire at play distance.
  mat.map!.repeat.set(5, 5);
  mat.alphaMap!.repeat.set(5, 5);
  return mat;
}

/** Thick jar glass. Split into back/front passes by the caller. */
export function createGlassMaterial(
  wear: THREE.Texture,
  side: THREE.Side,
  q: QualityProfile,
): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xe6f1ec),
    roughness: 0.05,
    metalness: 0,
    transparent: true,
    opacity: side === THREE.BackSide ? 0.12 : 0.16,
    depthWrite: false,
    side,
    roughnessMap: wear,
    clearcoat: q.tier === 'low' ? 0 : 1,
    clearcoatRoughness: 0.04,
    ior: 1.5,
    envMapIntensity: 1.6,
    specularIntensity: 1,
  });
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
       // Glass is nearly invisible face-on and near-opaque at glancing angles.
       // Without this the jar reads as a faint outline instead of a vessel.
       float glassFres = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.6);
       diffuseColor.a = clamp(diffuseColor.a + glassFres * 0.85, 0.0, 1.0);
       diffuseColor.rgb += vec3(0.55, 0.62, 0.58) * glassFres * 0.6;`,
    );
  };
  return mat;
}

/** Opaque parts of the jar: the rolled rim and the thick base. */
export function createGlassSolidMaterial(q: QualityProfile): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xdfeae4),
    roughness: 0.1,
    metalness: 0,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: THREE.FrontSide,
    clearcoat: q.tier === 'low' ? 0 : 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.3,
  });
}

/** Warm cedar for bench, scoop and tray. */
export function createWoodMaterial(maps: PbrMaps, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: maps.map,
    roughnessMap: maps.roughnessMap,
    normalMap: maps.normalMap,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0.6,
    ...extra,
  });
}

/** Thin bright streak used where juice runs down the inside of the glass. */
export function createRunnelMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xe8b45c),
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  });
}
