import * as THREE from 'three';
import { mergeGeometries, ribbon } from '../gfx/geo';
import { makeRng, lerp, smoothstep } from '../gfx/noise';
import { CFG } from '../game/config';

/**
 * The white root. Origin sits at the shoulder / soil line, the root hangs down -Y,
 * so the same origin can ride the belt pinch line once it is pulled.
 */
export function buildRootGeometry(radialSegs = 18): THREE.BufferGeometry {
  const R = CFG.daikonRadius;
  const L = CFG.daikonLength;
  const profile: Array<[number, number]> = [
    [0.0, -L],
    [R * 0.17, -L + 0.014],
    [R * 0.36, -L + 0.044],
    [R * 0.54, -L + 0.09],
    [R * 0.71, -L + 0.14],
    [R * 0.84, -L + 0.194],
    [R * 0.93, -L + 0.25],
    [R * 0.975, -L + 0.312],
    [R * 1.0, -L + 0.38],
    [R * 1.0, 0.004],
    [R * 0.985, 0.028],
    [R * 0.93, 0.043],
    [R * 0.77, 0.053],
    [R * 0.44, 0.06],
    [0.0, 0.063],
  ];
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y));
  const g = new THREE.LatheGeometry(pts, radialSegs);

  // v currently runs tip -> shoulder; the skin texture is authored shoulder -> tip
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));

  // gentle organic sway + slightly oval section so it never reads as a lathe primitive
  const pos = g.attributes.position as THREE.BufferAttribute;
  const rng = makeRng(7);
  const bendA = (rng() - 0.5) * 0.05;
  const bendB = (rng() - 0.5) * 0.04;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = THREE.MathUtils.clamp(-y / CFG.daikonLength, 0, 1);
    const bx = bendA * t * t + bendB * t;
    const bz = bendB * t * t * 0.8;
    const oval = 1 + Math.sin(Math.atan2(z, x) * 2 + 0.7) * 0.035;
    pos.setXYZ(i, x * oval + bx, y, z * oval * 0.985 + bz);
  }
  g.computeVertexNormals();

  // the fine tail root — unmistakably a daikon
  const tail = new THREE.CylinderGeometry(0.0032, 0.0011, 0.055, 6, 1, true);
  tail.translate(0, -CFG.daikonLength - 0.024, 0);
  tail.rotateX(0.16);
  tail.translate(bendA + bendB, 0, bendB * 0.8);
  const merged = mergeGeometries([g, tail], false);
  return merged ?? g;
}

/** Flat disc revealed on the crown once the leaves are sheared off. */
export function buildCutFaceGeometry(): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(CFG.daikonRadius * 0.76, 16);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.052, 0);
  return g;
}

interface BladeSpec {
  length: number;
  width: number;
  yaw: number;
  outAngle: number;
  lean: number;
  segs: number;
}

function buildBlade(spec: BladeSpec): THREE.BufferGeometry {
  const { length, width, yaw, outAngle, lean, segs } = spec;
  const pts: THREE.Vector3[] = [];
  const sides: THREE.Vector3[] = [];
  const folds: THREE.Vector3[] = [];
  const hw: number[] = [];
  const dirY = new THREE.Vector3();
  let x = 0;
  let y = 0;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    // 0 = straight up, grows outward and finally droops past horizontal
    const ang = lerp(0.14, outAngle, Math.pow(t, 1.35));
    pts.push(new THREE.Vector3(x * cy, y, x * sy));
    // ribbon widens horizontally, perpendicular to the blade's own plane
    sides.push(new THREE.Vector3(-sy, 0, cy));
    dirY.set(Math.cos(ang) * cy, -Math.sin(ang), Math.cos(ang) * sy).normalize();
    folds.push(dirY.clone());
    const stalk = 0.24 + 0.76 * smoothstep(0.05, 0.4, t);
    const tip = 1 - smoothstep(0.85, 1.0, t) * 0.4;
    const waver = 1 + Math.sin(t * 11 + yaw * 3) * 0.07;
    hw.push(width * 0.5 * stalk * tip * waver);
    const ds = length / segs;
    x += Math.sin(ang) * ds;
    y += Math.cos(ang) * ds;
  }
  const g = ribbon({ points: pts, halfWidths: hw, sides, widthSegs: 3, fold: 0.42, foldDirs: folds });
  if (lean !== 0) g.rotateY(lean);
  return g;
}

/** A whole leaf rosette, merged into one drawable. Origin at the crown. */
export function buildLeafClumpGeometry(detail: 'high' | 'low' | 'far', seed: number): THREE.BufferGeometry {
  const rng = makeRng(seed);
  const count = detail === 'high' ? 14 : detail === 'low' ? 10 : 6;
  const segs = detail === 'high' ? 11 : detail === 'low' ? 7 : 4;
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const inner = i >= count - 2;
    parts.push(
      buildBlade({
        length: inner ? 0.16 + rng() * 0.06 : 0.31 + rng() * 0.17,
        width: inner ? 0.062 : 0.096 + rng() * 0.056,
        yaw: t * Math.PI * 2 + rng() * 0.55,
        outAngle: inner ? 0.42 + rng() * 0.32 : 1.02 + rng() * 0.92,
        lean: (rng() - 0.5) * 0.3,
        segs,
      }),
    );
  }
  const g = mergeGeometries(parts, false)!;
  g.translate(0, 0.045, 0);
  g.computeBoundingSphere();
  return g;
}

/** Leaf material with a shader-side "gathered by the gripping belt" deformation. */
export function makeLeafMaterial(base: THREE.MeshStandardMaterial): {
  material: THREE.MeshStandardMaterial;
  uniforms: { uGrab: { value: number }; uPinchY: { value: number } };
} {
  const material = base.clone();
  const uniforms = { uGrab: { value: 0 }, uPinchY: { value: 0.34 } };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGrab = uniforms.uGrab;
    shader.uniforms.uPinchY = uniforms.uPinchY;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uGrab;\nuniform float uPinchY;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
if ( uGrab > 0.0001 ) {
  float rad = length( transformed.xz );
  float t = clamp( rad / 0.23, 0.0, 1.0 );
  float g = uGrab * ( 0.12 + 0.88 * t );
  transformed.xz *= ( 1.0 - 0.88 * g );
  transformed.y += ( uPinchY - transformed.y ) * g * 0.62;
}`,
      );
  };
  material.customProgramCacheKey = () => 'leafGrab';
  return { material, uniforms };
}
