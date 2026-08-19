import * as THREE from 'three';
import { makeDomeGeometry, CAKE_R, CAKE_H, rNorm, yNorm, meridianNormal } from './profile';
import { frostMaps, radialAlpha } from '../core/tex';

export interface CakeParts {
  group: THREE.Group;
  mesh: THREE.Mesh;
  material: THREE.MeshPhysicalMaterial;
  setFrost(v: number): void;
}

/** The frozen entremet: dull sheen, micro frost, condensation gathering low. */
export function buildCake(low: boolean): CakeParts {
  const group = new THREE.Group();
  const maps = frostMaps(low ? 256 : 512);
  maps.color.repeat.set(3, 1);
  maps.roughness.repeat.set(3, 1);

  const material = new THREE.MeshPhysicalMaterial({
    color: 0xe4e8ee,
    map: maps.color,
    roughnessMap: maps.roughness,
    roughness: 0.55,
    metalness: 0.0,
    clearcoat: 0.4,
    clearcoatRoughness: 0.55,
    envMapIntensity: 0.85,
    sheen: 0.35,
    sheenColor: new THREE.Color(0xdfe9ff),
    sheenRoughness: 0.8,
  });

  const mesh = new THREE.Mesh(
    makeDomeGeometry({
      radialSegments: low ? 80 : 128,
      heightSegments: low ? 48 : 72,
      cap: true,
    }),
    material
  );
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  group.add(mesh);

  // condensation: a few beads of melt water low on the frozen dome. They are
  // simply swallowed by the glaze shell once it flows over them.
  const dropCount = low ? 22 : 40;
  const beads = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, low ? 6 : 8, low ? 5 : 6),
    new THREE.MeshPhysicalMaterial({
      color: 0xdfeaf2,
      roughness: 0.05,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.6,
    }),
    dropCount
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  for (let i = 0; i < dropCount; i++) {
    const v = 0.42 + Math.pow(Math.random(), 0.7) * 0.55;
    const a = Math.random() * Math.PI * 2;
    const [nr, ny] = meridianNormal(v);
    const r = rNorm(v) * CAKE_R;
    const y = yNorm(v) * CAKE_H;
    const rad = 0.00035 + Math.random() * 0.00055;
    pos.set(
      (r + nr * rad * 0.35) * Math.cos(a),
      y + ny * rad * 0.35,
      (r + nr * rad * 0.35) * Math.sin(a)
    );
    scl.set(rad, rad * 0.8, rad);
    m.compose(pos, q, scl);
    beads.setMatrixAt(i, m);
  }
  beads.instanceMatrix.needsUpdate = true;
  beads.frustumCulled = false;
  group.add(beads);

  // contact shadow that travels with the cake
  const shade = new THREE.Mesh(
    new THREE.PlaneGeometry(CAKE_R * 2.9, CAKE_R * 2.9),
    new THREE.MeshBasicMaterial({
      color: 0x0d0a0b,
      transparent: true,
      opacity: 0.45,
      alphaMap: radialAlpha(128, 2.6),
      depthWrite: false,
      toneMapped: false,
    })
  );
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = 0.0012;
  shade.renderOrder = 0;
  group.add(shade);

  return {
    group,
    mesh,
    material,
    setFrost(v: number) {
      material.roughness = THREE.MathUtils.lerp(0.34, 0.66, v);
      material.sheen = 0.35 * v;
      material.needsUpdate = false;
    },
  };
}

export interface MoldParts {
  group: THREE.Group;
  setWobble(v: number): void;
  update(t: number): void;
}

/** Silicone mould: real wall thickness, rubbery deformation, no transmission. */
export function buildMold(low: boolean): MoldParts {
  const group = new THREE.Group();
  const wobble = { value: 0 };
  const time = { value: 0 };

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xa9b6c0,
    roughness: 0.52,
    metalness: 0.0,
    clearcoat: 0.25,
    clearcoatRoughness: 0.45,
    envMapIntensity: 0.7,
    sheen: 0.6,
    sheenColor: new THREE.Color(0xffffff),
    sheenRoughness: 0.7,
    side: THREE.FrontSide,
  });

  const inner = mat.clone();
  inner.side = THREE.BackSide;
  inner.color = new THREE.Color(0x94a3ae);

  const patch = (m: THREE.MeshPhysicalMaterial) => {
    m.customProgramCacheKey = () => 'siliconeWobble';
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uWob = wobble;
      sh.uniforms.uTime = time;
      sh.vertexShader = sh.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform float uWob;\nuniform float uTime;'
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float w = uWob * smoothstep(0.0, 0.75, uv.y);
           float rip = sin(uv.y * 14.0 - uTime * 13.0 + uv.x * 12.566) * 0.5
                     + sin(uv.y * 7.0 - uTime * 9.0) * 0.5;
           transformed += normal * (rip * 0.006 * w);
           transformed.y -= w * 0.004 * (1.0 - uv.y);`
        );
    };
  };
  patch(mat);
  patch(inner);

  const seg = { radialSegments: low ? 64 : 96, heightSegments: low ? 40 : 56 };
  const outer = new THREE.Mesh(makeDomeGeometry({ ...seg, offset: 0.0072 }), mat);
  outer.castShadow = true;
  group.add(outer);

  const innerMesh = new THREE.Mesh(makeDomeGeometry({ ...seg, offset: 0.0006 }), inner);
  group.add(innerMesh);

  // flange that closes the wall at the rim
  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(CAKE_R + 0.0039, 0.0036, 6, low ? 48 : 72),
    mat
  );
  lip.rotation.x = Math.PI / 2;
  lip.castShadow = true;
  group.add(lip);

  // a proper moulded flange around the base: it is what makes the shape read as
  // silicone bakeware rather than a plain dome
  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(CAKE_R + 0.02, CAKE_R + 0.023, 0.009, low ? 48 : 72),
    mat
  );
  skirt.position.y = 0.0045;
  skirt.castShadow = true;
  group.add(skirt);

  const skirtEdge = new THREE.Mesh(
    new THREE.TorusGeometry(CAKE_R + 0.0205, 0.0028, 6, low ? 44 : 66),
    mat
  );
  skirtEdge.rotation.x = Math.PI / 2;
  skirtEdge.position.y = 0.009;
  group.add(skirtEdge);

  return {
    group,
    setWobble(v: number) {
      wobble.value = v;
    },
    update(t: number) {
      time.value = t;
    },
  };
}

export const CAKE_TOP_Y = CAKE_H;
export const CAKE_RADIUS = CAKE_R;
