import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { benchStone, benchRough, brushedSteel, radialAlpha } from '../core/tex';

function tileTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#8e8b86';
  ctx.fillRect(0, 0, size, size);
  const n = 4;
  const s = size / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const l = 0.86 + Math.random() * 0.14;
      ctx.fillStyle = `rgb(${(196 * l) | 0}, ${(192 * l) | 0}, ${(186 * l) | 0})`;
      ctx.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(4, 2);
  return t;
}

export interface Kitchen {
  key: THREE.DirectionalLight;
  group: THREE.Group;
}

/**
 * Depth is built from silhouette overlap, occlusion, material and colour
 * temperature — not from a depth-of-field pass. Background pieces are
 * deliberately lower in contrast and saturation than the cake.
 */
export function buildKitchen(scene: THREE.Scene, low: boolean): Kitchen {
  const group = new THREE.Group();
  scene.add(group);

  const stone = benchStone(low ? 256 : 512);
  const stoneRough = benchRough(256);
  stone.repeat.set(2, 1);
  stoneRough.repeat.set(2, 1);

  // ---- bench -------------------------------------------------------------
  const benchMat = new THREE.MeshPhysicalMaterial({
    map: stone,
    roughnessMap: stoneRough,
    roughness: 0.62,
    metalness: 0.0,
    color: 0xc2bbb2,
    clearcoat: 0.12,
    clearcoatRoughness: 0.6,
    envMapIntensity: 0.75,
  });
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 1.5), benchMat);
  bench.position.set(0, -0.03, -0.1);
  bench.receiveShadow = true;
  group.add(bench);

  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.86, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x8a847c, roughness: 0.75, metalness: 0.05 })
  );
  apron.position.set(0, -0.49, 0.63);
  group.add(apron);

  // ---- floor & wall ------------------------------------------------------
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.MeshStandardMaterial({ color: 0x6b6472, roughness: 0.85, metalness: 0.0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.92;
  group.add(floor);

  const tiles = tileTexture(low ? 256 : 512);
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 3.4),
    new THREE.MeshStandardMaterial({
      map: tiles,
      color: 0xc9c6bd,
      roughness: 0.5,
      metalness: 0.0,
      envMapIntensity: 0.5,
    })
  );
  wall.position.set(0, 0.6, -1.35);
  group.add(wall);

  // ---- cold cabinet ------------------------------------------------------
  const steelRough = brushedSteel(low ? 256 : 512, 0.3, 0.2);
  const steelMat = new THREE.MeshPhysicalMaterial({
    color: 0x9fa3a6,
    metalness: 1.0,
    roughness: 0.32,
    roughnessMap: steelRough,
    envMapIntensity: 0.85,
    anisotropy: 0.5,
  });

  const fridge = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.85, 0.62), steelMat);
  fridge.position.set(-1.0, 0.0, -1.0);
  group.add(fridge);
  const seam = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.012, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x3d4144, roughness: 0.6, metalness: 0.4 })
  );
  seam.position.set(-1.0, 0.24, -0.7);
  group.add(seam);
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.42, 10),
    steelMat
  );
  handle.position.set(-0.62, 0.62, -0.66);
  group.add(handle);

  // ---- shelf with utensils ----------------------------------------------
  const shelfMat = new THREE.MeshPhysicalMaterial({
    color: 0x8d9296,
    metalness: 1.0,
    roughness: 0.4,
    roughnessMap: steelRough,
    envMapIntensity: 0.7,
  });
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.02, 0.3), shelfMat);
  shelf.position.set(0.55, 0.72, -1.16);
  group.add(shelf);

  const props: THREE.BufferGeometry[] = [];
  const jar = new THREE.CylinderGeometry(0.045, 0.05, 0.16, 12);
  const bowl = new THREE.SphereGeometry(0.075, 14, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45);
  const xs = [-0.05, 0.12, 0.3, 0.52, 0.78, 0.98, 1.16];
  xs.forEach((x, i) => {
    const g = i % 3 === 2 ? bowl.clone() : jar.clone();
    const h = i % 3 === 2 ? 0.79 : 0.81;
    g.translate(x, h, -1.14 + (i % 2) * 0.05);
    props.push(g);
  });
  const merged = mergeGeometries(props, false);
  if (merged) {
    const utensils = new THREE.Mesh(
      merged,
      new THREE.MeshPhysicalMaterial({
        color: 0x9aa0a4,
        metalness: 0.9,
        roughness: 0.45,
        envMapIntensity: 0.6,
      })
    );
    group.add(utensils);
  }
  jar.dispose();
  bowl.dispose();

  // ---- practical light panel above and behind ---------------------------
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xfff4e8 })
  );
  panel.position.set(-0.5, 1.55, -0.75);
  panel.rotation.x = Math.PI * 0.16;
  group.add(panel);

  // ---- bench props: they fill the wide landscape frame and sell the scale ---
  const mixingBowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, low ? 16 : 26, low ? 10 : 16, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48),
    new THREE.MeshPhysicalMaterial({
      color: 0xb6bbbe,
      metalness: 1.0,
      roughness: 0.3,
      roughnessMap: steelRough,
      envMapIntensity: 0.85,
      anisotropy: 0.5,
      side: THREE.DoubleSide,
    })
  );
  mixingBowl.position.set(-0.52, 0.075, 0.05);
  mixingBowl.castShadow = true;
  group.add(mixingBowl);

  const spatula = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.0035, 0.028),
    new THREE.MeshPhysicalMaterial({
      color: 0xc6cacd,
      metalness: 1.0,
      roughness: 0.26,
      envMapIntensity: 0.9,
    })
  );
  spatula.position.set(0.47, 0.002, 0.16);
  spatula.rotation.y = -0.5;
  spatula.castShadow = true;
  group.add(spatula);
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.011, 0.1, 8),
    new THREE.MeshStandardMaterial({ color: 0x3b3f42, roughness: 0.55, metalness: 0.1 })
  );
  grip.rotation.set(0, -0.5, Math.PI / 2);
  grip.position.set(0.58, 0.011, 0.213);
  grip.castShadow = true;
  group.add(grip);

  const cloth = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.012, 0.13),
    new THREE.MeshStandardMaterial({ color: 0xdfe3e6, roughness: 0.92, metalness: 0 })
  );
  cloth.position.set(0.42, 0.006, -0.13);
  cloth.rotation.y = 0.32;
  cloth.castShadow = true;
  group.add(cloth);

  // ---- foreground rail (reads as near-field depth) ----------------------
  const rail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0075, 0.0075, 1.3, low ? 10 : 16),
    new THREE.MeshPhysicalMaterial({
      color: 0x8e9599,
      metalness: 1.0,
      roughness: 0.46,
      roughnessMap: steelRough,
      envMapIntensity: 1.0,
      anisotropy: 0.6,
    })
  );
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0, 0.05, 0.46);
  rail.castShadow = true;
  group.add(rail);
  for (const sx of [-0.42, 0.42]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.006, 0.05, 8),
      steelMat
    );
    post.position.set(sx, 0.025, 0.46);
    group.add(post);
  }

  // ---- lighting ----------------------------------------------------------
  const key = new THREE.DirectionalLight(0xfff6ee, 4.1);
  key.position.set(-0.62, 1.05, 0.5);
  key.target.position.set(0, 0.05, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(low ? 512 : 1024, low ? 512 : 1024);
  key.shadow.camera.near = 0.3;
  key.shadow.camera.far = 2.4;
  const s = 0.4;
  key.shadow.camera.left = -s;
  key.shadow.camera.right = s;
  key.shadow.camera.top = s;
  key.shadow.camera.bottom = -s;
  key.shadow.bias = -0.0009;
  key.shadow.normalBias = 0.008;
  key.shadow.radius = 3;
  scene.add(key);
  scene.add(key.target);

  const windowLight = new THREE.DirectionalLight(0xbcd6ff, 1.7);
  windowLight.position.set(0.9, 0.8, -1.1);
  scene.add(windowLight);

  const warm = new THREE.DirectionalLight(0xffc79a, 0.85);
  warm.position.set(1.1, 0.15, 0.6);
  scene.add(warm);

  const bounce = new THREE.HemisphereLight(0xdfe6ff, 0x7d6a60, 0.42);
  scene.add(bounce);

  // ---- soft contact shadow under the whole set --------------------------
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.44),
    new THREE.MeshBasicMaterial({
      color: 0x120e10,
      transparent: true,
      opacity: 0.34,
      alphaMap: radialAlpha(128, 1.9),
      depthWrite: false,
      toneMapped: false,
    })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.set(0, 0.0016, -0.02);
  blob.renderOrder = -1;
  group.add(blob);

  return { key, group };
}
