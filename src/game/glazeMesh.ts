import * as THREE from 'three';
import { GlazeField, GLAZE_UNIT } from './glazeField';
import { CAKE_R, MERIDIAN_ARC, makeDomeGeometry } from './profile';

/**
 * The glaze is a thin shell that lives just outside the cake surface. The
 * coverage field drives both the silhouette (discard where nothing has been
 * poured) and the shading (a rounded, thick bead along the leading edge).
 */
export function makeShellMaterial(field: GlazeField): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.04,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    envMapIntensity: 2.1,
    side: THREE.FrontSide,
  });

  const uniforms = {
    uField: { value: field.texture },
    uTexel: { value: new THREE.Vector2(1 / field.width, 1 / field.height) },
    uScale: { value: field.storageScale },
    uThick: { value: GLAZE_UNIT },
    uBase: { value: 0.00016 },
    uCut: { value: 0.075 },
    uArc: { value: MERIDIAN_ARC },
    uSat: { value: 1.09 },
  };

  mat.userData.uniforms = uniforms;
  mat.customProgramCacheKey = () => 'glazeShell';

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform sampler2D uField;
        uniform float uScale;
        uniform float uThick;
        uniform float uBase;
        varying vec2 vFieldUv;
        varying vec3 vTanU;
        varying vec3 vTanV;
        varying float vRad;
      `
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        #include <begin_vertex>
        vFieldUv = uv;
        vec4 fld = texture2D(uField, vec2(uv.x, clamp(uv.y, 0.0, 1.0))) / uScale;
        transformed += normal * (uBase + fld.a * uThick);

        float ang = uv.x * 6.2831853;
        vec3 tu = vec3(-sin(ang), 0.0, cos(ang));
        float nr = length(vec2(normal.x, normal.z));
        vec3 rad = nr > 1e-4 ? vec3(normal.x, 0.0, normal.z) / nr : vec3(cos(ang), 0.0, sin(ang));
        vec3 tv = vec3(rad.x * normal.y, -nr, rad.z * normal.y);
        vTanU = normalize(normalMatrix * tu);
        vTanV = normalize(normalMatrix * tv);
        vRad = max(nr > 1e-4 ? length(vec2(position.x, position.z)) : 0.0, 0.0);
      `
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform sampler2D uField;
        uniform vec2 uTexel;
        uniform float uScale;
        uniform float uThick;
        uniform float uCut;
        uniform float uArc;
        uniform float uSat;
        varying vec2 vFieldUv;
        varying vec3 vTanU;
        varying vec3 vTanV;
        varying float vRad;

        vec4 fld(vec2 uv) {
          return texture2D(uField, vec2(fract(uv.x), clamp(uv.y, 0.0, 1.0))) / uScale;
        }
      `
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `
        vec4 gz = fld(vFieldUv);
        if (gz.a < uCut) discard;
        vec3 gcol = gz.rgb / max(gz.a, 1e-4);
        float gl = dot(gcol, vec3(0.2126, 0.7152, 0.0722));
        gcol = clamp(gl + (gcol - gl) * uSat, 0.0, 1.0);
        diffuseColor.rgb *= gcol;
      `
      )
      .replace(
        '#include <normal_fragment_begin>',
        /* glsl */ `
        #include <normal_fragment_begin>
        {
          float hL = fld(vFieldUv - vec2(uTexel.x, 0.0)).a;
          float hR = fld(vFieldUv + vec2(uTexel.x, 0.0)).a;
          float hU = fld(vFieldUv - vec2(0.0, uTexel.y)).a;
          float hD = fld(vFieldUv + vec2(0.0, uTexel.y)).a;
          float dsU = max(6.2831853 * vRad * uTexel.x, 0.0008);
          float dsV = uArc * uTexel.y;
          float gU = clamp((hR - hL) * uThick * 0.5 / dsU, -2.0, 2.0);
          float gV = clamp((hD - hU) * uThick * 0.5 / dsV, -2.0, 2.0);
          normal = normalize(normal - vTanU * gU - vTanV * gV);
        }
      `
      );
  };

  return mat;
}

export function makeShellMesh(field: GlazeField, low: boolean) {
  const geo = makeDomeGeometry({
    radialSegments: low ? 96 : 160,
    heightSegments: low ? 64 : 96,
    offset: 0,
  });
  const mesh = new THREE.Mesh(geo, makeShellMaterial(field));
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  return mesh;
}

/** Glossy glaze look for the pouring stream, the drips and the puddle. */
export function makeLiquidMaterial(color: THREE.ColorRepresentation, opts: {
  clearcoat?: number;
} = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.05,
    metalness: 0.0,
    clearcoat: opts.clearcoat ?? 1.0,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.9,
  });
}

export const CAKE_RADIUS = CAKE_R;
