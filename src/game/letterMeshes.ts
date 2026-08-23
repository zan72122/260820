import * as THREE from 'three';
import { GlyphDef, glyphShape } from './glyphs';
import { MoldField } from './moldField';
import { FLASK_W, PRESS_DEPTH } from './sand';
import { hash2, makeCanvasTexture } from './moldField';

/**
 * Pattern (原型) and cast-metal meshes, both built from the same
 * canonical glyph shape and laid out in "mold local" space:
 * x right, z toward camera, y up, origin at sand surface centre.
 * em (x,y) -> local (x*S, -(y-0.5)*S) where S = glyphScale * FLASK_W.
 */

export const PATTERN_THICK = 0.075;
export const CAST_THICK = PRESS_DEPTH * 0.86;

function moldSpaceGeometry(def: GlyphDef, depth: number, bevel: number): THREE.ExtrudeGeometry {
  const S = 0.62 * FLASK_W;
  const shape = glyphShape(def);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth / S,
    bevelEnabled: true,
    bevelThickness: bevel / S,
    bevelSize: bevel / S * 0.9,
    bevelSegments: 2,
    curveSegments: 10,
    steps: 1,
  });
  // shape face at z=0 extruded to +z; lay flat: y_em -> -z_local, extrusion -> +y
  geo.rotateX(-Math.PI / 2);
  // recentre em y (glyph centred on 0.5) and scale to metres
  geo.translate(0, 0, 0.5);
  geo.scale(S, 1, S);
  // rotateX moved extrusion to +y already in shape units; scale y separately
  // (depth was given in shape units depth/S, so scale y by S too)
  geo.scale(1, S, 1);
  geo.computeVertexNormals();
  return geo;
}

/* --------------------------------------------------- pattern (原型) */

export function buildPatternMesh(def: GlyphDef): THREE.Mesh {
  const geo = moldSpaceGeometry(def, PATTERN_THICK, 0.006);

  const scratches = makeCanvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#7f7f7f';
    ctx.fillRect(0, 0, s, s);
    // fine machining lines
    for (let i = 0; i < 80; i++) {
      const y = hash2(i, 1, 21) * s;
      ctx.strokeStyle = `rgba(${120 + hash2(i, 2, 22) * 60 | 0},${120 + hash2(i, 2, 23) * 60 | 0},${125 | 0},0.25)`;
      ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y + (hash2(i, 3, 24) - 0.5) * 6); ctx.stroke();
    }
    // sparse contact scuffs
    for (let i = 0; i < 26; i++) {
      const x = hash2(i, 4, 25) * s, y = hash2(i, 5, 26) * s;
      ctx.strokeStyle = 'rgba(70,70,72,0.30)';
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.lineTo(x + (hash2(i, 6, 27) - 0.5) * 26, y + (hash2(i, 7, 28) - 0.5) * 10);
      ctx.stroke();
    }
  });

  const mat = new THREE.MeshStandardMaterial({
    color: 0xa9adb2,
    metalness: 0.7,
    roughness: 0.52,
    roughnessMap: scratches,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/* --------------------------------------------------- molten / cast */

export interface CastUniforms {
  uFill: { value: number };
  uTemp: { value: number };
}

export function blackbody(t: number): THREE.Color {
  // t 1 = pouring hot, 0 = cold
  const c = new THREE.Color();
  if (t > 0.66) {
    const k = (t - 0.66) / 0.34;
    c.setRGB(1.0, 0.52 + 0.3 * k, 0.13 + 0.3 * k);
  } else if (t > 0.33) {
    const k = (t - 0.33) / 0.33;
    c.setRGB(0.75 + 0.25 * k, 0.16 + 0.36 * k, 0.03 + 0.1 * k);
  } else {
    const k = t / 0.33;
    c.setRGB(0.75 * k * k, 0.16 * k * k, 0.03 * k * k);
  }
  return c;
}

function castRoughnessTex(): THREE.CanvasTexture {
  return makeCanvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(0, 0, s, s);
    // as-cast skin: gently mottled roughness, no uniform mirror finish
    for (let i = 0; i < 3600; i++) {
      const x = hash2(i, 1, 31) * s, y = hash2(i, 2, 32) * s;
      const g = 130 + hash2(i, 3, 33) * 60;
      ctx.fillStyle = `rgba(${g | 0},${g | 0},${g | 0},0.28)`;
      const r = 0.8 + hash2(i, 4, 34) * 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
  });
}

export function buildCastMaterial(): { mat: THREE.MeshStandardMaterial; uniforms: CastUniforms } {
  const uniforms: CastUniforms = { uFill: { value: 0 }, uTemp: { value: 1 } };
  const mat = new THREE.MeshStandardMaterial({
    color: 0xa06a32,          // bronze
    metalness: 0.9,
    roughness: 0.55,
    roughnessMap: castRoughnessTex(),
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFill = uniforms.uFill;
    shader.uniforms.uTemp = uniforms.uTemp;
    shader.vertexShader = `
      attribute float aFlow;
      varying float vFlow;
    ` + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n vFlow = aFlow;'
    );
    shader.fragmentShader = `
      varying float vFlow;
      uniform float uFill;
      uniform float uTemp;
      vec3 lfBlackbody(float t) {
        vec3 hot = vec3(1.0, 0.17, 0.015);
        vec3 mid = vec3(0.6, 0.07, 0.008);
        vec3 low = vec3(0.14, 0.015, 0.004);
        if (t > 0.6) return mix(mid, hot, (t - 0.6) / 0.4);
        if (t > 0.25) return mix(low, mid, (t - 0.25) / 0.35);
        return low * (t / 0.25) * (t / 0.25);
      }
    ` + shader.fragmentShader
      .replace(
        '#include <clipping_planes_fragment>',
        'if (vFlow > uFill) discard;\n#include <clipping_planes_fragment>'
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // while molten, the surface is self-luminous: damp reflected light
        diffuseColor.rgb *= (1.0 - uTemp * uTemp * 0.9);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float frontGlow = smoothstep(0.10, 0.0, uFill - vFlow) * step(uFill, 0.999) * 0.45;
          float heat = uTemp * uTemp;
          totalEmissiveRadiance += lfBlackbody(uTemp) * (heat * 0.85 + frontGlow * heat);
        }`
      );
  };
  // discard changes silhouette per-material program; make sure shadows update too
  mat.customProgramCacheKey = () => 'lf-cast';
  return { mat, uniforms };
}

export interface CastResult {
  mesh: THREE.Mesh;
  runner: THREE.Mesh;
  uniforms: CastUniforms;
}

/** Cast letter lying in the cavity + runner bar, sharing the fill shader. */
export function buildCastMesh(def: GlyphDef, field: MoldField): CastResult {
  const geo = moldSpaceGeometry(def, CAST_THICK, 0.004);
  // sit on the cavity floor
  geo.translate(0, -PRESS_DEPTH + 0.004, 0);
  attachFlow(geo, field);

  const { mat, uniforms } = buildCastMaterial();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // runner: from flask edge to the gate, shallower
  const gu = field.gateUv[0];
  const runnerLen = Math.max(0.02, (gu - 0.035) * FLASK_W);
  const rGeo = new THREE.BoxGeometry(runnerLen, PRESS_DEPTH * 0.5 * 0.8, field.runnerHalfW * 2 * FLASK_W * 0.9);
  rGeo.translate((0.035 * FLASK_W - FLASK_W / 2) + runnerLen / 2, -PRESS_DEPTH * 0.55 + (PRESS_DEPTH * 0.5 * 0.8) / 2, 0);
  // runner v centre = gate v
  const zOff = (field.gateUv[1] - 0.5) * FLASK_W;
  rGeo.translate(0, 0, zOff);
  attachFlow(rGeo, field);
  const runner = new THREE.Mesh(rGeo, mat);
  runner.castShadow = false;

  return { mesh, runner, uniforms };
}

function attachFlow(geo: THREE.BufferGeometry, field: MoldField) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const flow = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const u = x / FLASK_W + 0.5;
    const v = z / FLASK_W + 0.5;
    let f = field.sample(field.flow, u, v);
    if (!isFinite(f) || f > 1.05) f = 1.05;
    flow[i] = f;
  }
  geo.setAttribute('aFlow', new THREE.BufferAttribute(flow, 1));
}

/** clean display letter (for the reveal / shelf), same glyph, cold bronze */
export function buildFinishedMesh(def: GlyphDef): THREE.Mesh {
  const geo = moldSpaceGeometry(def, CAST_THICK, 0.004);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xa06a32,
    metalness: 0.9,
    roughness: 0.5,
    roughnessMap: castRoughnessTex(),
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
