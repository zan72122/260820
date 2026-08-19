import * as THREE from 'three';
import { DIM, type QualityProfile } from '../core/tuning';
import { Rng } from '../core/rng';
import { brushedSteelMaps, clothMaps, stoneMaps, glowTexture } from './textures';

export interface Kitchen {
  group: THREE.Group;
  /** the cake plate — the cake is parented to this */
  plate: THREE.Group;
  /** faint warm glow inside the oven, dimmed with the "soft light" setting */
  ovenGlow: THREE.Mesh;
  dispose: () => void;
}

/**
 * Foreground / midground / background are separated by contrast, saturation and
 * detail, not just by distance: the worktop and the cake stay crisp and
 * neutral, everything behind them loses bite and drifts cooler.
 */
export function buildKitchen(quality: QualityProfile): Kitchen {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const rng = new Rng(0x0a17e5);
  const detail = quality.backdropDetail;

  const track = <T extends { dispose: () => void }>(x: T): T => {
    disposables.push(x);
    return x;
  };

  const stone = stoneMaps(detail >= 2 ? 512 : 256);
  const steel = brushedSteelMaps(detail >= 1 ? 256 : 128);

  /* ------------------------------- worktop ------------------------------ */
  const benchMat = track(
    new THREE.MeshStandardMaterial({
      map: stone.map,
      normalMap: stone.normalMap,
      roughnessMap: stone.roughnessMap,
      roughness: 0.62,
      metalness: 0.02,
      color: 0xb9b4ae,
    }),
  );
  const bench = new THREE.Mesh(track(new THREE.BoxGeometry(14, 0.34, 7)), benchMat);
  bench.position.set(0, -0.17, -0.7);
  bench.receiveShadow = quality.shadows;
  group.add(bench);

  // A thin bevel of brighter stone catches the key light along the front edge.
  const edge = new THREE.Mesh(
    track(new THREE.BoxGeometry(14, 0.05, 0.06)),
    track(new THREE.MeshStandardMaterial({ color: 0xcfc8bf, roughness: 0.45, metalness: 0.04 })),
  );
  edge.position.set(0, -0.012, 2.79);
  group.add(edge);

  /* ------------------------- turntable + cake plate --------------------- */
  const plate = new THREE.Group();
  plate.position.set(0, DIM.benchY, 0);
  group.add(plate);

  const steelMat = track(
    new THREE.MeshStandardMaterial({
      map: steel.map,
      normalMap: steel.normalMap,
      roughnessMap: steel.roughnessMap,
      color: 0xd6d8db,
      roughness: 0.4,
      metalness: 0.82,
    }),
  );

  const base = new THREE.Mesh(
    track(new THREE.CylinderGeometry(DIM.plateRadius * 0.55, DIM.plateRadius * 0.62, 0.05, 36)),
    steelMat,
  );
  base.position.y = 0.024;
  base.receiveShadow = quality.shadows;
  plate.add(base);

  const disc = new THREE.Mesh(
    track(new THREE.CylinderGeometry(DIM.plateRadius, DIM.plateRadius, DIM.plateHeight * 0.55, 56, 1)),
    steelMat,
  );
  disc.position.y = DIM.plateHeight * 0.72;
  disc.castShadow = quality.shadows;
  disc.receiveShadow = quality.shadows;
  plate.add(disc);

  const lip = new THREE.Mesh(
    track(new THREE.TorusGeometry(DIM.plateRadius, 0.022, 8, 60)),
    steelMat,
  );
  lip.rotation.x = Math.PI / 2;
  lip.position.y = DIM.plateHeight * 0.92;
  plate.add(lip);

  /* --------------------------- melt droplets ---------------------------- */
  if (detail >= 1) {
    const dropGeo = track(new THREE.SphereGeometry(1, 8, 6));
    const dropMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xdfe6ea,
        roughness: 0.08,
        metalness: 0,
        transparent: true,
        opacity: 0.72,
      }),
    );
    const drops = new THREE.InstancedMesh(dropGeo, dropMat, 22);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 22; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = DIM.plateRadius + rng.range(0.12, 0.95);
      const s = rng.range(0.012, 0.032);
      m.makeScale(s * rng.range(1.1, 1.8), s * 0.42, s * rng.range(1.1, 1.8));
      m.setPosition(Math.cos(a) * r, 0.004, Math.sin(a) * r * 0.8 - 0.1);
      drops.setMatrixAt(i, m);
    }
    drops.instanceMatrix.needsUpdate = true;
    group.add(drops);
  }

  /* ------------------------------ backdrop ------------------------------ */
  // Everything from here back is deliberately quieter: cooler, flatter, softer.
  const wallMat = track(
    new THREE.MeshStandardMaterial({ color: 0x2b2528, roughness: 0.92, metalness: 0.02 }),
  );
  const wall = new THREE.Mesh(track(new THREE.PlaneGeometry(22, 9)), wallMat);
  wall.position.set(0, 2.6, -5.2);
  group.add(wall);

  const floorMat = track(
    new THREE.MeshStandardMaterial({ color: 0x1a1618, roughness: 0.86, metalness: 0.03 }),
  );
  const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(24, 14)), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -1.7, -2);
  group.add(floor);

  const dullSteel = track(
    new THREE.MeshStandardMaterial({
      map: steel.map,
      normalMap: steel.normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      color: 0x8c8f93,
      roughness: 0.52,
      metalness: 0.7,
    }),
  );

  // Reach-in freezer, left: the source of the cold fill light.
  const fridge = new THREE.Mesh(track(new THREE.BoxGeometry(2.0, 3.5, 1.5)), dullSteel);
  fridge.position.set(-3.5, 0.6, -4.0);
  group.add(fridge);
  const fridgeSeam = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.05, 3.3, 0.06)),
    track(new THREE.MeshStandardMaterial({ color: 0x1d2429, roughness: 0.6 })),
  );
  fridgeSeam.position.set(-3.5, 0.6, -3.22);
  group.add(fridgeSeam);
  const fridgeGlow = new THREE.Mesh(
    track(new THREE.PlaneGeometry(1.6, 2.6)),
    track(
      new THREE.MeshBasicMaterial({
        color: 0x7fa6cc,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
      }),
    ),
  );
  fridgeGlow.position.set(-3.45, 0.7, -3.2);
  group.add(fridgeGlow);

  // Deck oven, right: a dark glass door with a low warm interior.
  const oven = new THREE.Mesh(track(new THREE.BoxGeometry(2.4, 2.2, 1.4)), dullSteel);
  oven.position.set(3.3, -0.1, -3.9);
  group.add(oven);
  const ovenGlass = new THREE.Mesh(
    track(new THREE.PlaneGeometry(1.7, 1.0)),
    track(
      new THREE.MeshStandardMaterial({
        color: 0x14100f,
        roughness: 0.18,
        metalness: 0.4,
      }),
    ),
  );
  ovenGlass.position.set(3.3, 0.1, -3.19);
  group.add(ovenGlass);
  const ovenGlow = new THREE.Mesh(
    track(new THREE.PlaneGeometry(1.55, 0.86)),
    track(
      new THREE.MeshBasicMaterial({
        color: 0xff9a4a,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        toneMapped: false,
      }),
    ),
  );
  ovenGlow.position.set(3.3, 0.1, -3.17);
  group.add(ovenGlow);
  const ovenHandle = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.055, 0.055, 2.0, 10)),
    steelMat,
  );
  ovenHandle.rotation.z = Math.PI / 2;
  ovenHandle.position.set(3.3, 0.78, -3.15);
  group.add(ovenHandle);

  /* --------------------------- shelves + props -------------------------- */
  if (detail >= 1) {
    const shelfMat = dullSteel;
    for (let s = 0; s < 2; s++) {
      const shelf = new THREE.Mesh(track(new THREE.BoxGeometry(3.4, 0.05, 0.7)), shelfMat);
      shelf.position.set(0.1, 1.55 + s * 0.95, -4.3);
      group.add(shelf);
      for (let p = 0; p < 2; p++) {
        const post = new THREE.Mesh(
          track(new THREE.CylinderGeometry(0.035, 0.035, 2.6, 8)),
          shelfMat,
        );
        post.position.set(0.1 + (p === 0 ? -1.68 : 1.68), 1.75, -4.3);
        group.add(post);
      }
    }

    // Mixing bowls, lathe-turned so they read as real vessels.
    const bowlProfile: THREE.Vector2[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      bowlProfile.push(new THREE.Vector2(0.04 + Math.sin(t * 1.35) * 0.36, t * 0.3));
    }
    const bowlGeo = track(new THREE.LatheGeometry(bowlProfile, 24));
    const bowlMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x9aa0a4,
        roughness: 0.36,
        metalness: 0.78,
        side: THREE.DoubleSide,
      }),
    );
    for (let i = 0; i < 3; i++) {
      const bowl = new THREE.Mesh(bowlGeo, bowlMat);
      const sc = 1 - i * 0.16;
      bowl.scale.setScalar(sc);
      bowl.position.set(-2.35 + i * 0.06, 0.02 + i * 0.055, -1.5 - i * 0.08);
      group.add(bowl);
    }

    // Folded kitchen towel.
    const cloth = clothMaps(128);
    const clothMat = track(
      new THREE.MeshStandardMaterial({
        map: cloth.map,
        normalMap: cloth.normalMap,
        color: 0x9fa8ad,
        roughness: 0.94,
        metalness: 0,
      }),
    );
    const clothGeo = track(new THREE.PlaneGeometry(1.35, 0.95, 12, 10));
    const pos = clothGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setZ(i, Math.sin(x * 4.2) * 0.028 + Math.cos(y * 3.1) * 0.022 + rng.range(-0.008, 0.008));
    }
    clothGeo.computeVertexNormals();
    const towel = new THREE.Mesh(clothGeo, clothMat);
    towel.rotation.set(-Math.PI / 2, 0, 0.42);
    towel.position.set(2.3, 0.012, -0.9);
    towel.receiveShadow = quality.shadows;
    group.add(towel);
  }

  if (detail >= 2) {
    // A rack of piping tips and a whisk, far enough back to stay a texture.
    const tipMat = dullSteel;
    for (let i = 0; i < 5; i++) {
      const tip = new THREE.Mesh(track(new THREE.ConeGeometry(0.07, 0.16, 10, 1, true)), tipMat);
      tip.position.set(-1.1 + i * 0.22, 1.66, -4.2);
      tip.rotation.x = Math.PI;
      group.add(tip);
    }
    const whisk = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8)),
      tipMat,
    );
    whisk.position.set(1.5, 1.95, -4.25);
    whisk.rotation.z = 0.3;
    group.add(whisk);
  }

  // Very soft pool of light on the bench under the cake, painted not lit —
  // it anchors the plate even when shadows are switched off.
  const pool = new THREE.Mesh(
    track(new THREE.PlaneGeometry(4.4, 4.4)),
    track(
      new THREE.MeshBasicMaterial({
        map: track(glowTexture(128, 0.9)),
        color: 0x0a0708,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        blending: THREE.NormalBlending,
      }),
    ),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.006, 0.05);
  group.add(pool);

  return {
    group,
    plate,
    ovenGlow,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
