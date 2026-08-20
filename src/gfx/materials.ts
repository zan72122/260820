import {
  Color, MeshPhysicalMaterial, Texture, Vector2, Vector3, type IUniform,
} from 'three';
import { proceduralMaterial } from './procedural';

export const u = <T>(value: T): IUniform<T> => ({ value });

/** GLSL mirror of `seamOffsetAt()` in world/Geode.ts. Both halves must agree
 *  on the break line or they will not mate. */
const SEAM_GLSL = /* glsl */ `
float seamOffset(float lon) {
  return uSeamAmp * (0.55 * sin(lon * 3.0 + uSeamPhase.x)
                   + 0.28 * sin(lon * 7.0 + uSeamPhase.y)
                   + 0.17 * sin(lon * 13.0 + uSeamPhase.z));
}
`;

// ---------------------------------------------------------------------------
// 1. Muddy / wet geode shell — the material the whole first minute rests on.
// ---------------------------------------------------------------------------

export interface ShellUniforms {
  uMud: IUniform<Texture>;
  uWet: IUniform<Texture>;
  uTime: IUniform<number>;
  uSeed: IUniform<Vector3>;
  uHue: IUniform<Color>;
  uHint: IUniform<number>;
  uSeamGlow: IUniform<number>;
  uSeamAmp: IUniform<number>;
  uSeamPhase: IUniform<Vector3>;
  uStoneTint: IUniform<Color>;
  /** 0..1 strain built up by the wedge, and where along the seam it sits. */
  uStress: IUniform<number>;
  uStressLon: IUniform<number>;
}

export function createShellMaterial(un: ShellUniforms): MeshPhysicalMaterial {
  return proceduralMaterial({
    key: 'geode-shell',
    uniforms: un as unknown as Record<string, IUniform>,
    shared: 'varying float vSurf;',
    vertexHead: 'attribute float aSurf;',
    vertex: 'vSurf = aSurf;',
    head: SEAM_GLSL,
    surface: /* glsl */ `
      vec3 op = vObjPos;
      vec3 dir = normalize(op);
      vec2 muv = dirToEquirect(dir);

      float mud = texture2D(uMud, muv).a;
      float wet = clamp(texture2D(uWet, muv).a * 1.2, 0.0, 1.0);
      float mudMask = smoothstep(0.05, 0.5, mud);
      float rim = step(0.5, vSurf);

      // ---- dry stone ------------------------------------------------------
      // Everything below is 3D noise on the object position. Equirect-space
      // patterns pinch at the poles, and this stone is looked at from every
      // angle, so only the painted masks are allowed to live in uv space.
      float warp  = fbm3(op * 2.4 + uSeed, 3);
      float crag  = ridged3(op * 4.4 + warp * 0.75 + uSeed, 4);
      float lump  = fbm3(op * 8.5 + uSeed * 1.3, 3) * 0.5 + 0.5;
      float grain = fbm3(op * 26.0 + uSeed * 2.1, 2) * 0.5 + 0.5;

      // Albedo stays low-contrast: the form should come from light on relief,
      // not from a busy colour texture that aliases on a phone screen.
      float tone = clamp(crag * 0.92 + lump * 0.30 - 0.10, 0.0, 1.0);
      vec3 stonePale = vec3(0.318, 0.296, 0.272) * uStoneTint;
      vec3 stoneDark = vec3(0.118, 0.104, 0.098) * uStoneTint;
      vec3 stone = mix(stoneDark, stonePale, tone);

      // The fresh cut is paler and more granular than the weathered outside.
      stone = mix(stone, stone * 1.12 + vec3(0.012, 0.010, 0.009), rim * 0.85);

      // ---- caked mud ------------------------------------------------------
      float mudLump = fbm3(op * 4.6 + 11.0, 3) * 0.5 + 0.5;
      float mudGrit = fbm3(op * 19.0 + 4.0, 2) * 0.5 + 0.5;
      float mudCake = smoothstep(0.30, 0.72, mudLump);
      vec3 mudCol = mix(vec3(0.048, 0.034, 0.021), vec3(0.135, 0.096, 0.055), mudLump);
      mudCol *= 0.86 + 0.26 * mudGrit;

      vec3 albedo = mix(stone, mudCol, mudMask);

      // ---- water ----------------------------------------------------------
      albedo *= mix(1.0, 0.48 + 0.14 * mudMask, wet);

      float rough = mix(0.86 - crag * 0.10 - grain * 0.08, 0.97 - mudGrit * 0.05, mudMask);
      rough = mix(rough, 0.30 + 0.16 * mudMask + grain * 0.10, wet * (1.0 - mudMask * 0.4));

      // Beads only survive on clean wet stone, and they are small.
      float dn = fbm3(op * 78.0 + 71.0, 2);
      float drop = smoothstep(0.20, 0.40, dn) * wet * (1.0 - mudMask);
      rough = mix(rough, 0.14, drop * 0.55);

      // ---- the break line, revealed only once the mud is gone --------------
      float lon = atan(op.z, op.x);
      float seamDist = abs(op.y - seamOffset(lon));
      float seamLine = 1.0 - smoothstep(0.004, 0.026, seamDist);
      // Tight: a wide band tints the whole stone blue instead of reading as
      // colour seeping out of the crack.
      float seamBand = 1.0 - smoothstep(0.015, 0.115, seamDist);
      albedo *= mix(1.0, 0.24, seamLine * (1.0 - mudMask) * (1.0 - rim));

      // ---- the promise: colour bleeding out of the crevices ---------------
      float crevice = smoothstep(0.45, 0.9, 1.0 - crag);
      float hint = uHint * (1.0 - mudMask) * seamBand * (0.35 + 0.85 * crevice);
      hint = clamp(hint, 0.0, 0.85);
      vec3 hueLin = uHue * uHue;
      albedo = mix(albedo, hueLin * 0.85, hint * 0.62);

      // ---- strain: light gathers where the wedge keeps working -------------
      float dLon = abs(mod(lon - uStressLon + 3.14159265, 6.28318531) - 3.14159265);
      float stress = exp(-dLon * dLon * 7.0) * uStress * (1.0 - mudMask);
      float stressGlow = stress * mix(seamLine, seamBand, 0.30);
      albedo += hueLin * stressGlow * 0.22;

      // ---- relief ---------------------------------------------------------
      float height = mix(
        crag * 1.0 + lump * 0.40 + grain * 0.10,
        mudCake * 1.0 + mudGrit * 0.35,
        mudMask);
      height = mix(height, height * 0.80, wet);
      height += drop * 0.12;
      height -= seamLine * 0.9 * (1.0 - mudMask) * (1.0 - rim);
      height = mix(height, grain * 0.75 + crag * 0.45 + lump * 0.3, rim);

      gAlbedo = albedo;
      gRough = clamp(rough, 0.05, 1.0);
      gMetal = 0.0;
      gHeight = height;
      gBumpScale = mix(0.023, 0.019, mudMask) * mix(1.0, 0.7, rim) * mix(1.0, 0.8, wet);
      gEmiss = hueLin * ((hint * 0.40 + seamLine * seamBand * 0.55) * uSeamGlow + stressGlow * 0.75);
    `,
    params: { roughness: 0.8, metalness: 0, envMapIntensity: 0.85 },
  });
}

// ---------------------------------------------------------------------------
// 2. Druzy — the micro-crystalline crust lining the cavity behind the crystals.
// ---------------------------------------------------------------------------

export interface DruzyUniforms {
  uPowder: IUniform<Texture>;
  uTime: IUniform<number>;
  uSeed: IUniform<Vector3>;
  uHue: IUniform<Color>;
  uGlow: IUniform<number>;
  uCavityR: IUniform<number>;
  uDiscSign: IUniform<number>;
}

export function createDruzyMaterial(un: DruzyUniforms): MeshPhysicalMaterial {
  return proceduralMaterial({
    key: 'geode-druzy',
    uniforms: un as unknown as Record<string, IUniform>,
    surface: /* glsl */ `
      vec3 op = vObjPos;
      // Disc projection: no pole singularity at the centre of the bowl, which
      // is exactly where the brush spends most of its time.
      vec2 duv = vec2(op.x, op.z * uDiscSign) / (uCavityR * 2.2) + 0.5;
      float powder = texture2D(uPowder, duv).a;

      vec2 fine = worley2(op.xz * 118.0 + uSeed.xy * 9.0);
      float facet = smoothstep(0.0, 0.30, fine.y - fine.x);
      vec2 fine2 = worley2(vec2(op.y, length(op.xz)) * 96.0 + uSeed.yz * 5.0);
      float facet2 = smoothstep(0.0, 0.26, fine2.y - fine2.x);
      float sugar = max(facet, facet2 * 0.8);

      float band = fbm3(op * 6.0 + uSeed, 4) * 0.5 + 0.5;   // agate banding
      vec3 hueLin = uHue * uHue;
      vec3 base = mix(hueLin * 0.20, hueLin * 0.60, band);
      base = mix(base, vec3(0.40, 0.38, 0.36) * 0.55, smoothstep(0.72, 1.0, band) * 0.6);
      base += hueLin * sugar * 0.30;

      float dust = smoothstep(0.05, 0.6, powder);
      vec3 dustCol = mix(vec3(0.30, 0.28, 0.25), vec3(0.46, 0.43, 0.39), band);
      vec3 albedo = mix(base, dustCol, dust * 0.92);

      float rough = mix(0.16 + (1.0 - sugar) * 0.30, 0.92, dust);

      gAlbedo = albedo;
      gRough = rough;
      gMetal = 0.0;
      gHeight = sugar * 0.9 + band * 0.25 + dust * 0.4;
      gBumpScale = mix(0.016, 0.010, dust);
      gEmiss = hueLin * (1.0 - dust) * (0.03 + 0.13 * sugar) * uGlow;
    `,
    params: { roughness: 0.3, metalness: 0, envMapIntensity: 0.9, clearcoat: 0.3, clearcoatRoughness: 0.25 },
  });
}

// ---------------------------------------------------------------------------
// 3. Crystal — flat-faceted gem. Reads as "pretty" on a small screen because
//    facets catch discrete env glints instead of a smeared highlight.
// ---------------------------------------------------------------------------

export interface CrystalUniforms {
  uHue: IUniform<Color>;
  uGlow: IUniform<number>;
  uTime: IUniform<number>;
  uClarity: IUniform<number>;
  uPowder: IUniform<Texture>;
  uCavityR: IUniform<number>;
  uDiscSign: IUniform<number>;
}

export function createCrystalMaterial(un: CrystalUniforms, iridescent: boolean): MeshPhysicalMaterial {
  return proceduralMaterial({
    key: `geode-crystal-${iridescent ? 'irid' : 'plain'}`,
    uniforms: un as unknown as Record<string, IUniform>,
    shared: 'varying vec3 vGeoPos;\nvarying float vTipT;',
    vertex: /* glsl */ `
      #ifdef USE_INSTANCING
        vGeoPos = (instanceMatrix * vec4(transformed, 1.0)).xyz;
      #else
        vGeoPos = transformed;
      #endif
      vTipT = clamp(position.y, 0.0, 1.0);
    `,
    surface: /* glsl */ `
      vec3 hueLin = uHue * uHue;
      float fres = fresnelTerm(vVNormal, vViewPosition, 2.4);

      // Colour zoning: pale, almost colourless at the base, saturated at the tip.
      float zone = smoothstep(0.05, 0.85, vTipT);
      // Kept well under 1: a near-mirror surface multiplies its albedo by a
      // bright environment, and a white-ish gem reads as a blown-out blob.
      vec3 body = mix(vec3(0.52, 0.54, 0.58) * 0.55, hueLin * 0.78, zone * uClarity);
      body = mix(body, hueLin * 0.55, 0.45);

      // Internal veils / phantoms so the gem is not a flat plastic blob.
      float veil = fbm3(vObjPos * vec3(9.0, 5.0, 9.0) + 4.2, 3) * 0.5 + 0.5;
      body = mix(body, body * (0.55 + 0.9 * veil), (1.0 - uClarity) * 0.75);

      float powder = texture2D(uPowder, vec2(vGeoPos.x, vGeoPos.z * uDiscSign) / (uCavityR * 2.2) + 0.5).a;
      float dust = smoothstep(0.10, 0.65, powder);
      vec3 dustCol = vec3(0.40, 0.38, 0.35);

      gAlbedo = mix(body, dustCol, dust * 0.88);
      gRough = mix(0.060 + (1.0 - uClarity) * 0.14, 0.86, dust);
      gMetal = 0.0;
      gHeight = veil * 0.2 + dust * 0.5;
      gBumpScale = dust * 0.012;
      // Fresnel-weighted inner fire. Kept above the bloom threshold only at the
      // grazing rim, so the selective bloom picks out edges, not the whole gem.
      gEmiss = hueLin * (0.05 + 0.62 * fres) * uGlow * (1.0 - dust * 0.9) * (0.4 + 0.6 * zone);
    `,
    params: {
      roughness: 0.075,
      metalness: 0,
      flatShading: true,
      clearcoat: 0.55,
      clearcoatRoughness: 0.10,
      ior: 1.55,
      envMapIntensity: 1.1,
      ...(iridescent ? { iridescence: 0.5, iridescenceIOR: 1.8, iridescenceThicknessRange: [180, 520] as [number, number] } : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// 4. Bench wood — planks, grain, and puddles that hold the workshop together.
// ---------------------------------------------------------------------------

export function createWoodMaterial(uTime: IUniform<number>, uWetPool: IUniform<number>): MeshPhysicalMaterial {
  return proceduralMaterial({
    key: 'bench-wood',
    uniforms: { uTime, uWetPool },
    surface: /* glsl */ `
      vec3 p = vObjPos;
      float plank = floor(p.z * 1.05);
      float plankJitter = gh11(vec3(plank, 3.0, 7.0));
      vec2 gp = vec2(p.x * 1.0 + plankJitter * 12.0, p.z * 6.0);

      // Ring grain: stretched noise plus a hard sine ring pattern.
      float wob = fbm3(vec3(gp * vec2(0.35, 2.6), plankJitter * 9.0), 3);
      float rings = fract((gp.y + wob * 1.4) * 3.1);
      rings = smoothstep(0.30, 0.52, abs(rings - 0.5) * 2.0);
      float fibre = fbm3(vec3(gp.x * 3.0, gp.y * 46.0, plankJitter * 4.0), 2) * 0.5 + 0.5;

      vec3 lightWood = vec3(0.150, 0.098, 0.058);
      vec3 darkWood  = vec3(0.052, 0.031, 0.019);
      vec3 albedo = mix(darkWood, lightWood, rings * 0.75 + fibre * 0.32);
      albedo *= 0.82 + 0.30 * plankJitter;

      // Plank gap
      float gap = 1.0 - smoothstep(0.0, 0.035, abs(fract(p.z * 1.05) - 0.5) * 2.0 - 0.90);
      albedo *= mix(1.0, 0.22, gap);

      // Old water stains near the middle of the bench, plus the live wet pool.
      float stain = smoothstep(0.55, 1.0, fbm3(p * 0.85 + 21.0, 4) * 0.5 + 0.5);
      float pool = uWetPool * smoothstep(1.9, 0.55, length(p.xz - vec2(-0.15, 0.05)));
      float wet = clamp(stain * 0.45 + pool, 0.0, 1.0);
      albedo *= mix(1.0, 0.45, wet);

      float rough = mix(0.88 - fibre * 0.16, 0.14, wet);
      rough = mix(rough, 0.95, gap);

      gAlbedo = albedo;
      gRough = rough;
      gMetal = 0.0;
      gHeight = fibre * 0.55 + rings * 0.30 - gap * 1.6;
      gBumpScale = mix(0.020, 0.008, wet);
      gEmiss = vec3(0.0);
    `,
    params: { roughness: 0.85, metalness: 0, envMapIntensity: 0.7 },
  });
}

// ---------------------------------------------------------------------------
// 5. Tool steel & brass — the cradle, the wedge, the brush ferrule.
// ---------------------------------------------------------------------------

export function createMetalMaterial(
  uTime: IUniform<number>, tint: Color, brushed = 0.7, wear = 0.5,
): MeshPhysicalMaterial {
  return proceduralMaterial({
    key: `tool-metal-${tint.getHexString()}-${brushed.toFixed(2)}`,
    uniforms: { uTime, uTint: u(tint), uBrushed: u(brushed), uWear: u(wear) },
    surface: /* glsl */ `
      vec3 p = vObjPos;
      // Anisotropic-looking brushed streaks along the long axis of the tool.
      float streak = fbm3(vec3(p.x * 260.0, p.y * 5.0, p.z * 260.0), 3) * 0.5 + 0.5;
      float dents = fbm3(p * 34.0 + 3.3, 3) * 0.5 + 0.5;
      float tarnish = smoothstep(0.45, 0.95, fbm3(p * 7.5 + 12.0, 4) * 0.5 + 0.5) * uWear;

      vec3 albedo = uTint * uTint;
      albedo = mix(albedo, albedo * vec3(0.55, 0.48, 0.42), tarnish);

      float rough = mix(0.26, 0.62, uBrushed) + streak * 0.20 * uBrushed;
      rough = mix(rough, 0.72, tarnish);
      rough += dents * 0.07;

      gAlbedo = albedo;
      gRough = rough;
      gMetal = mix(1.0, 0.72, tarnish);
      gHeight = streak * 0.25 * uBrushed + dents * 0.5 + tarnish * 0.3;
      gBumpScale = 0.006;
      gEmiss = vec3(0.0);
    `,
    params: { roughness: 0.3, metalness: 1, envMapIntensity: 0.6 },
  });
}

// ---------------------------------------------------------------------------
// 6. Velvet — the finale pedestal. Sheen does the heavy lifting: a velvet's
//    identity is the bright grazing rim, not its base colour.
// ---------------------------------------------------------------------------

export function createVelvetMaterial(tint: Color): MeshPhysicalMaterial {
  return proceduralMaterial({
    key: `velvet-${tint.getHexString()}`,
    uniforms: { uTint: u(tint) },
    surface: /* glsl */ `
      vec3 p = vObjPos;
      float fuzz = fbm3(p * 340.0, 2) * 0.5 + 0.5;
      vec2 tuft = worley2(p.xz * 210.0);
      float nap = smoothstep(0.0, 0.4, tuft.y - tuft.x);
      float fres = fresnelTerm(vVNormal, vViewPosition, 2.0);

      vec3 base = uTint * uTint * (0.72 + 0.30 * fuzz);
      // Cheap asperity scattering: the pile catches light at grazing angles.
      base += uTint * uTint * fres * 0.75;

      gAlbedo = base;
      gRough = 0.86 - nap * 0.08;
      gMetal = 0.0;
      gHeight = fuzz * 0.5 + nap * 0.4;
      gBumpScale = 0.004;
      gEmiss = vec3(0.0);
    `,
    params: {
      roughness: 0.9, metalness: 0, envMapIntensity: 0.5,
      sheen: 1.0, sheenRoughness: 0.35, sheenColor: tint.clone().multiplyScalar(1.4),
    },
  });
}

// ---------------------------------------------------------------------------
// 7. Bristles — soft, translucent-looking hair for the dusting brush.
// ---------------------------------------------------------------------------

export function createBristleMaterial(): MeshPhysicalMaterial {
  return proceduralMaterial({
    key: 'brush-bristle',
    uniforms: {},
    shared: 'varying float vHair;',
    vertex: 'vHair = clamp(position.y * 0.5 + 0.5, 0.0, 1.0);',
    surface: /* glsl */ `
      float t = vHair;
      float fres = fresnelTerm(vVNormal, vViewPosition, 1.6);
      vec3 root = vec3(0.115, 0.075, 0.042);
      vec3 tipC = vec3(0.470, 0.372, 0.245);
      vec3 albedo = mix(tipC, root, t);
      albedo += vec3(0.30, 0.24, 0.16) * fres * (1.0 - t) * 0.9;

      gAlbedo = albedo;
      gRough = 0.42 + t * 0.28;
      gMetal = 0.0;
      gHeight = 0.0;
      gBumpScale = 0.0;
      gEmiss = vec3(0.0);
    `,
    params: { roughness: 0.5, metalness: 0, envMapIntensity: 0.8 },
  });
}

// ---------------------------------------------------------------------------
// 8. Shallow water — the stream the stone is washed in.
// ---------------------------------------------------------------------------

export function createWaterMaterial(uTime: IUniform<number>, uAgitate: IUniform<number>,
                                    uTouch: IUniform<Vector2>): MeshPhysicalMaterial {
  return proceduralMaterial({
    key: 'stream-water',
    uniforms: { uTime, uAgitate, uTouch },
    surface: /* glsl */ `
      vec3 p = vObjPos;
      float t = uTime;
      float w1 = fbm3(vec3(p.xz * 3.4, t * 0.32), 3);
      float w2 = fbm3(vec3(p.zx * 6.1 - 4.0, t * 0.55), 3);
      float ripple = w1 * 0.6 + w2 * 0.4;

      // Concentric rings expanding from the last touch point.
      float d = length(p.xz - uTouch);
      float rings = sin(d * 30.0 - t * 8.5) * exp(-d * 2.6) * uAgitate;

      float h = ripple * 0.5 + rings * 0.7;
      float fres = fresnelTerm(vVNormal, vViewPosition, 3.2);

      gAlbedo = mix(vec3(0.020, 0.042, 0.048), vec3(0.070, 0.115, 0.120), ripple * 0.5 + 0.5);
      gRough = 0.045 + max(0.0, -h) * 0.05;
      gMetal = 0.0;
      gHeight = h;
      gBumpScale = 0.016 + uAgitate * 0.024;
      gEmiss = vec3(0.0);
      // Mostly clear looking straight down, mirror-like at grazing angles.
      float edge = smoothstep(1.0, 0.86, length(p.xz) / 0.94);
      gAlpha = clamp(0.20 + fres * 0.72 + abs(rings) * 0.30, 0.0, 1.0) * edge;
    `,
    params: {
      roughness: 0.04, metalness: 0, envMapIntensity: 1.6,
      transparent: true, opacity: 1.0, depthWrite: false,
      clearcoat: 1.0, clearcoatRoughness: 0.03,
    },
  });
}

// ---------------------------------------------------------------------------
// 9. Plaster wall & carved stone — quiet backdrop materials. Deliberately
//    low-contrast so nothing competes with the geode for attention.
// ---------------------------------------------------------------------------

export function createPlasterMaterial(): MeshPhysicalMaterial {
  return proceduralMaterial({
    key: 'wall-plaster',
    uniforms: {},
    surface: /* glsl */ `
      vec3 p = vObjPos;
      float coarse = fbm3(p * 2.2, 4) * 0.5 + 0.5;
      float fine = fbm3(p * 38.0, 3) * 0.5 + 0.5;
      float trowel = fbm3(vec3(p.x * 5.0, p.y * 1.3, 0.0), 3) * 0.5 + 0.5;
      vec3 albedo = mix(vec3(0.030, 0.026, 0.024), vec3(0.088, 0.078, 0.070), coarse * 0.7 + trowel * 0.35);
      // Slight vertical gradient: the wall is lit from a window up and to the left.
      albedo *= 0.55 + 0.75 * smoothstep(-2.2, 2.6, p.y);
      gAlbedo = albedo;
      gRough = 0.92 - fine * 0.08;
      gMetal = 0.0;
      gHeight = fine * 0.35 + trowel * 0.7;
      gBumpScale = 0.010;
      gEmiss = vec3(0.0);
    `,
    params: { roughness: 0.95, metalness: 0, envMapIntensity: 0.45 },
  });
}

export function createStoneMaterial(tint: Color, wet: IUniform<number>): MeshPhysicalMaterial {
  return proceduralMaterial({
    key: `carved-stone-${tint.getHexString()}`,
    uniforms: { uTint: u(tint), uWet: wet },
    surface: /* glsl */ `
      vec3 p = vObjPos;
      float grain = fbm3(p * 22.0, 3) * 0.5 + 0.5;
      float chisel = ridged3(p * 7.0, 3);
      vec2 speck = worley2(p.xz * 60.0 + p.y * 3.0);
      float fleck = smoothstep(0.0, 0.18, speck.y - speck.x);
      vec3 albedo = uTint * uTint * (0.42 + 0.55 * (grain * 0.5 + chisel * 0.6));
      albedo = mix(albedo, albedo * 1.5, fleck * 0.25);
      float wet = clamp(uWet, 0.0, 1.0);
      albedo *= mix(1.0, 0.44, wet);
      gAlbedo = albedo;
      gRough = mix(0.86 - chisel * 0.10, 0.24, wet);
      gMetal = 0.0;
      gHeight = chisel * 0.7 + grain * 0.2 + fleck * 0.1;
      gBumpScale = mix(0.011, 0.006, wet);
      gEmiss = vec3(0.0);
    `,
    params: { roughness: 0.85, metalness: 0, envMapIntensity: 0.8 },
  });
}
