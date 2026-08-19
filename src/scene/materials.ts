import * as THREE from 'three';
import { DIM } from '../core/tuning';

/** Uniforms shared by every surface that reads the paint mask. */
export interface MeringueUniforms {
  uMask: THREE.IUniform<THREE.Texture | null>;
  uTint: THREE.IUniform<THREE.Color>;
  uSwell: THREE.IUniform<number>;
  uRidgeAmp: THREE.IUniform<number>;
  uSSS: THREE.IUniform<number>;
  uTexel: THREE.IUniform<number>;
  uSlope: THREE.IUniform<number>;
}

export function createMeringueUniforms(maskSize: number): MeringueUniforms {
  const base = 1 / (2 * (1 / maskSize) * 2 * Math.PI * DIM.meringueRadius);
  return {
    uMask: { value: null },
    uTint: { value: new THREE.Color(0xf7f2e8) },
    uSwell: { value: DIM.meringueSwell },
    uRidgeAmp: { value: 0.035 },
    uSSS: { value: 0.3 },
    uTexel: { value: 1 / maskSize },
    uSlope: { value: base * 0.85 },
  };
}

/** white -> cream -> gold -> amber, capped at a deliberately beautiful amber. */
const RAMP_GLSL = /* glsl */ `
vec3 baBakeRamp( vec3 tint, float b ) {
  vec3 raw   = tint;
  vec3 cream = mix( tint, vec3( 0.949, 0.898, 0.760 ), 0.92 );
  vec3 gold  = vec3( 0.862, 0.641, 0.318 );
  vec3 amber = vec3( 0.545, 0.318, 0.130 );
  vec3 c = mix( raw,  cream, smoothstep( 0.02, 0.30, b ) );
  c      = mix( c,    gold,  smoothstep( 0.26, 0.66, b ) );
  c      = mix( c,    amber, smoothstep( 0.60, 1.00, b ) );
  return c;
}
float baHash( vec2 p ) {
  return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453123 );
}
`;

interface Patch {
  vertexHeader?: string;
  fragmentHeader?: string;
  vertex?: Array<[string, string]>;
  fragment?: Array<[string, string]>;
  uniforms?: Record<string, THREE.IUniform>;
  key: string;
}

function patch<T extends THREE.Material>(mat: T, p: Patch): T {
  mat.onBeforeCompile = (shader) => {
    if (p.uniforms) Object.assign(shader.uniforms, p.uniforms);
    if (p.vertexHeader) shader.vertexShader = p.vertexHeader + '\n' + shader.vertexShader;
    if (p.fragmentHeader) shader.fragmentShader = p.fragmentHeader + '\n' + shader.fragmentShader;
    for (const [find, replace] of p.vertex ?? []) {
      if (!shader.vertexShader.includes(find)) {
        console.warn('[materials] missing vertex hook', find);
        continue;
      }
      shader.vertexShader = shader.vertexShader.replace(find, replace);
    }
    for (const [find, replace] of p.fragment ?? []) {
      if (!shader.fragmentShader.includes(find)) {
        console.warn('[materials] missing fragment hook', find);
        continue;
      }
      shader.fragmentShader = shader.fragmentShader.replace(find, replace);
    }
  };
  mat.customProgramCacheKey = () => p.key;
  return mat;
}

/* --------------------------------------------------------------------- *
 * Meringue shell: coverage reveals it, coverage + ridge phase swell it,
 * and the browning channel drives colour, roughness and the loss of the
 * soft subsurface glow.
 * --------------------------------------------------------------------- */
export function createShellMaterial(u: MeringueUniforms): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.5,
    metalness: 0,
    side: THREE.FrontSide,
  });

  return patch(mat, {
    key: 'ba-shell',
    uniforms: { ...u },
    vertexHeader: /* glsl */ `
      uniform sampler2D uMask;
      uniform float uSwell;
      uniform float uRidgeAmp;
      varying vec2 vMUv;
      varying float vCov;
      varying float vRaw;
      varying float vHgt;
      varying float vCosT;
      varying vec3 vDomeN;
      varying vec3 vDomeT;
      varying vec3 vDomeB;
    `,
    vertex: [
      [
        '#include <begin_vertex>',
        /* glsl */ `
        vMUv = uv;
        vec4 baMask = texture2D( uMask, uv );
        float baCov = clamp( baMask.r, 0.0, 1.0 );
        float baRdg = clamp( baMask.b, 0.0, 1.0 );
        vCov = baCov;
        vRaw = clamp( baMask.g, 0.0, 1.0 );
        float baSwell = baCov * uSwell + baRdg * uRidgeAmp;
        vHgt = baSwell;
        // Analytic tangent frame of the dome, handed to the fragment stage in
        // view space so the ridge slopes can bend the normal per pixel.
        vec3 baN = normalize( position );
        vec3 baT = normalize( vec3( -baN.z, 0.0, baN.x ) + vec3( 1e-5 ) );
        vec3 baB = normalize( cross( baN, baT ) );
        vCosT = max( length( baN.xz ), 0.22 );
        vDomeN = normalize( normalMatrix * baN );
        vDomeT = normalize( normalMatrix * baT );
        vDomeB = normalize( normalMatrix * baB );
        vec3 transformed = position + normal * baSwell;
        `,
      ],
    ],
    fragmentHeader:
      RAMP_GLSL +
      /* glsl */ `
      uniform sampler2D uMask;
      uniform vec3 uTint;
      uniform float uSwell;
      uniform float uRidgeAmp;
      uniform float uSSS;
      uniform float uTexel;
      uniform float uSlope;
      varying vec2 vMUv;
      varying float vCov;
      varying float vRaw;
      varying float vHgt;
      varying float vCosT;
      varying vec3 vDomeN;
      varying vec3 vDomeT;
      varying vec3 vDomeB;
      float gBake;
      float baHeightAt( vec2 uv ) {
        vec4 m = texture2D( uMask, uv );
        return clamp( m.r, 0.0, 1.0 ) * uSwell + clamp( m.b, 0.0, 1.0 ) * uRidgeAmp;
      }
    `,
    fragment: [
      [
        '#include <map_fragment>',
        /* glsl */ `
        #include <map_fragment>
        if ( vCov < 0.06 ) discard;
        // Peaks catch the flame first; the valleys between them lag behind.
        float baTip = 0.48 + 1.05 * clamp( vHgt / max( uSwell, 1e-4 ), 0.0, 1.35 );
        gBake = clamp( vRaw * baTip, 0.0, 1.0 );
        float baSpeck = 0.965 + 0.07 * baHash( floor( vMUv * 340.0 ) );
        diffuseColor.rgb = baBakeRamp( uTint, gBake ) * baSpeck;
        `,
      ],
      [
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        #include <roughnessmap_fragment>
        // moist before the torch, drier and duller once it is browned
        roughnessFactor = mix( 0.44, 0.78, smoothstep( 0.04, 0.62, gBake ) );
        `,
      ],
      [
        '#include <normal_fragment_maps>',
        /* glsl */ `
        #include <normal_fragment_maps>
        {
          vec2 e = vec2( uTexel, 0.0 );
          float hL = baHeightAt( vMUv - e.xy );
          float hR = baHeightAt( vMUv + e.xy );
          float hD = baHeightAt( vMUv - e.yx );
          float hU = baHeightAt( vMUv + e.yx );
          float su = ( hR - hL ) * uSlope / vCosT;
          float sv = ( hU - hD ) * uSlope * 4.0;
          // fine sugar grain, only visible up close
          float g1 = baHash( floor( vMUv * 620.0 ) ) - 0.5;
          float g2 = baHash( floor( vMUv * 620.0 + 37.0 ) ) - 0.5;
          normal = normalize(
            vDomeN
            - vDomeT * ( su + g1 * 0.09 )
            - vDomeB * ( sv + g2 * 0.09 )
          );
        }
        `,
      ],
      [
        '#include <lights_fragment_end>',
        /* glsl */ `
        #include <lights_fragment_end>
        {
          float rim = pow( clamp( 1.0 - abs( dot( normalize( normal ), normalize( vViewPosition ) ) ), 0.0, 1.0 ), 2.1 );
          // Uncooked meringue glows softly through its thin edges; crust does not.
          reflectedLight.indirectDiffuse += diffuseColor.rgb * rim * uSSS * ( 1.0 - 0.72 * gBake );
        }
        `,
      ],
    ],
  });
}

/* --------------------------------------------------------------------- *
 * Instanced star-nozzle peaks. Each instance carries the dome UV of its
 * own footprint so it browns in step with the shell underneath it.
 * --------------------------------------------------------------------- */
export function createPeakMaterial(u: MeringueUniforms): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.5,
    metalness: 0,
  });

  return patch(mat, {
    key: 'ba-peak',
    uniforms: { ...u },
    vertexHeader: /* glsl */ `
      attribute vec2 aDomeUv;
      attribute float aSeed;
      attribute float aTip;
      varying vec2 vDomeUv;
      varying float vTip;
      varying float vSeed;
    `,
    vertex: [
      [
        '#include <begin_vertex>',
        /* glsl */ `
        #include <begin_vertex>
        vDomeUv = aDomeUv;
        vTip = aTip;
        vSeed = aSeed;
        `,
      ],
    ],
    fragmentHeader:
      RAMP_GLSL +
      /* glsl */ `
      uniform sampler2D uMask;
      uniform vec3 uTint;
      uniform float uSSS;
      varying vec2 vDomeUv;
      varying float vTip;
      varying float vSeed;
      float gBake;
    `,
    fragment: [
      [
        '#include <map_fragment>',
        /* glsl */ `
        #include <map_fragment>
        float baRaw = clamp( texture2D( uMask, vDomeUv ).g, 0.0, 1.0 );
        // The exposed tip browns well ahead of the shaded base.
        gBake = clamp( baRaw * ( 0.34 + 1.35 * vTip ), 0.0, 1.0 );
        float baVar = 0.955 + 0.075 * vSeed;
        diffuseColor.rgb = baBakeRamp( uTint, gBake ) * baVar;
        `,
      ],
      [
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        #include <roughnessmap_fragment>
        roughnessFactor = mix( 0.42, 0.76, smoothstep( 0.04, 0.62, gBake ) );
        `,
      ],
      [
        '#include <lights_fragment_end>',
        /* glsl */ `
        #include <lights_fragment_end>
        {
          float rim = pow( clamp( 1.0 - abs( dot( normalize( normal ), normalize( vViewPosition ) ) ), 0.0, 1.0 ), 1.9 );
          // Thin peak edges are where the subsurface read is strongest.
          float thin = 0.55 + 0.75 * vTip;
          reflectedLight.indirectDiffuse += diffuseColor.rgb * rim * uSSS * thin * ( 1.0 - 0.72 * gBake );
        }
        `,
      ],
    ],
  });
}

/* --------------------------------------------------------------------- *
 * The sliced cross-section of the meringue coat: dense creamy white, with
 * the golden skin only on the outer rim — and that skin samples the very
 * same browning the player painted.
 * --------------------------------------------------------------------- */
export function createCutMeringueMaterial(u: MeringueUniforms): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.62,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  return patch(mat, {
    key: 'ba-cutmeringue',
    uniforms: { ...u },
    vertexHeader: /* glsl */ `
      attribute vec2 aDomeUv;
      attribute float aRadial;
      varying vec2 vDomeUv;
      varying float vRadial;
    `,
    vertex: [
      [
        '#include <begin_vertex>',
        /* glsl */ `
        #include <begin_vertex>
        vDomeUv = aDomeUv;
        vRadial = aRadial;
        `,
      ],
    ],
    fragmentHeader:
      RAMP_GLSL +
      /* glsl */ `
      uniform sampler2D uMask;
      uniform vec3 uTint;
      varying vec2 vDomeUv;
      varying float vRadial;
    `,
    fragment: [
      [
        '#include <map_fragment>',
        /* glsl */ `
        #include <map_fragment>
        float baRaw = clamp( texture2D( uMask, vDomeUv ).g, 0.0, 1.0 );
        float crust = smoothstep( 0.74, 0.995, vRadial );
        vec3 inner = mix( uTint, vec3( 1.0 ), 0.34 );
        vec3 skin = baBakeRamp( uTint, baRaw );
        diffuseColor.rgb = mix( inner, skin, crust * ( 0.25 + 0.75 * smoothstep( 0.02, 0.35, baRaw ) ) );
        // aerated interior: fine bubbles read as speckle on the cut plane
        float sp = baHash( floor( vec2( vRadial, vDomeUv.y ) * vec2( 260.0, 420.0 ) ) );
        diffuseColor.rgb *= 0.94 + 0.1 * sp;
        `,
      ],
    ],
  });
}

/* --------------------------------------------------------------------- *
 * Frozen ice cream. Not glass, not plastic: a dense, faintly waxy solid
 * with a matte frost bloom that thins where the block was just cut.
 * --------------------------------------------------------------------- */
export function createIceMaterial(
  colour: number,
  maps: { normalMap?: THREE.Texture; roughnessMap?: THREE.Texture },
  opts: { frost?: number; cut?: boolean } = {},
): THREE.MeshStandardMaterial {
  const frost = opts.frost ?? 1;
  const cut = opts.cut ?? false;
  const mat = new THREE.MeshStandardMaterial({
    color: colour,
    roughness: cut ? 0.66 : 0.52,
    metalness: 0,
    normalMap: maps.normalMap ?? null,
    normalScale: new THREE.Vector2(frost * (cut ? 0.4 : 1.25), frost * (cut ? 0.4 : 1.25)),
    roughnessMap: cut ? null : (maps.roughnessMap ?? null),
    side: cut ? THREE.DoubleSide : THREE.FrontSide,
  });

  return patch(mat, {
    key: cut ? 'ba-ice-cut' : 'ba-ice',
    uniforms: { uFrost: { value: cut ? frost * 0.35 : frost } },
    vertexHeader: /* glsl */ `
      varying vec3 vBaWorld;
    `,
    fragmentHeader: /* glsl */ `
      uniform float uFrost;
      varying vec3 vBaWorld;
      float baHash2( vec2 p ) {
        return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453123 );
      }
    `,
    vertex: [
      [
        '#include <begin_vertex>',
        /* glsl */ `
        #include <begin_vertex>
        vBaWorld = ( modelMatrix * vec4( position, 1.0 ) ).xyz;
        `,
      ],
    ],
    fragment: [
      [
        '#include <map_fragment>',
        /* glsl */ `
        #include <map_fragment>
        // Frost gathers up high and thins towards the melting base.
        float baUp = clamp( vBaWorld.y * 0.85 - 0.06, 0.0, 1.0 );
        float baBloom = uFrost * ( 0.28 + 0.55 * baUp );
        diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.962, 0.973, 0.986 ), baBloom * 0.4 );
        float baGrain = baHash2( floor( vBaWorld.xy * 620.0 + vBaWorld.z * 13.0 ) );
        diffuseColor.rgb *= 0.955 + 0.09 * baGrain;
        `,
      ],
      [
        '#include <lights_fragment_end>',
        /* glsl */ `
        #include <lights_fragment_end>
        {
          // Shallow light bleed: dense frozen custard, not translucent glass.
          float rim = pow( clamp( 1.0 - abs( dot( normalize( normal ), normalize( vViewPosition ) ) ), 0.0, 1.0 ), 3.0 );
          reflectedLight.indirectDiffuse += diffuseColor.rgb * rim * 0.15;
        }
        `,
      ],
    ],
  });
}
