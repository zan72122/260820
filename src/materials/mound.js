// The growing pile of shaved ice.
//
// Geometry is a fixed grid displaced in the vertex shader by a height texture
// that the CPU heap simulation writes into -- so "the flake that just landed made
// the pile bigger" is literally true, without simulating thousands of rigid bodies.
//
// The surface then blends three things the player poured: a wet surface film,
// colour that has soaked *into* the ice, and the dry granular white in between.

import { MeshPhysicalMaterial, Color, Vector2, Vector3 } from 'three';

export function createMoundMaterial({
  heightTex, syrupSurf, syrupSoak, iceNormal, sparkle, clump, envMap, sun, cellSize, gridSize, maxHeight, quality,
}) {
  const uniforms = {
    tHeight: { value: heightTex },
    tSurf: { value: syrupSurf },
    tSoak: { value: syrupSoak },
    tGrain: { value: iceNormal },
    tSparkle: { value: sparkle },
    uTexel: { value: new Vector2(1 / gridSize, 1 / gridSize) },
    uCell: { value: cellSize },
    uMaxH: { value: maxHeight },
    uSunDir: { value: sun.clone().normalize() },
    uTime: { value: 0 },
    uGrainScale: { value: 1.0 },
    tGrainV: { value: clump },
    uLump: { value: 0.0135 },
    uSparkleScale: { value: 5.2 },
  };

  const mat = new MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.62,
    metalness: 0.0,
    envMap,
    envMapIntensity: 1.0,
    sheen: quality.sheen ? 0.55 : 0.0,
    sheenRoughness: 0.55,
    sheenColor: new Color(0.62, 0.72, 0.86),
    clearcoat: 0.0,
  });

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tHeight;
        uniform sampler2D tGrainV;
        uniform float uLump;
        uniform vec2 uTexel;
        uniform float uCell;
        uniform float uMaxH;
        varying vec2 vGrid;
        varying float vH;
        varying float vSlope;
        varying float vCav;
        varying float vSnow;`)
      .replace('#include <beginnormal_vertex>', `
        vGrid = uv;
        float snow0 = texture2D(tHeight, uv).g;
        // clumps must never be taller than the snow they are made of, or a thin
        // first layer comes out as a crown of spikes
        float lumpMask = min(uLump, snow0 * 0.45) * smoothstep(0.0004, 0.004, snow0);
        #define LUMP(q) ((texture2D(tGrainV, (q) * 2.0).r - 0.5) + (texture2D(tGrainV, (q) * 5.3 + 0.41).r - 0.5) * 0.5) * lumpMask
        float h  = texture2D(tHeight, uv).r + LUMP(uv);
        float hl = texture2D(tHeight, uv - vec2(uTexel.x, 0.0)).r + LUMP(uv - vec2(uTexel.x, 0.0));
        float hr = texture2D(tHeight, uv + vec2(uTexel.x, 0.0)).r + LUMP(uv + vec2(uTexel.x, 0.0));
        float hd = texture2D(tHeight, uv - vec2(0.0, uTexel.y)).r + LUMP(uv - vec2(0.0, uTexel.y));
        float hu = texture2D(tHeight, uv + vec2(0.0, uTexel.y)).r + LUMP(uv + vec2(0.0, uTexel.y));
        vec3 objectNormal = normalize(vec3(hl - hr, 2.0 * uCell, hd - hu));
        vSnow = texture2D(tHeight, uv).g;
        vH = h / max(uMaxH, 1e-4);
        vSlope = 1.0 - objectNormal.y;
        // discrete laplacian -> concave gutters go darker (cheap ambient occlusion)
        vCav = clamp(((hl + hr + hd + hu) * 0.25 - h) / (uCell * 1.5), -1.0, 1.0);
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif`)
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3( position.x, position.y + h, position.z );`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tSurf;
        uniform sampler2D tSoak;
        uniform sampler2D tGrain;
        uniform sampler2D tSparkle;
        uniform vec3 uSunDir;
        uniform float uTime;
        uniform float uGrainScale;
        uniform float uSparkleScale;
        varying vec2 vGrid;
        varying float vH;
        varying float vSlope;
        varying float vCav;
        varying float vSnow;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        // shaved ice does not end on a clean contour: crumble the boundary
        float edgeN = texture2D(tGrain, vGrid * 34.0).x + texture2D(tGrain, vGrid * 11.0).y;
        if (vSnow < 0.00030 + edgeN * 0.00055) discard;
        vec4 sSurf = texture2D(tSurf, vGrid);
        vec4 sSoak = texture2D(tSoak, vGrid);
        float syrupWet = smoothstep(0.015, 0.16, sSurf.a);
        float syrupSoak = clamp(sSoak.a, 0.0, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // granular relief: two scales of shard normal, flattened where wet
          float wetPre = syrupWet;
          vec3 g1 = texture2D(tGrain, vGrid * uGrainScale).xyz * 2.0 - 1.0;
          vec3 g2 = texture2D(tGrain, vGrid * uGrainScale * 2.7 + 0.37).xyz * 2.0 - 1.0;
          vec3 bump = normalize(g1 + g2 * 0.55);
          float amt = mix(0.85, 0.12, wetPre) * smoothstep(0.002, 0.02, vH * 0.08 + 0.02);
          vec3 t1 = normalize(cross(normal, vec3(0.0, 0.0, 1.0)) + 1e-5);
          vec3 t2 = cross(normal, t1);
          normal = normalize(normal + (t1 * bump.x + t2 * bump.y) * amt);
        }`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        #ifdef USE_SHEEN
          // the white fuzz of dry crystals; syrup drowns it, whether it is still
          // sitting on top or has already gone in
          material.sheenColor *= (1.0 - max(syrupWet, smoothstep(0.0, 0.30, syrupSoak)));
        #endif`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        // dry shaved ice is a matte scatterer; a syrup film turns it to glass
        roughnessFactor = mix(0.66, 0.075, syrupWet);`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float wet = syrupWet;
          float soak = syrupSoak;

          // dry ice: bright but not paper white, blue-grey deep in the gutters
          vec3 dry = vec3(0.955, 0.972, 0.995);
          dry = mix(dry, vec3(0.72, 0.80, 0.90), smoothstep(0.0, 0.75, max(vCav, 0.0)) * 0.55);

          // soaked colour: the crystals take the dye but keep scattering, so it
          // saturates and deepens rather than turning to a dark stain
          vec3 sc = max(sSoak.rgb, vec3(0.0));
          float sMax = max(max(sc.r, sc.g), sc.b);
          vec3 hue = sc / max(sMax, 1e-4);
          float depth = smoothstep(0.003, 0.22, soak);
          vec3 body = dry * mix(vec3(1.0), hue * 1.06, depth);
          body *= mix(1.0, 0.78, smoothstep(0.10, 0.75, soak));

          // the wet film sitting on top: darker, richer, still translucent
          vec3 filmCol = max(sSurf.rgb, vec3(0.0));
          vec3 wetCol = filmCol * (0.55 + 0.45 * filmCol);
          diffuseColor.rgb = mix(body, wetCol, wet * 0.92);
        }`)
      .replace('#include <opaque_fragment>', `
        {
          float wet = max(syrupWet, smoothstep(0.0, 0.28, syrupSoak));

          // micro-facet glitter: thousands of tiny mirrors, not a plastic white ball
          vec3 h = normalize(uSunDir + geometryViewDir);
          float spec = pow(max(dot(geometryNormal, h), 0.0), 30.0);
          vec3 sp = texture2D(tSparkle, vGrid * uSparkleScale).rgb;
          float glint = smoothstep(0.55, 1.0, sp.r * 0.6 + sp.g * 0.5 + sp.b * 0.5);
          outgoingLight += vec3(1.0, 0.99, 0.97) * glint * spec * (1.0 - wet) * 2.4;

          // shallow translucency: light creeps a few millimetres into the pile
          float back = pow(max(dot(geometryViewDir, -uSunDir), 0.0), 3.0);
          outgoingLight += vec3(0.60, 0.72, 0.86) * back * 0.20 * (1.0 - wet * 0.6);
          outgoingLight += vec3(0.30, 0.40, 0.55) * (1.0 - max(vCav, 0.0)) * 0.045;
        }
        #include <opaque_fragment>`);

    mat.userData.shader = shader;
  };

  mat.customProgramCacheKey = () => 'mound';
  mat.userData.uniforms = uniforms;
  return mat;
}
